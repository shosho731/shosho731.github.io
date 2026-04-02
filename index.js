const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;

// すべてのフォルダ（osero, daifugoなど）をブラウザから見えるようにする
app.use(express.static(__dirname));

// --- 各ゲームの専門担当（ロジック）を読み込む ---
// path を使って正確にファイルを指定します
const oseroLogic = require('./osero/oseroLogic.js');
oseroLogic(io); 

// 将来、大富豪を追加するときはここに追加するだけ！
// const daifugoLogic = require('./daifugo/daifugoLogic.js');
// daifugoLogic(io);

// サーバー起動
httpServer.listen(PORT, () => {
  console.log(`Main Server running: http://localhost:${PORT}`);
});
