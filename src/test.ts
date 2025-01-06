import { HiroyukiBot } from './services/Hiroyuki';
import { IChatPlatform, PlatformState } from './services/IChatPlatform';
import { Comment } from '@onecomme.com/onesdk/types/Comment';
import youtubeMessages from '../static/donation-messages/youtube.json';

// テスト用のモックプラットフォーム
class MockPlatform implements IChatPlatform {
  private state: PlatformState = {
    lastGiftResponse: 0,
    lastAgeResponse: 0,
    lastUhyoResponse: 0,
    botUserId: 'mock-bot'
  };

  async initialize(_config: any): Promise<boolean> {
    return true;
  }

  async postMessage(_message: string): Promise<void> {}

  async postThanksMessage(_comment: Comment): Promise<void> {}

  getPlatformName(): string {
    return 'youtube';
  }

  getState(): PlatformState {
    return this.state;
  }

  getDonationMessages(): { [lang: string]: string[] } {
    return youtubeMessages;  // テスト用にYouTubeのメッセージを使用
  }
}

const sampleComments = [
  "胸にタマタマらしいポケモンが隠れてませんか？",
  "本気出していいよ",
  "もう一回しませんか？",
  "ナイスパ",
  "Nai supa",
  "あやぴはｅｘありだとまずいんですか？",
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
  "βうるせえ",
  "ひろゆきβが言ってたよ",
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
  "ぁゃぴミラーリングしてる？",
  "ぁゃぴのゲーム配信見たい",
  "美容系の動画出してほしい",
  "ゲーム実況やれ",
  "ゲーム実況なんかやんな",
  "ポケポケ配信やってほしい",
  "雑談やって",
  "雑談して",
  "声聞こえない",
  "音割れてる",
  "音量上げて",
  "顔全然見えない",
  "もっと顔映るようにして",
  "変な踊りやめろ！",
  "住所ばらすなｗｗ",
  "ぁゃぴ気を付けろ！",
  "ぁゃぴ、北斗百裂拳だ！",
  "is this hentai?",
  "FC2にぁゃぴ出てるよね",
  "セクシー女優さんですか？",
  "おっぱい見せて",
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


async function testBatchMode() {
  const bot = new HiroyukiBot();
  const mockPlatform = new MockPlatform();
  
  console.log("=== バッチ処理モードのテスト開始 ===\n");
  
  // 全てのコメントに同じプラットフォームを使用（テスト用）
  const platforms = Array(sampleComments.length).fill(mockPlatform);
  
  const result = await bot.processBatchComments(sampleComments, platforms);
  
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
  await testBatchMode();
}

main().catch(console.error);