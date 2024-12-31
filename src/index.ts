import dotenv from 'dotenv';
import { ChatWatcher } from './ChatWatcher';

dotenv.config();

const WS_URL = process.env.WEBSOCKET_URL || 'ws://localhost:8080';
const HIROYUKI_USER_ID = process.env.HIROYUKI_USER_ID

if (!HIROYUKI_USER_ID) {
  throw new Error('ひろゆきボット用YouTubeアカウントのUserIdが指定されていません');
}

const main = () => {
  const chatWatcher = new ChatWatcher(WS_URL, HIROYUKI_USER_ID);
  console.log('チャット監視を開始しました');
};

main();