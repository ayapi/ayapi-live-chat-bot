import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import express from 'express';
import { Server } from 'http';
import * as fs from 'fs/promises';
import * as path from 'path';

export class YouTubeService {
  private oauth2Client: OAuth2Client;
  private static readonly TOKEN_PATH = path.join(process.cwd(), 'credentials', 'token.json');
  private youtube: any;  // google.youtube のインスタンス
  private liveChatId: string | null = null;
  private server: Server | null = null;
  
  constructor() {
    this.oauth2Client = new OAuth2Client(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI
    );
  }

  private async initializeYouTubeAPI(): Promise<boolean> {
    try {
      const auth = await this.authenticate();
      if (!auth) return false;

      this.youtube = google.youtube({ 
        version: 'v3',
        auth: this.oauth2Client
      });
      
      return true;
    } catch (err) {
      console.error('YouTube APIの初期化に失敗しました:', err);
      return false;
    }
  }

  async initializeWithUrl(youtubeUrl: string): Promise<boolean> {
    try {
      // まずYouTube APIを初期化
      if (!this.youtube) {
        const initialized = await this.initializeYouTubeAPI();
        if (!initialized) return false;
      }

      // その後でライブチャットIDを取得
      this.liveChatId = await this.getLiveChatIdFromUrl(youtubeUrl);
      return this.liveChatId !== null;
    } catch (err) {
      console.error('初期化に失敗しました:', err);
      return false;
    }
  }

  async postChatMessage(message: string): Promise<boolean> {
    try {
      if (!this.youtube || !this.liveChatId) {
        console.error('YouTubeサービスが初期化されていません');
        return false;
      }

      await this.youtube.liveChatMessages.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            liveChatId: this.liveChatId,
            type: 'textMessageEvent',
            textMessageDetails: {
              messageText: message,
            },
          },
        },
      });

      return true;
    } catch (err) {
      console.error('メッセージの投稿に失敗しました:', err);
      return false;
    }
  }

  private async loadSavedCredentials(): Promise<any | null> {
    try {
      const content = await fs.readFile(YouTubeService.TOKEN_PATH);
      const credentials = JSON.parse(content.toString());
      return credentials;
    } catch (err) {
      return null;
    }
  }

  private async saveCredentials(tokens: any): Promise<void> {
    try {
      await fs.mkdir(path.dirname(YouTubeService.TOKEN_PATH), { recursive: true });
      await fs.writeFile(YouTubeService.TOKEN_PATH, JSON.stringify(tokens));
    } catch (err) {
      console.error('トークンの保存に失敗しました:', err);
    }
  }

  private async startCallbackServer(): Promise<string> {
    return new Promise((resolve) => {
      const app = express();
      
      app.get('/oauth2callback', (req, res) => {
        const code = req.query.code as string;
        res.send('認証が完了しました。このページを閉じてください。');
        this.server?.close();
        resolve(code);
      });

      this.server = app.listen(3000, () => {
        console.log('コールバックサーバーを開始しました');
      });
    });
  }

  async authenticate(): Promise<OAuth2Client | null> {
    const savedCredentials = await this.loadSavedCredentials();

    if (savedCredentials) {
      this.oauth2Client.setCredentials(savedCredentials);
      // リフレッシュトークンを使って新しいアクセストークンを取得
      try {
        await this.oauth2Client.getAccessToken();
        return this.oauth2Client;
      } catch (err) {
        console.error('保存された認証情報が無効です。再認証が必要です。');
      }
    }

    // 新規認証の場合
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube.force-ssl']
    });

    console.log('以下のURLをブラウザで開いてください:');
    console.log(authUrl);

    // コールバックサーバーを起動して認証コードを待機
    const code = await this.startCallbackServer();
    
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      await this.saveCredentials(tokens);
      return this.oauth2Client;
    } catch (err) {
      console.error('認証に失敗しました:', err);
      return null;
    }
  }

  // ユーザー入力を待つためのヘルパーメソッド
  private async waitForUserInput(prompt: string): Promise<string> {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      readline.question(prompt, (answer: string) => {
        readline.close();
        resolve(answer);
      });
    });
  }

  private async getLiveChatIdFromVideoId(videoId: string): Promise<string | null> {
    try {
      const response = await this.youtube.videos.list({
        part: ['liveStreamingDetails'],
        id: [videoId]
      });

      if (!response.data.items || response.data.items.length === 0) {
        console.error('ライブ配信が見つかりません');
        return null;
      }

      const liveChatId = response.data.items[0].liveStreamingDetails?.activeLiveChatId;
      if (!liveChatId) {
        console.error('このビデオはライブ配信ではないか、チャットが無効になっています');
        return null;
      }

      return liveChatId;
    } catch (err) {
      console.error('ライブチャットIDの取得に失敗しました:', err);
      return null;
    }
  }

  // URLからビデオIDを抽出するヘルパーメソッド
  private extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu.be\/)([^&\n?#]+)/,
      /youtube.com\/live\/([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  private async getChannelIdFromHandle(handle: string): Promise<string | null> {
    try {
      // @を削除
      const username = handle.replace('@', '');
      
      const response = await this.youtube.search.list({
        part: ['snippet'],
        q: handle,
        type: ['channel'],
        maxResults: 1
      });

      if (!response.data.items || response.data.items.length === 0) {
        console.error('チャンネルが見つかりません');
        return null;
      }

      return response.data.items[0].snippet.channelId;
    } catch (err) {
      console.error('チャンネルIDの取得に失敗しました:', err);
      return null;
    }
  }

  private async getLiveChatIdFromChannel(channelId: string): Promise<string | null> {
    try {
      const response = await this.youtube.search.list({
        part: ['snippet'],
        channelId: channelId,
        eventType: 'live',
        type: ['video'],
        maxResults: 1
      });

      if (!response.data.items || response.data.items.length === 0) {
        console.error('アクティブなライブ配信が見つかりません');
        return null;
      }

      const videoId = response.data.items[0].id.videoId;
      return await this.getLiveChatIdFromVideoId(videoId);
    } catch (err) {
      console.error('ライブ配信の検索に失敗しました:', err);
      return null;
    }
  }

  private extractChannelHandle(url: string): string | null {
    const handlePattern = /youtube\.com\/@([^\/\n?#]+)/;
    const match = url.match(handlePattern);
    return match ? `@${match[1]}` : null;
  }

  // URLパターンの判定を更新
  private async getLiveChatIdFromUrl(url: string): Promise<string | null> {
    // 動画IDを直接取得できる場合
    const videoId = this.extractVideoId(url);
    if (videoId) {
      return await this.getLiveChatIdFromVideoId(videoId);
    }

    // チャンネルハンドルの場合
    const handle = this.extractChannelHandle(url);
    if (handle) {
      const channelId = await this.getChannelIdFromHandle(handle);
      if (channelId) {
        return await this.getLiveChatIdFromChannel(channelId);
      }
    }

    console.error('サポートされていないURL形式です');
    return null;
  }

  static isYouTubeUrl(url: string): boolean {
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/,
      /^https?:\/\/(www\.)?youtube\.com\/@[\w-]+/
    ];

    return patterns.some(pattern => pattern.test(url));
  }
}