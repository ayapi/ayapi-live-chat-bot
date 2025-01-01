import { Comment } from "@onecomme.com/onesdk/types/Comment"
import { Service } from "@onecomme.com/onesdk/types/Service"
import { WebSocketClient } from './services/WebSocketClient';
import { HiroyukiBot } from "./services/Hiroyuki";
import { YouTubeService } from "./services/YouTubeService";

export class ChatWatcher {
  private wsClient: WebSocketClient;
  private hiroyuki: HiroyukiBot;
  private hiroyukiUserId: string;
  private youtubeService: YouTubeService;
  private currentYoutubeUrl: string | null = null;
  private lastAgeResponse: number = 0;
  private readonly AGE_COOLDOWN = 60 * 1000 * 5; // 5分。ミリ秒にする

  constructor(wsUrl: string, hiroyukiUserId: string) {
    this.wsClient = new WebSocketClient(wsUrl);
    this.hiroyuki = new HiroyukiBot();
    this.youtubeService = new YouTubeService();
    this.hiroyukiUserId = hiroyukiUserId;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // 枠情報の監視
    this.wsClient.on('services', async (services: Service[]) => {
      const youtubeService = services.find(service => 
        service.url && YouTubeService.isYouTubeUrl(service.url)
      );

      if (!youtubeService?.url) return;

      if (this.currentYoutubeUrl !== youtubeService.url) {
        this.currentYoutubeUrl = youtubeService.url;
        const initialized = await this.youtubeService.initializeWithUrl(youtubeService.url);
        if (!initialized) {
          console.error('YouTubeサービスの初期化に失敗しました');
        } else {
          console.log(`YouTube URL: ${youtubeService.url} で初期化しました`);
        }
      }
    });

    // コメントの監視
    this.wsClient.on('comments', (comments: Comment[]) => {
      comments.forEach((comment) => {
        if (comment.data.userId === this.hiroyukiUserId) return;
        
        // console.log('コメントが届きました', comment)
        this.handleMessage(comment);
      });
    });
  }

  private async handleMessage(comment: Comment): Promise<void> {
    if (comment.service !== "youtube") return;
    if (comment.data.hasGift) return;

    const { detection, message } = await this.hiroyuki.generateResponse(comment.data.comment);
    
    if (!message) return;

    if (detection === "age") {
      const now = Date.now();
      if (now - this.lastAgeResponse < this.AGE_COOLDOWN) {
        console.log('年齢関連の反応はクールダウン中です');
        return;
      }
      this.lastAgeResponse = now;
    }

    if (detection === "demand") {
      await this.youtubeService.postChatMessage(`${comment.data.name} さん、${message}`);
    }
    await this.youtubeService.postChatMessage(message);
    console.log(`Input: ${comment.data.comment} | Detection: ${detection} | Output: ${message}`);
  }
}