import dotenv from 'dotenv';
import { ChatWatcher } from './ChatWatcher';

dotenv.config();

const WS_URL = process.env.WEBSOCKET_URL || 'ws://localhost:8080';
const YOUTUBE_BOT_USER_ID = process.env.YOUTUBE_BOT_USER_ID;
const TIKTOK_BOT_USER_ID = process.env.TIKTOK_BOT_USER_ID;
const TWICAS_BOT_USER_ID = process.env.TWICAS_BOT_USER_ID;

if (!YOUTUBE_BOT_USER_ID) {
  throw new Error('ひろゆきボット用YouTubeアカウントのUserIdが指定されていません');
}
if (!TIKTOK_BOT_USER_ID) {
  throw new Error('ひろゆきボット用TikTokアカウントのUserIdが指定されていません');
}
if (!TWICAS_BOT_USER_ID) {
  throw new Error('ひろゆきボット用ツイキャスアカウントのUserIdが指定されていません');
}

const main = () => {
  const chatWatcher = new ChatWatcher(WS_URL, {
    youtube: {
      botUserId: YOUTUBE_BOT_USER_ID
    },
    tiktok: {
      botUserId: TIKTOK_BOT_USER_ID
    },
    twitcasting: {
      botUserId: TWICAS_BOT_USER_ID
    }
  });
  console.log('チャット監視を開始しました');
};

main();