import { TwitcastingPlatform } from './services/platforms/TwitcastingPlatform';
import dotenv from 'dotenv';

dotenv.config();
const TWICAS_BOT_USER_ID = process.env.TWICAS_BOT_USER_ID;

if (!TWICAS_BOT_USER_ID) {
  throw new Error('ひろゆきボット用ツイキャスアカウントのUserIdが指定されていません');
}

const platform = new TwitcastingPlatform(TWICAS_BOT_USER_ID);

async function testTwitcastingMessage() {
  try {
    // 配信URLを指定して初期化
    const initialized = await platform.initialize({
      url: 'https://twitcasting.tv/upgrade_ayp'
    });

    if (!initialized) {
      console.error('初期化に失敗しました');
      return;
    }

    // テストメッセージを送信
    await platform.postMessage('てすと');
    console.log('メッセージの送信に成功しました');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

testTwitcastingMessage(); 