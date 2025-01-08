export interface HistoryComment {
  userId: string;
  message: string;
  timestamp: number;
  replyTo?: string;
}

export class CommentHistory {
  private history: HistoryComment[] = [];
  private readonly MAX_HISTORY = 30;
  
  addComment(comment: HistoryComment): void {
    this.history.push(comment);
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }
  }

  getRecentComments(userId: string, timeWindowMs: number = 5 * 60 * 1000): HistoryComment[] {
    const now = Date.now();
    return this.history.filter(c => 
      c.userId === userId && 
      now - c.timestamp < timeWindowMs
    );
  }

  clear(): void {
    this.history = [];
  }
} 