# オセロ（オフライン / オンライン）

オセロゲームです。オフライン（同じ端末で2人）と、オンライン（部屋コードで対戦）の両方に対応しています。

## 開発時の動かし方

1. 依存関係を入れる  
   `npm install`

2. サーバーを起動  
   `npm start`

3. ブラウザで開く  
   [http://localhost:3000](http://localhost:3000)

## オンライン対戦の流れ

- **部屋を作る**: 「オンライン」→「部屋を作る」でルームコードが表示されます。
- **入室する**: もう一方のプレイヤーは「オンライン」→ ルームコードを入力 →「入室」で同じ部屋に入れます。
- 2人揃うとゲーム開始。黒が部屋作成者、白が入室した側です。

## Render でデプロイする手順

1. このリポジトリを GitHub にプッシュする。
2. [Render](https://render.com) にログインし、**New → Web Service** を選ぶ。
3. 接続する GitHub リポジトリを選ぶ。
4. 設定例:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: 無料プランで可
5. **Create Web Service** でデプロイ。
6. 表示された URL（例: `https://osero-online-xxxx.onrender.com`）でアクセスする。

Render は `PORT` を自動で渡すため、サーバー側で `process.env.PORT` を使うようにしてあります。

## ファイル構成

- `package.json` - 依存関係と `npm start`
- `server/index.js` - Express + Socket.io サーバー（部屋管理・ゲーム進行）
- `public/index.html` - フロント（オフライン / オンライン共通画面）
