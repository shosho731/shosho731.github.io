/**
 * オセロ オンラインサーバー（Express + Socket.io）
 * 部屋作成・コード入室・対戦同期
 */

const path = require('path');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;

// --- Mini search engine (crawl + index + query) ---
const { loadSearchState, search } = require('../Proxy/search/searchRuntime');
let searchState = loadSearchState();

// 定数（クライアントと一致）
const BOARD_SIZE = 8;
const EMPTY = 0;
const BLACK = 1;
const WHITE = -1;
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

// ルーム: code -> { blackId, whiteId, board, currentPlayer, gameOver }
const rooms = new Map();

function createInitialBoard() {
  const board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => EMPTY)
  );
  const mid = BOARD_SIZE / 2;
  board[mid - 1][mid - 1] = WHITE;
  board[mid - 1][mid] = BLACK;
  board[mid][mid - 1] = BLACK;
  board[mid][mid] = WHITE;
  return board;
}

function isValidMove(board, row, col, player) {
  if (board[row][col] !== EMPTY) return false;
  for (const [dr, dc] of DIRECTIONS) {
    let r = row + dr;
    let c = col + dc;
    let foundOpponent = false;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      const cell = board[r][c];
      if (cell === EMPTY) break;
      if (cell === player) {
        if (foundOpponent) return true;
        break;
      }
      foundOpponent = true;
      r += dr;
      c += dc;
    }
  }
  return false;
}

function getValidMoves(board, player) {
  const moves = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (isValidMove(board, r, c, player)) moves.push([r, c]);
    }
  }
  return moves;
}

function makeMove(board, row, col, player) {
  if (!isValidMove(board, row, col, player)) return false;
  board[row][col] = player;
  const opponent = -player;
  for (const [dr, dc] of DIRECTIONS) {
    let r = row + dr;
    let c = col + dc;
    const toFlip = [];
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      const cell = board[r][c];
      if (cell === EMPTY) break;
      if (cell === opponent) {
        toFlip.push([r, c]);
        r += dr;
        c += dc;
      } else if (cell === player) {
        for (const [fr, fc] of toFlip) board[fr][fc] = player;
        break;
      } else break;
    }
  }
  return true;
}

function getScore(board) {
  let black = 0, white = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === BLACK) black++;
      if (board[r][c] === WHITE) white++;
    }
  }
  return { black, white };
}

function advanceTurn(room) {
  const { board, currentPlayer } = room;
  let nextPlayer = -currentPlayer;
  if (getValidMoves(board, nextPlayer).length > 0) {
    room.currentPlayer = nextPlayer;
    return;
  }
  if (getValidMoves(board, currentPlayer).length > 0) {
    room.currentPlayer = currentPlayer;
    room.passed = true;
    return;
  }
  room.gameOver = true;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? generateRoomCode() : code;
}

function findRoomBySocket(socketId) {
  for (const [code, room] of rooms.entries()) {
    if (room.blackId === socketId || room.whiteId === socketId) return { code, room };
  }
  return null;
}

// 静的ファイル（Render では同じサービスから配信）
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.static(path.join(__dirname, '..', 'Proxy', 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/search', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Proxy', 'public', 'search.html'));
});

app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '');
  // reload each time (small files; keeps meta/results fresh after re-index)
  searchState = loadSearchState();
  const payload = search(q, searchState, 10);
  res.json({ ...payload, meta: searchState.meta });
});

io.on('connection', (socket) => {
  socket.on('create_room', () => {
    const code = generateRoomCode();
    rooms.set(code, {
      blackId: socket.id,
      whiteId: null,
      board: createInitialBoard(),
      currentPlayer: BLACK,
      gameOver: false,
      passed: false,
    });
    socket.join(code);
    socket.emit('room_created', { roomCode: code, role: BLACK });
  });

  socket.on('join_room', (roomCode) => {
    const code = String(roomCode).toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) {
      socket.emit('join_error', { message: 'ルームが見つかりません。コードを確認してください。' });
      return;
    }
    if (room.whiteId) {
      socket.emit('join_error', { message: 'このルームは満室です。' });
      return;
    }
    room.whiteId = socket.id;
    socket.join(code);
    socket.emit('room_joined', { role: WHITE });
    const state = {
      board: room.board.map(row => [...row]),
      currentPlayer: room.currentPlayer,
      gameOver: room.gameOver,
      score: getScore(room.board),
    };
    io.to(code).emit('game_start', state);
  });

  socket.on('game_move', (payload) => {
    const { row, col } = payload;
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    if (room.gameOver) return;
    const myRole = room.blackId === socket.id ? BLACK : WHITE;
    if (room.currentPlayer !== myRole) return;
    if (typeof row !== 'number' || typeof col !== 'number' || row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;
    if (!makeMove(room.board, row, col, myRole)) return;
    room.passed = false;
    advanceTurn(room);
    const state = {
      board: room.board.map(row => [...row]),
      currentPlayer: room.currentPlayer,
      gameOver: room.gameOver,
      score: getScore(room.board),
      lastMove: { row, col },
    };
    io.to(code).emit('game_state', state);
  });

  socket.on('leave_room', () => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { code } = found;
    rooms.delete(code);
    socket.leave(code);
    socket.to(code).emit('player_left', { message: '相手が退出しました。' });
  });

  socket.on('disconnect', () => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { code } = found;
    rooms.delete(code);
    socket.to(code).emit('player_left', { message: '相手が切断されました。' });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Othello server: http://localhost:${PORT}`);
});
