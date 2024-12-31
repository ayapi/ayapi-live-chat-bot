import { Comment } from "@onecomme.com/onesdk/types/Comment"
import { WebSocketClient } from './services/WebSocketClient';
import { HiroyukiBot } from "./services/Hiroyuki";

export class ChatWatcher {
  private wsClient: WebSocketClient;
  private hiroyuki: HiroyukiBot;

  constructor(wsUrl: string) {
    this.wsClient = new WebSocketClient(wsUrl);
    this.hiroyuki = new HiroyukiBot();
    this.initialize();
  }

  private initialize(): void {
    this.wsClient.on('comments', (comments: Comment[]) => {
      comments.forEach((comment) => {
        this.handleMessage(comment);
      })
    });
  }

  private async handleMessage(comment: Comment): Promise<void> {
    if (comment.service !== "youtube") return;
    if (comment.data.hasGift) return;

    const { detection, message } = await this.hiroyuki.generateResponse(comment.data.comment);
    if (message) {
      console.log(`Input: ${comment.data.comment} | Detection: ${detection} | Output: ${message}`);
    }
  }
}