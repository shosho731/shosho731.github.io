// オセロ専用の変数とロジック
const BOARD_SIZE = 8;
const EMPTY = 0;
const BLACK = 1;
const WHITE = -1;
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

const rooms = new Map();

// --- 補助関数の定義 (createInitialBoard, isValidMove などはそのままここにコピー) ---
function createInitialBoard() { /* 省略（中身は元のコードと同じ） */ }
function isValidMove(board, row, col, player) { /* 省略 */ }
function getValidMoves(board, player) { /* 省略 */ }
function makeMove(board, row, col, player) { /* 省略 */ }
function getScore(board) { /* 省略 */ }
function advanceTurn(room) { /* 省略 */ }
function generateRoomCode() { /* 省略 */ }
function findRoomBySocket(socketId) { /* 省略 */ }

// メインの通信処理を「関数」として書き出します
module.exports = function(io) {
  io.on('connection', (socket) => {
    // オセロの通信イベント（create_room, join_room など）をすべてここに配置
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

    // ... (join_room, game_move, disconnect などの socket.on をすべてここに移動)
    
  });
};
