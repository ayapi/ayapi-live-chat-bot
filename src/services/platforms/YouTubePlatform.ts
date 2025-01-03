import { IChatPlatform, PlatformState } from '../IChatPlatform';
import { YouTubeService } from '../YouTubeService';
import { Comment } from "@onecomme.com/onesdk/types/Comment";

export class YouTubePlatform implements IChatPlatform {
  private youtubeService: YouTubeService;
  private state: PlatformState;
  private currentUrl: string | null = null;

  constructor(botUserId: string) {
    this.youtubeService = new YouTubeService();
    this.state = {
      lastGiftResponse: 0,
      lastAgeResponse: 0,
      lastUhyoResponse: 0,
      botUserId
    };
  }

  async initialize(config: { url: string }): Promise<boolean> {
    if (this.currentUrl === config.url) return true;
    this.currentUrl = config.url;
    return await this.youtubeService.initializeWithUrl(config.url);
  }

  async postMessage(message: string): Promise<void> {
    await this.youtubeService.postChatMessage(message);
  }

  getPlatformName(): string {
    return 'youtube';
  }

  getState(): PlatformState {
    return this.state;
  }

  convertToComment(youtubeComment: any): Comment {
    return youtubeComment; // YouTubeのコメントは既にわんコメのComment型
  }
} 