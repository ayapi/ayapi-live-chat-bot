import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import express from 'express';
import { Server } from 'http';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface YouTubeChatItem {
  snippet?: {
    type?: string;
    liveChatId?: string;
    publishedAt?: string;
    authorChannelId?: string;
    textDisplay?: string;
    textMessageDetails?: {
      messageText?: string;
    };
  };
  authorDetails?: {
    displayName?: string;
    channelId?: string;
    channelUrl?: string;
    profileImageUrl?: string;
    isVerified?: boolean;
    isChatOwner?: boolean;
    isChatSponsor?: boolean;
    isChatModerator?: boolean;
  };
}

// アーカイブとライブの両方に対応した共通の出力型
export interface ChatMessage {
  timestamp: string;
  username: string;
  message: string;
}

interface ChatParams {
  part: string[];
  liveChatId: string;
  maxResults: number;
  pageToken?: string;  // オプショナルプロパティとして追加
}

export class YouTubeService {
  private oauth2Client: OAuth2Client;
  private static readonly TOKEN_PATH = path.join(process.cwd(), 'credentials', 'token.json');
  private youtube: any;  // google.youtube のインスタンス
  private liveChatId: string | null = null;
  private videoId: string | null = null;  // 追加
  private server: Server | null = null;
  private chatId: string | null = null;
  private isArchived: boolean = false;
  
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
      this.videoId = videoId;
      
      // まずビデオの情報を取得
      const response = await this.youtube.videos.list({
        part: ['liveStreamingDetails', 'snippet'],
        id: [videoId]
      });

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('ビデオが見つかりません');
      }

      const videoInfo = response.data.items[0];

      // 現在進行中のライブ配信の場合
      const liveChatId = videoInfo.liveStreamingDetails?.activeLiveChatId;
      if (liveChatId) {
        console.log('現在進行中のライブ配信を検出しました');
        this.isArchived = false;
        this.chatId = liveChatId;
        return liveChatId;
      }

      // アーカイブされたライブ配信の場合
      if (videoInfo.snippet?.liveBroadcastContent === 'none' && 
          videoInfo.liveStreamingDetails?.actualEndTime) {
        console.log('アーカイブされたライブ配信を検出しました');
        this.isArchived = true;
        const chatReplayId = await this.getChatReplayId(videoId);
        if (chatReplayId) {
          this.chatId = chatReplayId;
          return chatReplayId;
        }
      }

      throw new Error('このビデオのチャットにアクセスできません');

    } catch (err) {
      console.error('LiveChatIDの取得に失敗しました:', err);
      return null;
    }
  }

  private async getChatReplayId(videoId: string): Promise<string | null> {
    try {
      // チャットリプレイIDを取得
      const response = await this.youtube.videos.list({
        part: ['liveStreamingDetails'],
        id: [videoId]
      });

      const chatReplayId = response.data.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
      if (!chatReplayId) {
        throw new Error('チャットリプレイIDが見つかりません');
      }

      return chatReplayId;

    } catch (error) {
      console.error('チャットリプレイIDの取得に失敗しました:', error);
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

  public async getChatMessages(pageToken?: string): Promise<{
    messages: ChatMessage[];
    nextPageToken?: string;
  }> {
    try {
      if (!this.chatId) {
        throw new Error('ChatIDが設定されていません');
      }

      const params: ChatParams = {
        part: ['snippet', 'authorDetails'],
        liveChatId: this.chatId,
        maxResults: 100
      };

      if (pageToken) {
        params.pageToken = pageToken;
      }

      console.log('APIリクエストパラメータ:', {
        ...params,
        isArchived: this.isArchived
      });

      const response = await this.youtube.liveChatMessages.list(params);

      console.log('APIレスポンス:', {
        pageInfo: response.data.pageInfo,
        nextPageToken: response.data.nextPageToken,
        itemsCount: response.data.items?.length || 0
      });

      const messages = (response.data.items || [])
        .filter((item: YouTubeChatItem) => {
          return item.snippet?.type === 'textMessageEvent';
        })
        .map((item: YouTubeChatItem): ChatMessage => ({
          timestamp: item.snippet?.publishedAt || '',
          username: item.authorDetails?.displayName || '',
          message: item.snippet?.textMessageDetails?.messageText || ''
        }));

      return {
        messages,
        nextPageToken: response.data.nextPageToken
      };

    } catch (error: any) {
      console.error('チャットメッセージの取得に失敗しました');
      if (error.response) {
        console.error('エラーレスポンス:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }
      throw error;
    }
  }
}