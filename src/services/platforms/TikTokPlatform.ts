import { IChatPlatform, PlatformState } from '../IChatPlatform';
import { Comment } from "@onecomme.com/onesdk/types/Comment";
import axios from 'axios';

export class TikTokPlatform implements IChatPlatform {
  private readonly TIKTOK_API_URL = 'http://localhost:9080/send';
  private state: PlatformState;

  constructor(botUserId: string) {
    this.state = {
      lastGiftResponse: 0,
      lastAgeResponse: 0,
      lastUhyoResponse: 0,
      botUserId
    };
  }

  async initialize(_config: any): Promise<boolean> {
    // 現時点では特に初期化は必要ない
    return true;
  }

  async postMessage(message: string): Promise<void> {
    try {
      await axios.post(this.TIKTOK_API_URL, { text: message });
    } catch (error) {
      console.error('TikTokメッセージの送信に失敗しました:', error);
      throw error;
    }
  }

  async postThanksMessage(comment: Comment): Promise<void> {
    const messages = [
      `@${comment.data.displayName} さん、ナイギフです！`,
      `@${comment.data.displayName} さん、Nice Gift！`,
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    await this.postMessage(randomMessage);
  }

  getPlatformName(): string {
    return 'tiktok';
  }

  getState(): PlatformState {
    return this.state;
  }
} 