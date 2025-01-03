import { IChatPlatform, PlatformState } from '../IChatPlatform';
import { Comment } from "@onecomme.com/onesdk/types/Comment";
import dotenv from 'dotenv';

dotenv.config();

export class TwitcastingPlatform implements IChatPlatform {
  private state: PlatformState;
  private accessToken: string;
  private username: string | null = null;
  private currentMovieId: string | null = null;

  constructor(botUserId: string) {
    this.state = {
      lastGiftResponse: 0,
      lastAgeResponse: 0,
      lastUhyoResponse: 0,
      botUserId
    };

    const accessToken = process.env.TWICAS_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('TWICAS_ACCESS_TOKEN is not set in environment variables');
    }
    this.accessToken = accessToken;
  }

  async initialize(config: { url: string }): Promise<boolean> {
    const match = config.url.match(/twitcasting\.tv\/([^\/]*)/);
    if (match) {
      this.username = match[1];

      try {
        const response = await fetch(`https://apiv2.twitcasting.tv/users/${this.username}`, {
          headers: {
            'Accept': 'application/json',
            'X-Api-Version': '2.0',
            'Authorization': `Bearer ${this.accessToken}`
          }
        });

        if (!response.ok) {
          throw new Error(`ユーザー情報の取得に失敗しました: ${response.status}`);
        }

        const data = await response.json();
        if (data.user && data.user.last_movie_id) {
          this.currentMovieId = data.user.last_movie_id;
          return true;
        } else {
          throw new Error('最新の配信IDが見つかりません');
        }
      } catch (error) {
        console.error('ツイキャスのユーザー情報取得に失敗しました:', error);
        return false;
      }
    }
    return false;
  }

  async postMessage(message: string): Promise<void> {
    if (!this.currentMovieId) {
      throw new Error('ライブ配信が見つかりません');
    }

    try {
      const response = await fetch(`https://apiv2.twitcasting.tv/movies/${this.currentMovieId}/comments`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Api-Version': '2.0',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({
          comment: message,
          sns: 'none'
        })
      });

      if (!response.ok) {
        throw new Error(`ツイキャスへのコメント送信に失敗しました: ${response.status}`);
      }
    } catch (error) {
      console.error('ツイキャスへのコメント送信中にエラーが発生しました:', error);
      throw error;
    }
  }

  async postThanksMessage(comment: Comment): Promise<void> {
    const messages = [
      `${comment.data.displayName}さん、ナイス茶！`,
      `${comment.data.displayName}さん、Nice Tea!`,
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    await this.postMessage(randomMessage);
  }

  getPlatformName(): string {
    return 'twitcasting';
  }

  getState(): PlatformState {
    return this.state;
  }

  // APIクライアントの初期化に必要な認証情報を取得
  private getAuthConfig() {
    return {
      clientId: process.env.TWICAS_CLIENT_ID,
      clientSecret: process.env.TWICAS_CLIENT_SECRET,
      redirectUri: process.env.TWICAS_REDIRECT_URI,
      accessToken: this.accessToken
    };
  }
} 