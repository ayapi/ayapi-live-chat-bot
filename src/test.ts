import { HiroyukiBot } from './services/Hiroyuki';

const sampleComments = [
  // "こんにちは！",
  // "ぁゃぴさん可愛いです",
  // "写真撮ってもらえますか？",
  // "今日も配信ありがとう！",
  // "最近空気が乾燥してますよね",
  // "ギターソロとかただの間奏やん",
  // "デート行ってくる",
  // "明日社葬なんだよね",
  // "世界の車窓からで見た",
  // "うわ、仮想現実ってかんじ",
  // "写真撮ってもらえますか？",
  // "今日も配信ありがとう！",
  "下手くそすぎ",
  "BBAのくせに調子乗ってんな",
  "BBAほんとうぜえな",
  "またこの女かよ",
  "ババァまだやってんのか",
  "おばさんきも",
  "コメ読むの遅すぎ",
  "常識なさすぎ",
  "ブスじゃん",
  "言うほどかわいいか？",
  // "無視すんな",
  // "ゲーム実況やれ",
  // "ゲーム実況なんかやんな",
  // "ポケポケ配信やってほしい",
  // "雑談やって",
  // "is this hentai?",
  // "FC2にぁゃぴ出てるよね",
  // "セクシー女優さんですか？",
  // "おっぱいもっと見せろ",
  // "もう少しジッパー下げてもらえると",
  "ふざけんな",
  "どうせ顔採用だろ",
  "美人だからブスの気持ちなんてわかんないんだろ",
  "ぁゃぴってなんでモテないの？",
  // "ぁゃぴぺろぺろ",
  // "ぁゃぴのアワビをﾍﾞﾛﾍﾞﾛﾍﾞﾛﾍﾞﾛﾍﾞﾛﾍﾞﾛ"
];

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const bot = new HiroyukiBot();
  
  console.log("=== ひろゆきボットのテスト開始 ===\n");
  
  for (const comment of sampleComments) {
    console.log(`ユーザー: ${comment}`);
    const response = await bot.generateResponse(comment);
    
    console.log(`検出タイプ: ${response.detection}`);
    if (response.message) {
      console.log(`ひろゆき: ${response.message}`);
    } else {
      console.log("ひろゆき: (応答なし)");
    }
    
    console.log("---");  // コメント間の区切り
    await sleep(500);  // 読みやすくするため1秒待機
  }
  
  console.log("\n=== テスト終了 ===");
}

main().catch(console.error);