import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Comment } from "@onecomme.com/onesdk/types/Comment"

interface OneCommeWebSocketMessage {
  type: string;
  data: any;
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket;

  constructor(private readonly url: string) {
    super();
    this.ws = new WebSocket(this.url);
    this.connect();
  }

  private connect(): void {
    this.ws.on('open', () => {
      console.log('WebSocket接続が確立されました');
    });

    this.ws.on('message', (data: string) => {
      try {
        const message: OneCommeWebSocketMessage = JSON.parse(data);
        switch (message.type) {
          case "comments":
            const comments = message.data.comments as Comment[]
            this.emit('comments', comments);
        }
      } catch (error) {
        console.error('メッセージの解析に失敗しました:', error);
      }
    });

    this.ws.on('error', (error) => {
      console.error('WebSocketエラー:', error);
    });

    this.ws.on('close', () => {
      console.log('WebSocket接続が切断されました。再接続を試みます...');
      setTimeout(() => this.connect(), 5000);
    });
  }
}