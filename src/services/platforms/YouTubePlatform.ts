import { IChatPlatform, PlatformState, PlatformItems } from '../IChatPlatform';
import { YouTubeService } from '../YouTubeService';
import { Comment } from "@onecomme.com/onesdk/types/Comment";
import youtubeMessages from '../../../static/donation-messages/youtube.json';

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
      spamCooldowns: {
        greeting: 0,
        repeat: 0
      },
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

  async postThanksMessage(comment: Comment): Promise<void> {
    await this.postMessage(`${comment.data.displayName} さん、ナイスパ！`);
  }

  getPlatformName(): string {
    return 'youtube';
  }

  getState(): PlatformState {
    return this.state;
  }

  getDemandItems(): PlatformItems {
    return {
      light: ["スパチャ"],
      medium: ["1000円"],
      heavy: ["虹スパ10連", "5万赤スパ", "10万ぐらいスパチャ"]
    };
  }

  getDonationMessages(): { [lang: string]: string[] } {
    return youtubeMessages;
  }
} 