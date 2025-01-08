import * as levenshtein from 'fast-levenshtein';
import { CommentHistory, HistoryComment } from './CommentHistory';
import { ReplyDetector } from './ReplyDetector';

export interface SpamDetectionResult {
  isSpam: boolean;
  type: 'repetitive' | 'greeting_spam' | null;
  score: number;
}

export class SpamDetector {
  private history: CommentHistory;
  private readonly REPEAT_THRESHOLD = 3;    // 連投の閾値
  private readonly GREETING_THRESHOLD = 2;  // 挨拶の閾値
  private readonly SIMILARITY_THRESHOLD = 3; // レーベンシュタイン距離の閾値

  constructor() {
    this.history = new CommentHistory();
  }

  detect(userId: string, message: string): SpamDetectionResult {
    // 履歴に追加
    this.history.addComment({
      userId,
      message,
      timestamp: Date.now()
    });

    // 最近のコメントを取得（5分以内）
    const recentComments = this.history.getRecentComments(userId);

    // 挨拶リプライのチェック
    if (ReplyDetector.detectGreetingReply(message)) {
      const greetingCount = recentComments.filter(c => 
        ReplyDetector.detectGreetingReply(c.message)
      ).length;

      if (greetingCount >= this.GREETING_THRESHOLD) {
        return {
          isSpam: true,
          type: 'greeting_spam',
          score: greetingCount
        };
      }
    }

    // 連投チェック
    const similarMessages = recentComments.filter(c => 
      this.isSimilarMessage(c.message, message)
    );

    if (similarMessages.length >= this.REPEAT_THRESHOLD) {
      return {
        isSpam: true,
        type: 'repetitive',
        score: similarMessages.length
      };
    }

    return {
      isSpam: false,
      type: null,
      score: 0
    };
  }

  private isSimilarMessage(a: string, b: string): boolean {
    if (a === b) return true;
    if (a.replace(/\s+/g, '') === b.replace(/\s+/g, '')) return true;
    return levenshtein.get(a, b) <= this.SIMILARITY_THRESHOLD;
  }

  clear(): void {
    this.history.clear();
  }
} 