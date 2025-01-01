# ぁゃぴライブ配信ボット

ぁゃぴのライブ配信のチャット欄に常駐するAIボットです。

## 機能

わんコメのWebSocketのsubscriberとして動作します。

- チャットの自動監視と返信
- 不適切なコメントの検出と対応
- ひろゆき風の言葉遊び
- マルチ言語対応（日本語、英語、フランス語、スペイン語）
- アーカイブ配信の分析機能

## 必要要件

- わんコメ
- Node.js 18以上
- TypeScript
- YouTube Data API v3のアクセス権限
- OpenAI APIキー

## インストール

```bash
git clone [repository-url]
cd ayapi-live-chat-bot
npm install
```


## 環境設定

`.env`ファイルを作成し、以下の環境変数を設定：

```env
OPENAI_API_KEY=your_openai_api_key
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth2callback
HIROYUKI_USER_ID=your_youtube_account_user_id
WEBSOCKET_URL=ws://localhost:8080
```

## 使用方法

### ライブ配信監視の開始

```bash
npm start
```


### アーカイブ配信のチャット欄の分析

```bash
npm run analyze [YouTube-URL]
```

### 開発モード

```bash
npm run dev
```

## 主要コンポーネント

### HiroyukiBot

メインのボットロジックを実装したクラス。以下の機能を提供：

- コメントの種類判定
- ひろゆき風の返答生成
- 言葉遊びの生成
- バッチ処理による効率的な応答

### YouTubeService

YouTubeとの連携を管理するクラス：

- ライブ配信中のチャットへの投稿
- OAuth2認証の処理
- アーカイブチャットの取得

## ライセンス

ISC

## 注意事項

- YouTube APIの利用制限に注意してください
- OpenAI APIの利用料金が発生します

