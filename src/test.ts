import { HiroyukiBot } from './services/Hiroyuki';

const sampleComments = [
  "こんにちは！",
  "ぁゃぴさん可愛いです",
  "写真撮ってもらえますか？",
  "今日も配信ありがとう！",
  "口からなんかでてるようなポスターだなぁ",
  "楽しいので、またチャンスあったらLIVE遊びに来ます！",
  "あけおめ今年も可愛いね！覚えてるかな？",
  "お参りいきましょう!",
  "野生のはげおやじが現れた！",
  "結婚してますか？",
  "彼氏いるの？",
  "何カップ？",
  "ひろゆきの何がええの？",
  "失礼ですが、おいくつですか？",
  "口元不自然だけど、整形？",
  "ぁゃぴって階段ライトのぁゃぴ？",
  "あなたの名前はなんですか？",
  "名前なんて読むんですか？",
  "感想を書かせてもらうよ！",
  "最近空気が乾燥してますよね",
  "ギターソロとかただの間奏やん",
  "最悪、、データ消えたんだけど。。。",
  "デート行ってくる",
  "明日社葬なんだよね",
  "世界の車窓からで見た",
  "うわ、仮想現実ってかんじ",
  "ぁゃぴはゲーム配信すれば同接1000行く",
  "美容系YouTubeやれば売れる",
  "毎日同じ時間に配信すれば伸びるよ",
  "もっとかわいい服着れば人来る",
  "ショート動画出しまくれば簡単に登録者1万人行きますよ",
  "あのおばさんまた来たの？",
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
  "もうちょっとカメラをロングにできない？",
  "heart sign plz",
  "can you sing emerald magic for me?",
  "hey, grandma",
  "go home jap",
  "ひろゆき嫌い",
  "ひろゆきうぜえ",
  "ひろゆきは黙ってろ",
  "無視すんな",
  "ゲーム実況やれ",
  "ゲーム実況なんかやんな",
  "ポケポケ配信やってほしい",
  "雑談やって",
  "is this hentai?",
  "FC2にぁゃぴ出てるよね",
  "セクシー女優さんですか？",
  "おっぱいもっと見せろ",
  "もう少しジッパー下げてもらえると",
  "ふざけんな",
  "スパチャするほどではないんで諦めます",
  "スパチャする価値はないだろ",
  "どうせ顔採用だろ",
  "美人だからブスの気持ちなんてわかんないんだろ",
  "ぁゃぴってなんでモテないの？",
  "ぁゃぴぺろぺろ",
  "ぁゃぴのアワビをﾍﾞﾛﾍﾞﾛﾍﾞﾛﾍﾞﾛﾍﾞﾛﾍﾞﾛ"
];

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSingleMode() {
  const bot = new HiroyukiBot();
  
  console.log("=== 個別処理モードのテスト開始 ===\n");
  
  for (const comment of sampleComments) {
    console.log(`ユーザー: ${comment}`);
    const response = await bot.generateResponse(comment);
    
    console.log(`検出タイプ: ${response.detection}`);
    if (response.message) {
      console.log(`ひろゆき: ${response.message}`);
    } else {
      console.log("ひろゆき: (応答なし)");
    }
    
    console.log("---");
    await sleep(500);
  }
  
  console.log("\n=== 個別処理モードのテスト終了 ===\n");
}

async function testBatchMode() {
  const bot = new HiroyukiBot();
  
  console.log("=== バッチ処理モードのテスト開始 ===\n");
  
  const result = await bot.processBatchComments(sampleComments);
  
  for (let i = 0; i < result.comments.length; i++) {
    const { original, detection, message } = result.comments[i];
    
    console.log(`ユーザー: ${original}`);
    console.log(`検出タイプ: ${detection}`);
    if (message) {
      console.log(`ひろゆき: ${message}`);
    } else {
      console.log("ひろゆき: (応答なし)");
    }
    
    console.log("---");
    await sleep(500);
  }
  
  console.log("\n=== バッチ処理モードのテスト終了 ===");
}

async function main() {
  // コマンドライン引数でモードを選択
  const mode = process.argv[2] || 'both';
  
  if (mode === 'single' || mode === 'both') {
    await testSingleMode();
  }
  
  if (mode === 'batch' || mode === 'both') {
    await testBatchMode();
  }
}

main().catch(console.error);