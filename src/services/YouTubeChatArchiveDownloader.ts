import YTDlpWrap from 'yt-dlp-wrap';
import fs from 'fs/promises';
import path from 'path';

interface ChatEvent {
  type: string;
  timestamp_usec: number;
  author: {
    name: string;
    id: string;
    images?: {
      url: string;
      width: number;
      height: number;
    }[];
  };
  message: string;
  messageText: string;
  message_id: string;
  time_in_seconds: number;
}

interface ChatJson {
  events: ChatEvent[];
  video_id: string;
  title: string;
  duration_string: string;
}

interface ChatMessage {
  timestamp: string;
  username: string;
  message: string;
}

export class ChatArchiveDownloader {
  private readonly DL_PATH = './bin/yt-dlp.exe';
  private readonly OUTPUT_DIR = './output';

  async initialize(): Promise<void> {
    console.log('yt-dlpのダウンロードを開始します...');
    await YTDlpWrap.downloadFromGithub(this.DL_PATH);
    console.log('yt-dlpのダウンロードが完了しました');

    // 出力ディレクトリの作成
    await fs.mkdir(this.OUTPUT_DIR, { recursive: true });
  }

  async downloadChat(videoId: string): Promise<ChatMessage[]> {
    try {
      await fs.access(this.DL_PATH);
    } catch (error) {
      console.error('yt-dlpの実行ファイルが見つかりません:', this.DL_PATH);
      throw new Error('yt-dlpの実行ファイルが見つかりません。initialize()を実行してください。');
    }

    const ytDlpWrap = new YTDlpWrap(this.DL_PATH);
    const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const outputPath = path.join(this.OUTPUT_DIR, videoId);

    console.log(`チャットの取得を開始: ${targetUrl}`);
    console.log('出力パス:', outputPath);

    try {
      // チャットログのダウンロード
      await new Promise((resolve, reject) => {
        ytDlpWrap
          .exec([
            targetUrl,
            '--skip-download',  // 動画をダウンロードしない
            '--write-subs',     // 字幕を取得
            '--sub-langs', 'live_chat',  // ライブチャットを指定
            '--sub-format', 'json3',    // JSON形式で出力
            '-o', outputPath,           // 出力先を指定
          ])
          .on('ytDlpEvent', (eventType, eventData) =>
            console.log(eventType, eventData)
          )
          .on('error', (error) => reject(error))
          .on('close', () => resolve(true));
      });

      // JSONファイルの読み込み
      const chatFile = `${outputPath}.live_chat.json`;
      console.log('チャットファイルを読み込み:', chatFile);
      
      const chatData = await fs.readFile(chatFile, 'utf-8');
      
      const messages: ChatMessage[] = chatData
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            const data = JSON.parse(line);
            const item = data.replayChatItemAction?.actions?.[0]?.addChatItemAction?.item;
            
            if (item?.liveChatTextMessageRenderer) {
              const renderer = item.liveChatTextMessageRenderer;
              return {
                timestamp: new Date(parseInt(renderer.timestampUsec) / 1000).toISOString(),
                username: renderer.authorName.simpleText,
                message: renderer.message.runs
                  .map((run: { text?: string; emoji?: { emojiId: string } }) => run.text || run.emoji?.emojiId || '')
                  .join('')
              };
            }
            return null;
          } catch (error) {
            return null;
          }
        })
        .filter((msg): msg is ChatMessage => msg !== null);

      console.log(`${messages.length}件のチャットメッセージを取得しました`);
      return messages;

    } catch (error) {
      console.error('チャットの取得に失敗しました:', error);
      throw error;
    }
  }
}