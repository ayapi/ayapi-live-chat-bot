import dotenv from 'dotenv';
import { createObjectCsvWriter } from 'csv-writer';
import { ChatArchiveDownloader } from './services/YouTubeChatArchiveDownloader';
import { HiroyukiBot } from './services/Hiroyuki';
import fs from 'fs/promises';

dotenv.config();

interface ChatMessage {
  timestamp: string;
  username: string;
  message: string;
  detection: string;
}

async function analyzeLiveChat(videoUrl: string, outputPath: string) {
  const downloader = new ChatArchiveDownloader();
  const bot = new HiroyukiBot();
  const messages: ChatMessage[] = [];

  try {
    // yt-dlpのセットアップ
    await downloader.initialize();

    // URLからvideoIdを抽出
    const videoId = videoUrl.split('v=')[1];
    if (!videoId) {
      throw new Error('無効なYouTube URL');
    }

    console.log('チャットログのダウンロードを開始します...');
    const chatMessages = await downloader.downloadChat(videoId);

    console.log('チャットログの分析を開始します...');
    let processedCount = 0;

    for (const item of chatMessages) {
      const detection = await bot.getCommentType(item.message);

      messages.push({
        ...item,
        detection
      });

      processedCount++;
      if (processedCount % 10 === 0) {
        console.log(`${processedCount}件のメッセージを処理しました`);
        await saveToCSV(messages, outputPath);
      }

      // API制限を考慮して待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await saveToCSV(messages, outputPath);
    showStatistics(messages);

  } catch (error) {
    console.error('エラーが発生しました:', error);
    if (messages.length > 0) {
      await saveToCSV(messages, outputPath);
    }
  }
}

async function saveToCSV(messages: ChatMessage[], outputPath: string) {
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'timestamp', title: 'TIMESTAMP' },
      { id: 'username', title: 'USERNAME' },
      { id: 'message', title: 'MESSAGE' },
      { id: 'detection', title: 'DETECTION' }
    ]
  });

  await csvWriter.writeRecords(messages);
  console.log(`結果を${outputPath}に保存しました`);
}

function showStatistics(messages: ChatMessage[]) {
  const stats = messages.reduce((acc, msg) => {
    acc[msg.detection] = (acc[msg.detection] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n=== 判定結果の統計 ===');
  Object.entries(stats).forEach(([type, count]) => {
    const percentage = ((count / messages.length) * 100).toFixed(2);
    console.log(`${type}: ${count}件 (${percentage}%)`);
  });
}

// コマンドライン引数からURLを取得
const videoUrl = process.argv[2];
if (!videoUrl) {
  console.error('使用方法: ts-node src/analyze-live.ts <YOUTUBE_URL>');
  process.exit(1);
}

analyzeLiveChat(
  videoUrl,
  `output/analyzed_chat_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
).catch(console.error);