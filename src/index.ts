import dotenv from 'dotenv';
import { ChatWatcher } from './ChatWatcher';

dotenv.config();

const WS_URL = process.env.WEBSOCKET_URL || 'ws://localhost:8080';
const YOUTUBE_BOT_USER_ID = process.env.YOUTUBE_BOT_USER_ID

if (!YOUTUBE_BOT_USER_ID) {
  throw new Error('ひろゆきボット用YouTubeアカウントのUserIdが指定されていません');
}

const main = () => {
  const chatWatcher = new ChatWatcher(WS_URL, {
    youtube: {
      botUserId: YOUTUBE_BOT_USER_ID
    },
    // tiktok: {
    //   botUserId: 'tiktok-bot-id'
    // },
    // twitcasting: {
    //   botUserId: 'twitcasting-bot-id'
    // }
  });
  console.log('チャット監視を開始しました');
};

main();