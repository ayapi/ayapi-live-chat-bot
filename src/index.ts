import dotenv from 'dotenv';
import { ChatWatcher } from './ChatWatcher';

dotenv.config();

const WS_URL = process.env.WEBSOCKET_URL || 'ws://localhost:8080';

const main = () => {
  const chatWatcher = new ChatWatcher(WS_URL);
  console.log('チャット監視を開始しました');
};

main();