import * as cheerio from 'cheerio';
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
  private lastUhyoResponse: number = 0;
  private readonly AGE_COOLDOWN = 60 * 1000 * 5; // 5分
  private readonly UHYO_COOLDOWN = 60 * 1000 * 5; // 5分
  private commentQueue: Comment[] = [];
  private isProcessing: boolean = false;
  private readonly MAX_QUEUE_SIZE = 20;
  private readonly MESSAGE_INTERVAL = 10000; // 10秒
  private readonly QUEUE_INTERVAL = 60 * 1000; // 1分
  private readonly PROMOTION_INTERVAL = 30 * 60 * 1000; // 30分
  private readonly PROMOTION_INITIAL_DELAY = 15 * 60 * 1000; // 15分

  constructor(wsUrl: string, hiroyukiUserId: string) {
    this.wsClient = new WebSocketClient(wsUrl);
    this.hiroyuki = new HiroyukiBot();
    this.youtubeService = new YouTubeService();
    this.hiroyukiUserId = hiroyukiUserId;
    this.initialize();
    this.processQueue();
    setTimeout(() => this.startPromotionMessage(), this.PROMOTION_INITIAL_DELAY);
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
      comments.forEach(comment => {
        this.handleMessage(comment);
      });
    });
  }

  private async handleMessage(comment: Comment): Promise<void> {
    if (comment.data.userId === this.hiroyukiUserId) return;
    if (comment.service !== "youtube") return;

    // スーパーチャットの場合は即座に反応
    if (comment.data.hasGift) {
      await this.youtubeService.postChatMessage("ナイスパ！");
      console.log('スパチャへの反応を送信しました');
      return;
    }

    console.log('コメントがきたのでキューに入れます')

    // キューが最大サイズを超える場合は古いコメントを削除
    if (this.commentQueue.length >= this.MAX_QUEUE_SIZE) {
      this.commentQueue = this.commentQueue.slice(-this.MAX_QUEUE_SIZE + 1);
    }
    this.commentQueue.push(comment);
  }

  private removeHtmlTags(text: string): string {
    // HTMLをパース
    const $ = cheerio.load(text);

    let result = $('span[data-lang="ja"]').text();

    if (!result) {
      result = $('span.origin').text();
    }
    if (!result) {
      result = text;
    }

    return result
      .replace(/^[(（]/, '')
      .replace(/[)）]$/, '')
      .replace(/[\r\n]/g, '');
  }

  private async processQueue() {
    console.log('キューの処理開始');
    if (this.isProcessing) return;

    this.isProcessing = true;
    try {
      if (this.commentQueue.length === 0) {
        console.log('キューが空なのでスキップします');
        return;
      }

      const commentsToProcess = [...this.commentQueue];
      this.commentQueue = [];

      console.log('コメントがきてたのでOpenAIに送ります');
      const result = await this.hiroyuki.processBatchComments(
        commentsToProcess.map(c => this.removeHtmlTags(c.data.comment))
      );

      // レスポンスを順番に処理
      for (let i = 0; i < result.comments.length; i++) {
        const { detection, message } = result.comments[i];
        const comment = commentsToProcess[i];
        
        if (!message) continue;

        if (detection === "age") {
          const now = Date.now();
          if (now - this.lastAgeResponse < this.AGE_COOLDOWN) {
            console.log('年齢関連の反応はクールダウン中です');
            continue;
          }
          this.lastAgeResponse = now;
        }

        if (detection === "hiroyuki") {
          const now = Date.now();
          if (now - this.lastUhyoResponse < this.UHYO_COOLDOWN) {
            console.log('うひょ反応はクールダウン中です');
            continue;
          }
          this.lastUhyoResponse = now;
        }

        if (detection === "demand") {
          await this.youtubeService.postChatMessage(`${comment.data.name} さん、${message}`);
        } else {
          await this.youtubeService.postChatMessage(message);
        }
        console.log(`Input: ${this.removeHtmlTags(comment.data.comment)} | Detection: ${detection} | Output: ${message}`);
        
        await new Promise(resolve => setTimeout(resolve, this.MESSAGE_INTERVAL));
      }
    } catch (error) {
      console.error('キュー処理中にエラーが発生しました:', error);
    } finally {
      this.isProcessing = false;
      // 次の実行をスケジュール
      setTimeout(() => this.processQueue(), this.QUEUE_INTERVAL);
    }
  }

  private startPromotionMessage(): void {
    const promotionMessages: [string, string[]] = [
      "みなさん、ぁゃぴさんのこと気に入ったら、\"いいね\"とかチャンネル登録とか、スパチャとかして頂けると。暇だったらハートの連打もしてくれると、うれしいんすよね。",
      [
        "ぁゃぴさんは公式サイトに、長大なプロフィールがあるんすよね。暇つぶしに見てみるといいんじゃないですかね。あとX(旧Twitter)もよく投稿してるので、フォローしといた方がいいと思いますけどね。",
        "ぁゃぴさんは、\"西村博之\"っていう曲を作ってMusic Videoまで公開してるんすよね。クオリティー高いらしいんで、見たほうがいいんじゃないすかね。おいらは共感性羞恥で5秒も見てられなかったですけど。"
      ]
    ];
    
    let secondMessageIndex = 0;  // 2つ目のメッセージを交互に切り替えるためのインデックス
    
    const postPromotion = async () => {
      if (this.currentYoutubeUrl) {
        // 1つ目のメッセージを投稿
        await this.youtubeService.postChatMessage(promotionMessages[0]);
        console.log('定期メッセージ1を投稿しました');

        // 10秒待機
        await new Promise(resolve => setTimeout(resolve, 10000));

        // 2つ目のメッセージを投稿（交互に切り替え）
        await this.youtubeService.postChatMessage(promotionMessages[1][secondMessageIndex]);
        console.log(`定期メッセージ2-${secondMessageIndex + 1}を投稿しました`);
        
        // 次回用にインデックスを切り替え
        secondMessageIndex = (secondMessageIndex + 1) % 2;
      }
    };

    // 初回実行
    postPromotion();
    // 30分ごとに実行
    setInterval(postPromotion, this.PROMOTION_INTERVAL);
  }
}