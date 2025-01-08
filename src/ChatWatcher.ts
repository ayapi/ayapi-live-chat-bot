import * as cheerio from 'cheerio';
import { WebSocketClient } from './services/WebSocketClient';
import { HiroyukiBot } from "./services/Hiroyuki";
import { IChatPlatform } from './services/IChatPlatform';
import { YouTubePlatform } from './services/platforms/YouTubePlatform';
import { TikTokPlatform } from './services/platforms/TikTokPlatform';
import { TwitcastingPlatform } from './services/platforms/TwitcastingPlatform';
import { Comment } from "@onecomme.com/onesdk/types/Comment";
import { Service } from "@onecomme.com/onesdk/types/Service";
import { SpamDetector } from './services/SpamDetector';

export class ChatWatcher {
  private wsClient: WebSocketClient;
  private hiroyuki: HiroyukiBot;
  private spamDetector: SpamDetector;
  private platforms: Map<string, IChatPlatform> = new Map();
  private commentQueue: Comment[] = [];
  private isProcessing: boolean = false;
  private readonly MAX_QUEUE_SIZE = 20;
  private readonly MESSAGE_INTERVAL = 10000; // 10秒
  private readonly QUEUE_INTERVAL = 30 * 1000;
  private readonly PROMOTION_INTERVAL = 30 * 60 * 1000; // 30分
  private readonly PROMOTION_INITIAL_DELAY = 15 * 60 * 1000; // 15分
  private readonly COOLDOWN_DURATION = 60 * 1000 * 5; // 5分
  private readonly SPAM_COOLDOWN_DURATION = 60 * 1000 * 3;

  constructor(wsUrl: string, platformConfigs: { [key: string]: any }) {
    this.wsClient = new WebSocketClient(wsUrl);
    this.hiroyuki = new HiroyukiBot();
    this.spamDetector = new SpamDetector();
    this.initializePlatforms(platformConfigs);
    this.initialize();
    this.processQueue();
    setTimeout(() => this.startPromotionMessage(), this.PROMOTION_INITIAL_DELAY);
  }

  private initializePlatforms(configs: { [key: string]: any }): void {
    if (configs.youtube) {
      this.platforms.set('youtube', new YouTubePlatform(configs.youtube.botUserId));
    }
    if (configs.tiktok) {
      this.platforms.set('tiktok', new TikTokPlatform(configs.tiktok.botUserId));
    }
    if (configs.twitcasting) {
      this.platforms.set('twicas', new TwitcastingPlatform(configs.twitcasting.botUserId));
    }
  }

  private async initialize(): Promise<void> {
    this.wsClient.on('services', async (services: Service[]) => {
      for (const service of services) {
        const platform = this.getPlatformForUrl(service.url);
        if (platform) {
          await platform.initialize({ url: service.url });
        }
      }
    });

    this.wsClient.on('comments', (comments: Comment[]) => {
      comments.forEach(comment => {
        const platform = this.platforms.get(comment.service);
        if (!platform) return;

        this.handleMessage(comment);
      });
    });
  }

  private getPlatformForUrl(url: string): IChatPlatform | null {
    if (url && url.includes('youtube.com')) {
      return this.platforms.get('youtube') || null;
    }
    if (url && url.includes('tiktok.com')) {
      return this.platforms.get('tiktok') || null;
    }
    if (url && url.includes('twitcasting.tv')) {
      return this.platforms.get('twicas') || null;
    }
    return null;
  }

  private async handleMessage(comment: Comment): Promise<void> {
    const platform = this.platforms.get(comment.service);
    if (!platform) return;

    const state = platform.getState();
    if (comment.data.userId === state.botUserId) return;

    if (comment.data.hasGift) {
      await platform.postThanksMessage(comment);
      return;
    }

    if (this.commentQueue.length >= this.MAX_QUEUE_SIZE) {
      this.commentQueue = this.commentQueue.slice(-this.MAX_QUEUE_SIZE + 1);
    }
    this.commentQueue.push(comment);
  }

  private removeHtmlTags(text: string): string {
    // HTMLをパース
    const $ = cheerio.load(text);

    // img要素のalt属性を実際のテキストに置換
    $('img').each((_, el) => {
      const alt = $(el).attr('alt');
      if (alt) {
        $(el).replaceWith(alt);
      }
    });

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
    if (this.isProcessing) return;

    this.isProcessing = true;
    try {
      if (this.commentQueue.length === 0) return;

      const commentsToProcess = [...this.commentQueue];
      this.commentQueue = [];

      const commentPlatforms = commentsToProcess.map(comment => ({
        comment,
        platform: this.platforms.get(comment.service)
      })).filter((pair): pair is { comment: Comment, platform: IChatPlatform } =>
        pair.platform !== undefined
      );

      if (commentPlatforms.length === 0) return;

      console.log('\n=== 処理開始 ===');

      // スパムチェックと処理
      for (const { comment, platform } of commentPlatforms) {
        const cleanedMessage = this.removeHtmlTags(comment.data.comment);
        console.log(`[Input] ${cleanedMessage}`);

        // スパムチェック
        const spamResult = this.spamDetector.detect(comment.data.userId, cleanedMessage);
        
        if (spamResult.isSpam) {
          console.log(`[Detection] ${spamResult.type}`);
          
          const state = platform.getState();
          const now = Date.now();
          
          // スパムタイプに応じたクールダウンチェック
          if (spamResult.type === 'greeting_spam' && now - state.spamCooldowns.greeting < this.SPAM_COOLDOWN_DURATION) {
            console.log(`[Skip] ${comment.service}での挨拶スパム警告のクールダウン中`);
            continue;
          }
          if (spamResult.type === 'repetitive' && now - state.spamCooldowns.repeat < this.SPAM_COOLDOWN_DURATION) {
            console.log(`[Skip] ${comment.service}での連投警告のクールダウン中`);
            continue;
          }

          const spamMessage = spamResult.type === 'greeting_spam'
            ? "ぁゃぴさんの配信は馴れ合い禁止です。視聴者さん同士の挨拶、リプライはお控えください。"
            : "連投するのやめてもらっていいすか？続けるようならブロックします、はいすいません。。。";
          
          // クールダウンを更新
          if (spamResult.type === 'greeting_spam') {
            state.spamCooldowns.greeting = now;
          } else {
            state.spamCooldowns.repeat = now;
          }
          
          console.log(`[Output] ${spamMessage}`);
          await platform.postMessage(spamMessage);
          await new Promise(resolve => setTimeout(resolve, this.MESSAGE_INTERVAL));
          continue;
        }

        // 通常の処理
        const result = await this.hiroyuki.processBatchComments(
          [cleanedMessage],
          [platform]
        );

        const { detection, message } = result.comments[0];
        console.log(`[Detection] ${detection}`);
        console.log(`[Response] ${message || 'null'}`);

        if (!message) {
          console.log(`[Skip] メッセージがnullのためスキップ`);
          continue;
        }

        const state = platform.getState();
        const now = Date.now();

        // クールダウンチェック
        if (detection === "age" && now - state.lastAgeResponse < this.COOLDOWN_DURATION) {
          console.log(`[Skip] ageレスポンスのクールダウン中`);
          continue;
        }
        if (detection === "hiroyuki" && now - state.lastUhyoResponse < this.COOLDOWN_DURATION) {
          console.log(`[Skip] hiroyukiレスポンスのクールダウン中`);
          continue;
        }

        if (detection === "age") state.lastAgeResponse = now;
        if (detection === "hiroyuki") state.lastUhyoResponse = now;

        const finalMessage = detection === "demand"
          ? comment.service === "tiktok"
            ? `@${comment.data.displayName} さん、${message}`
            : `${comment.data.displayName} さん、${message}`
          : message;

        console.log(`[Output] ${finalMessage}`);
        await platform.postMessage(finalMessage);
        await new Promise(resolve => setTimeout(resolve, this.MESSAGE_INTERVAL));
      }

      console.log('=== 処理終了 ===\n');
    } catch (error) {
      console.error('キュー処理中にエラーが発生しました:', error);
    } finally {
      this.isProcessing = false;
      setTimeout(() => this.processQueue(), this.QUEUE_INTERVAL);
    }
  }

  private async startPromotionMessage(): Promise<void> {
    const promotionMessages: [string, string[]] = [
      "みなさん、ぁゃぴさんのこと気に入ったら、\"いいね\"とかチャンネル登録とか、スパチャとかして頂けると。暇だったらハートの連打もしてくれると、うれしいんすよね。",
      [
        "ぁゃぴさんは公式サイトに、長大なプロフィールがあるんすよね。暇つぶしにはいいんじゃないですかね。あとXもよく投稿してるので、フォローした方がいいと思いますけどね。",
        "ぁゃぴさんは、\"西村博之\"っていう曲を作ってMusic Videoまで公開してるんすよね。クオリティー高いらしいんすよね。おいらは共感性羞恥で5秒も見てられなかったですけど。"
      ]
    ];
    
    let secondMessageIndex = 0;  // 2つ目のメッセージを交互に切り替えるためのインデックス
    
    const postPromotion = async () => {
      const platform = this.platforms.get('youtube');
      if (platform) {
        // 1つ目のメッセージを投稿
        await platform.postMessage(promotionMessages[0]);
        console.log('定期メッセージ1を投稿しました');

        // 10秒待機
        await new Promise(resolve => setTimeout(resolve, 10000));

        // 2つ目のメッセージを投稿（交互に切り替え）
        await platform.postMessage(promotionMessages[1][secondMessageIndex]);
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