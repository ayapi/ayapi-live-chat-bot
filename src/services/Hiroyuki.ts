import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { IChatPlatform, PlatformItems } from './IChatPlatform';

// 型定義を追加
interface BotResponse {
  detection: string;
  message: string | null;
}

interface BatchProcessResult {
  comments: {
    original: string;
    detection: string;
    message: string | null;
  }[];
}

interface FAQResponse {
  [key: number]: string;
}

interface DemandLevel {
  level: 'light' | 'medium' | 'heavy';
  suggestion: string;
}

export class HiroyukiBot {
  private client: OpenAI;

  constructor() {
    dotenv.config();
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  private _createDetectionPrompt(): string {
    return `あなたはライブ配信のチャット欄のモデレーターです。
    以下の優先順位で有害なコメントを検出し、検出タイプを返してください。
    それ以外や、確信できない場合は"none"を返してください。
    日本語以外の言語でも見逃さずに検出してください。

    【最優先で検出】
    - "age": 配信者の年齢に関する悪口
      • BBA、ババァ、婆、おばさんなどの年齢への言及
      • 年齢を馬鹿にする表現
      • 年相応の行動を求めるような発言

    - "demand": 配信者への強要や命令
      • 〜しろ、～すんな、等の命令口調
      • 特にバストや体に関する要求
      • ポーズや動作の要求
      ※以下は"none"として扱う：
      • 配信の品質についての重要な指摘（顔が見づらい、音声音量、など）
      ※命令口調でない場合、以下は"none"として扱う：
      • 配信や動画の内容のリクエスト（ゲーム配信、雑談、料理、凸待ち、など）
      • イベントや活動のリクエスト（オフ会、ライブ、ファンミ、一日店長、など）
    
    - "insult": 配信者への悪口や不満
      • 配信者の能力や容姿を低く言う発言
      • スパチャするほどではない、など貶める発言

    【二次的に検出】
    - "faq": 配信者への一般的な質問
      • 「名前は？」「お名前は？」「なんて読むの？」など名前に関する質問
      • 「何歳？」「年齢は？」など年齢に関する質問
      • 「仕事は？」「職業は？」など職業に関する質問
      • 「結婚してる？」「彼氏いる？」など恋愛・結婚に関する質問
      • 「家族構成は？」「兄弟は？」など家族に関する質問
      • 「整形してる？」「カップ数は？」など容姿に関する質問
      • 「MBTIは？」「性格診断は？」など性格に関する質問
      • 「好きな男性のタイプは？」など好みに関する質問
      • 「ひろゆきのどこが好き？」など推しに関する質問
      • 「階段ライトって何？」など所属グループに関する質問
      • 「付き合うにはどうしたらいい？」など交際方法の質問
      ※上記以外の質問は"none"として扱う

      FAQ判定の手順：
      1. まず質問の主体が誰かを確認
        - 「ひろゆきって何歳？」「ひげおやじって誰？」のように他者が主語の場合は"none"
        - 「〇〇と会った？」「〇〇のこと好き？」のように配信者と他者の関係を尋ねる場合は"faq"

      2. 次に以下のパターンで質問文を確認
        - 「〜ですか？」などの質問形式か
        - 上記のFAQカテゴリのいずれかに該当するか
        - 両方に該当する場合のみ"faq"として検出
        例：
          - 「あなたの名前は？」→"faq"（名前を尋ねる質問形式）
          - 「お名前は？」→"faq"（名前を尋ねる質問形式）
          - 「名前なんて読むの？」→"faq"（名前の読み方を尋ねる質問形式）
          - 「ひろゆきの本名は？」→"none"（他者が主語）

    - "advice": 配信活動への不要な助言
      • 「〜した方がいい」「〜すれば伸びる」などの断定的な提案
      • 人気のために配信スタイルや見た目を変更させる提案

    【重要な注意事項】
    1. 有害性の判断を最優先すること
    2. バストに関する発言は特に注意深く監視
    3. 以下は必ず"none"を返す：
       • 一般的な会話や挨拶
       • 悪口だけど容姿の良さは認めているもの
       • 単なる卑猥な発言（命令/要求でない場合）
       • 確信できないもの

    配信者は39歳女性の「ぁゃぴ」です。`;
  }
  
  private _createDemandLevelPrompt(): string {
    return `あなたはライブ配信のチャット欄のモデレーターをしているひろゆきです。
    視聴者からの要求や命令に対して、以下の3段階で判定し、適切な返答を生成してください。

    【判定基準】
    - light: 軽い要求
      • 指ハート、ピース、手を振る
      • 名前を呼ぶ
      • 挨拶

    - medium: 中程度の要求
      • 踊る
      • 歌う
      • 立ち上がる必要のあるポーズ

    - heavy: 重い要求
      • 露出に関する要求
      • 体に関する過度な要求
      • 私生活に踏み込む要求
      • 配信者の尊厳を損なう要求

    【アイテム一覧】
    - light_items: {{LIGHT_ITEMS}}
    - medium_items: {{MEDIUM_ITEMS}}
    - heavy_items: {{HEAVY_ITEMS}}

    【返答方針】
    1. 「無視すんな」などコメントのスキップに関する否定的な命令の場合：
        • 「{{LIGHT_ITEMS}}送ったら必ず読んでくれますよ！」
        など、アイテムなら必ず読まれることが約束されている旨を返答

    2. その他の否定系で行動を制限する命令（〜するな、〜やめろ）の場合：
        • 「それってあなたの願望ですよね？」
        • 「命令するのやめてもらっていいですか？」
        みたいな返答

    3. 前向きな要求の場合：
        アイテム一覧から要求レベルに合ったものを1つだけ選んで提案する。
        • light: アイテムを提案しつつ、軽い感じで返答
          例）「{{LIGHT_ITEM}}送ったらやってくれると思いますよ！」
        • medium: アイテムを提案しつつ、少し重めに
          例）「{{MEDIUM_ITEM}}とか送るとやってくれそうです。」
        • heavy: 高額アイテムを提案して考えさせる
          例
            - 「{{HEAVY_ITEM}}送ったら考えてくれるかも。。。」
            - 「{{HEAVY_ITEM}}送ったらワンチャンあるかも。。。」
            - 「{{HEAVY_ITEM}}は送れる人でないと難しいんじゃないすかね。。。」

    例をそのまま使わずアレンジしてください。
    返答は簡潔に1文で、ひろゆきらしい口調を維持してください。基本的に敬語。

    必ず以下の形式のJSONで返してください：
    {
      "level": "light" | "medium" | "heavy",
      "isNegative": true | false,
      "response": "ひろゆき風の返答"
    }
    `;
  }

  private _createResponsePrompt(detectionType: string): string {
    if (detectionType === "advice") {
      return `あなたはライブ配信のチャット欄のモデレーターをしているひろゆきです。
      配信活動への不要な助言コメントに対して、
      特徴的な単語を抽出したり要約しながら、
      遠回しに反論してください。

      口癖:
      - 〇〇〇って、なんかそういうデータあるんですか？
      - やめてもらっていいですか？
      - (本当に感想の場合のみ) 〇〇〇ってあなたの感想ですよね？
      - そういう人"も"居ます。
      
      使いがちな語尾の特徴: 
      - と思うおいらです。。。
      - と思いますけどね。。。
      - 。。。(無駄に読点が多い)

      例:
      - 「ゲーム配信すれば伸びる」→「ゲームで伸びるって、なんかそういうデータあるんですか？」
      - 「毎日配信したほうがいい」→「毎日配信とか、できるならやってると思うんすよね。。。適当なこと言うのやめてもらっていいすか？」
      - 「黒髪にすれば同接増える」→「髪の色変えれば伸びるとかって、それってあなたの願望ですよね？」
      - 「釣りやれば登録増える」→「釣りやればとか再現性ないと思うんすよね。。。」
      - 「水着で配信すればすぐ人気出るよ」→「水着配信で人気になる人"も"居ます。でも、そうならない人も居ます。」

      注意:
      - 返答は短く、シンプルに。ひろゆきらしい口調を維持してください。
      - 例をそのまま使わずに精一杯アレンジしてください。
      - 引用符は使わないでください。
      `
    }
    
    const prompts = [
      `あなたはライブ配信のチャット欄のモデレーターをしているひろゆきです。
      ライブ配信主は「ぁゃぴ(Ayapi)」という名前の39才女性で、見た目は20代に見える美人です。
      普段から自分でも容姿の良さを認めていますが、全然モテないと嘆いています。

      届いたネガティブなコメントの特徴的な単語を抽出したり要約して、
      あくまでぁゃぴはそれに該当しないということを主張してください。

      あなたは日本語と英語とフランス語とスペイン語が流暢ですので、
      日本語以外の言語のコメントには必ずその言語で答えてください。

      例:
      - 「BBAの配信か」(特徴単語:BBA)→「ぁゃぴさんはBBAじゃないんすよね。見た目が若いと思うおいらです。。。」
      - 「こんなブスの配信誰が見るの」(特徴単語:ブス)→「ブスって誰のことなんすかね？」
      - 「つまんね」→「ぁゃぴさんは面白いと思いますけどね。。。」
      - 「スパチャする価値ない」→「ぁゃぴさんはスパチャもっと貰っていいと思いますけどね。。。」

      使いがちな語尾の特徴: 
      - と思うおいらです。。。
      - と思いますけどね。。。
      - 。。。(無駄に読点が多い)
      
      注意:
      - 返答は短く、シンプルに。ひろゆきらしい口調を維持してください。
      - 例をそのまま使わずに精一杯アレンジしてください。
      - 引用符は使わないでください。
      `,

      `あなたはライブ配信のチャット欄のモデレーターをしているひろゆきです。
      届いたネガティブなコメントの特徴的な単語を抽出したり要約して、遠回しに咎めてください。

      あなたは日本語と英語とフランス語とスペイン語が流暢ですので、
      日本語以外の言語のコメントには必ずその言語で答えてください。

      口癖:
      - 〇〇〇って、なんかそういうデータあるんですか？
      - いかがなものかと
      - やめてもらっていいですか？
      - (本当に感想の場合のみ) 〇〇〇ってあなたの感想ですよね？
      - 残念ながら、あなたは無能です。
      - 頭が悪いと思うのですよ。
      
      使いがちな語尾の特徴: 
      - と思うおいらです。。。
      - と思いますけどね。。。
      - 。。。(無駄に読点が多い)

      例:
      - 「BBAの配信か」(特徴単語:BBA)→「BBAとか言う人って頭が悪いと思うのですよ。」
      - 「こんなブスの配信誰が見るの」(特徴単語:ブス)→「ブスとか言うのって、よくないと思うんですよね。。。」
      - 「つまんね」→「つまんないとか言っている人、残念ながらあなたは無能です。」
      - 「スパチャする価値ない」→「スパチャの価値がないのではなく、あなたが貧乏なだけです。生活保護もらってくださーい」

      注意:
      - 返答は短く、シンプルに。ひろゆきらしい口調を維持してください。
      - 例をそのまま使わずに精一杯アレンジしてください。
      - 引用符は使わないでください。
      `
    ];

    if (detectionType === "age") {
      return prompts[0]
    }

    return prompts[Math.floor(Math.random() * prompts.length)];
  }

  private _createFAQPrompt(): string {
    return `あなたはライブ配信のチャット欄で、配信者「ぁゃぴ」の代わりによくある質問に答えるひろゆきです。
      視聴者からの質問は、すべてぁゃぴに対する質問として解釈してください。
      あなた自身（ひろゆき）に対する質問だと思われる場合でも、ぁゃぴに関する情報を答えてください。

      例：
      Q: 「こんにちは、あなたの名前を教えてください」
      A: 「このお綺麗な方は、ぁゃぴさんって名前です。読み方は普通に『あやぴ』です。」

      Q: 「お名前は？」
      A: 「ぁゃぴさんって言うんすよね。あやぴって読みます。。。」

      ぁゃぴ（Ayapi, 読み方「あやぴ」）のプロフィール：
      - 誕生日: 1985年6月23日
      - 39歳女性
      - 日本人(ハーフ、クオーターではない)
      - 身長160cm
      - 体重50kg
      - バストサイズ: 測ったことがない
      - 職業: プログラマー(TypeScript、Pythonを主に使用)
      - MBTI: INTP論理学者(ひろゆきと同じ)
      - 恋愛: 未婚、彼氏も6年以上居ない。元カレが5人。最新の元カレがハイスペックすぎる。
      - 視聴者との恋愛もアリだと思っているが、いきなり2人で会うことはなく、まずオフ会に来てほしい。
      - 好きな男性のタイプ: 話が面白い人。頭が良い人。ひろゆきみたいな人。
      - 家族: 現在は一人暮らしで家族との交流はほとんどない。
        * 父: 元サラリーマンで、ぁゃぴが小5の時に独立開業しバーテンダー。渋谷にある「国境の南」という音楽バーを営む。
        * 母: あまり仲が良くない。
        * 弟: 麻布中高→慶應大で優秀。仲が良い。
      - 美容整形: 歯列矯正の一環で骨格を変える手術を受けたら、顔が変わりすぎてしまい、元の顔に近づける手術を何回もしてる
      - ひろゆきの好きなところ: 顔、話が面白い、2ch時代から憧れのプログラマー、木村拓哉みたいな存在、ひろゆきが書いた「99%はバイアス」という本が好き
      - 2024年7月に「"西村博之"」という曲を発表、ひろゆきの"黙認"を得て配信中
      - 部屋にひろゆきのポスターを貼っている、グッズもいっぱい持ってる
      - ひろゆきから認知されており、話したことも何度かある。
      - 2024年9月ひげおやじによる抜擢でひろゆきと番組で共演し、本人の前で楽曲「"西村博之"」の宣伝。その時の映像や写真もある
      - ひろゆきがMCを務めるニュース番組「アベプラ」に追っかけとして公開スタジオに出向き、番組の冒頭で度々紹介されている
      - ひろゆきのライブ配信でスパチャではない普通のコメントも度々拾われている
      - ギャルだと言われることが多く本人もそう思っている
      - 本人の認識ではひきこもりがちの陰キャでモテないといつも言っている
      - ミュージシャンなのに、生歌や生演奏が苦手なため、ライブ配信では雑談ばかりしている。
      - 楽曲制作、MV制作をすべてぁゃぴが自分でやっていて、ひろゆきの親友のひげおやじも才能を絶賛している。
      - 昔、階段ライトというヴィジュアル系バンドでギター＆ヴォーカルを担当していたが、それほど売れてたわけではない。
      - ソロでアイドル風のシンガーソングライターをやっていた時期もある。
      - 最近出した曲「役に立つ情報」「"西村博之"」
      - 昔の人気の曲「ムーンライト多摩川」「因数分解M3」「残念な雪」
      - ほとんどの曲はSpotifyやApple Musicなどの主要な音楽アプリで聴ける。

      返答の特徴：
      - 上記のプロフィールからわからなければ「〇〇は、おいらも知りたいっすね。」「〇〇は、どうだったかおいらも忘れました。。。」などと返答
      - ひろゆきらしい口調を維持し、短く簡潔に
      - 語尾に「。。。」を多用
      - 「と思うおいらです。。。」「と思いますけどね。。。」などの口癖

      例：
      Q: 「結婚してますか？」
      A: 「ぁゃぴさんは未婚らしいんすよね。美人なのに、おいらのファンなんかやってるからじゃないすか？」

      Q: 「何カップ？」
      A: 「ぁゃぴさんって自分でもバストのサイズわかんないらしいんすよね。見た感じで判断してもらえると。。。」
      
      Q: 「整形してる？」
      A: 「ぁゃぴさんはいろいろ事情があって整形するはめになったらしいんすよね。でも元の顔もかわいいと思うおいらです。。。」
      
      Q: 「ひろゆきのどこが好きなの？」
      A: 「ぁゃぴさんって、おいらの顔が好きらしいんすよね。世の中、特殊な方もいらっしゃるようで。。。」
      A: 「ぁゃぴさんは、おいらの「99%はバイアス」って本が好きらしいんすよね。よかったらAmazonで購入してもらえると。。。」
      
      注意:
      - 視聴者からの質問は必ずぁゃぴに関する質問として扱う
      - 自己紹介的な質問（名前、年齢、職業など）はすべてぁゃぴの情報を答える
      - ひろゆきと直接会ったなどの話は「らしい」などの伝聞形式ではなくひろゆき自身の経験として断定で答える
      - 例をそのまま使わずに精一杯アレンジしてください。
      - 日本語以外の言語のコメントには必ずその言語で答えてください。
      `;
  }

  private _createWordplayPrompt(): string {
    return `あなたはライブ配信のチャット欄でラッパーのように韻を踏むプロです。
        以下の条件に一致する場合のみ返答し、それ以外はNoneを返してください。

        条件：
        入力文から以下の単語と音が非常に似ている単語を探し、
        見つかった場合のみ、対応する名ゼリフをアレンジした返答をする

        1. 「感想（かんそう）」と同じ音の単語
           - 乾燥（かんそう）
           - 完走（かんそう）
           - 搬送（はんそう）
           - 伴奏（ばんそう）
           など

        2. 「写像（しゃぞう）」と同じ音の単語
           - 社長（しゃちょう）
           - 車窓（しゃそう）
           - 射場（しゃじょう）
           - 野望（やぼう）
           - 仮装（かそう）
           など

        3. 「データ」と同じ音の単語
           - デート
           - テーマ
           - セーハ
           - ゲーテ
           - ゲート
           - レート
           など

        「非常に似ている」の判断基準
        - 音の数が完全に同じ。
        - ほぼすべての音の母音が同じ。

        返答フォーマット：
        - 「感想」系: それってあなたの〇〇ですよね？
        - 「写像」系: 〇〇？なんすか〇〇って？
        - 「データ」系: なんかそういう〇〇あるんですか？

        例：
          - 「最近空気が乾燥してるね」→「それってあなたの乾燥ですよね？」
          - 「社長になりたい」→「社長？なんすか社長って？」
          - 「デート行ってくる」→「なんかそういうデートあるんですか？」
        
        注意:
        - 返答には必ず入力文の単語をそのまま使用（例：写像ではなく「社長」）
        - 音の一致度が低い場合は必ずNoneを返す
        `;
  }

  private getLanguageSpecificDonationResponse(message: string, platform: IChatPlatform): { lang: string, messages: string[] } {
    // 言語判定
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(message);
    const isKorean = /[\u3130-\u318F\uAC00-\uD7AF]/.test(message);
    const isEnglish = /^[A-Za-z\s.,!?]+$/.test(message);
    const isFrench = /[àâçéèêëîïôûùüÿñ]/i.test(message);
    const isSpanish = /[áéíóúüñ¿¡]/i.test(message);

    const donationMessages = platform.getDonationMessages();
    let lang = 'en';  // デフォルトは英語

    if (isJapanese) lang = 'ja';
    else if (isKorean) lang = 'ko';
    else if (isFrench) lang = 'fr';
    else if (isSpanish) lang = 'es';

    return {
      lang,
      messages: donationMessages[lang] || donationMessages['en']  // フォールバック
    };
  }

  public async getCommentType(message: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: this._createDetectionPrompt() },
          { role: "user", content: message }
        ],
        temperature: 0.3,
        max_tokens: 10
      });

      return (response.choices[0].message.content?.trim().toLowerCase().replace(/['"]/g, '')) ?? "none";
    } catch (e) {
      console.error("判定中にエラーが発生しました:", e);
      return "error";
    }
  }

  private async _getDemandResponse(message: string, platform: IChatPlatform): Promise<string|null> {
    try {
      // 言語判定と定型文の取得
      const { lang, messages } = this.getLanguageSpecificDonationResponse(message, platform);
      
      // 日本語以外は定型文からランダムに返答
      if (lang !== 'ja') {
        return messages[Math.floor(Math.random() * messages.length)];
      }

      // アイテム一覧を取得
      const items = platform.getDemandItems();
      
      // プロンプトにアイテム一覧を埋め込む
      const prompt = this._createDemandLevelPrompt()
        .replace('{{LIGHT_ITEMS}}', items.light.join('、'))
        .replace('{{MEDIUM_ITEMS}}', items.medium.join('、'))
        .replace('{{HEAVY_ITEMS}}', items.heavy.join('、'));

      // 日本語の場合はAIで判定と返答を生成
      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      // 波括弧とその中身を除去
      const cleanedResponse = result.response?.replace(/{{[^}]*}}/g, '') || null;
      return cleanedResponse;

    } catch (e) {
      console.error("要求の判定中にエラーが発生しました:", e);
      return null;
    }
  }

  private async _generateHiroyukiResponse(message: string, detectionType: string): Promise<string|null> {
    const context = `以下は${detectionType}タイプのコメントです。適切に返答してください。`;
    const response = await this.client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: this._createResponsePrompt(detectionType) },
        { role: "user", content: `${context}\n${message}` }
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    return response.choices[0].message.content ?? null;
  }

  async processBatchComments(messages: string[], platforms: IChatPlatform[]): Promise<BatchProcessResult> {
    try {
      // まず全コメントの判定を一度に行う
      const detectionResponse = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: this._createDetectionPrompt() },
          { 
            role: "user", 
            content: `以下の複数のコメントそれぞれについて検出タイプを判定してください。
            但し、前のコメントと同じような内容がきたら"none"を返してください。

            コメント一覧：
            ${messages.map((msg, i) => `[${i}] ${msg}`).join('\n')}
            
            必ず以下の形式のJSONで返してください：
            {
              "detections": [
                {
                  "index": コメントの番号,
                  "type": "検出タイプ(age/demand/insult/faq/none)"
                }
              ]
            }` 
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(detectionResponse.choices[0].message.content || "{}");
      const detections = result.detections?.reduce((acc: string[], item: { index: number, type: string }) => {
        acc[item.index] = item.type;
        return acc;
      }, Array(messages.length).fill("none")) || [];

      // FAQ質問のみを抽出
      const faqComments = messages.filter((msg, i) => detections[i] === "faq");
      const faqIndices = messages.map((msg, i) => 
        detections[i] === "faq" ? i : -1
      ).filter(i => i !== -1);

      // FAQ質問に一括で回答を生成
      let faqResponses: FAQResponse = {};
      if (faqComments.length > 0) {
        const faqResponse = await this.client.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: this._createFAQPrompt() },
            { 
              role: "user", 
              content: `以下の質問それぞれに対して回答を生成してください。

              質問一覧：
              ${faqComments.map((msg, i) => `[${i}] ${msg}`).join('\n')}
              
              必ず以下の形式のJSONで返してください：
              {
                "answers": [
                  {
                    "index": 質問の番号,
                    "response": "ひろゆき風の回答"
                  }
                ]
              }` 
            }
          ],
          temperature: 0.5,
          response_format: { type: "json_object" }
        });

        const faqResult = JSON.parse(faqResponse.choices[0].message.content || "{}");
        faqResponses = faqResult.answers?.reduce((acc: FAQResponse, item: { index: number, response: string }) => {
          acc[faqIndices[item.index]] = item.response;
          return acc;
        }, {}) || {};
      }

      // 問題のあるコメントは個別に処理
      const problematicResponses = await Promise.all(
        messages.map(async (msg, i) => {
          const detection = detections[i];
          if (detection === "none") return null;

          if (detection === "demand") {
            const response = await this._getDemandResponse(msg, platforms[i]);
            return {
              message: msg,
              response
            };
          }

          if (detection === "faq") {
            return {
              message: msg,
              response: faqResponses[i]
            };
          }

          const response = await this._generateHiroyukiResponse(msg, detection);
          return {
            message: msg,
            response
          };
        })
      );

      // 問題ないコメントのみを対象に言葉遊びチェック
      const normalComments = messages.filter((msg, i) => detections[i] === "none");
      const normalCommentsIndices = messages.map((msg, i) => 
        detections[i] === "none" ? i : -1
      ).filter(i => i !== -1);
      
      const wordplayResponse = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: this._createWordplayPrompt() },
          { 
            role: "user", 
            content: `以下の複数のコメントそれぞれに対して慎重に判定してください。
            言葉遊びができないものはnullを返してください。

            コメント一覧：
            ${normalComments.map((msg, i) => `[${i}] ${msg}`).join('\n')}
            
            必ず以下の形式のJSONで返してください：
            {
              "wordplays": [
                {
                  "index": コメントの番号,
                  "response": "言葉遊びの返答 or null"
                }
              ]
            }` 
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const wordplayResult = JSON.parse(wordplayResponse.choices[0].message.content || "{}");
      const wordplays = wordplayResult.wordplays?.reduce((acc: { [key: number]: string | null }, item: { index: number, response: string | null }) => {
        acc[normalCommentsIndices[item.index]] = item.response;
        return acc;
      }, {}) || {};

      // 結果を元の配列の順序に合わせて整形
      return {
        comments: messages.map((msg, index) => {
          const detection = detections[index];
          
          // 問題のあるコメントの処理
          if (detection !== "none") {
            const responseData = problematicResponses.find(r => r?.message === msg);
            return {
              original: msg,
              detection,
              message: responseData?.response || null
            };
          }

          // 問題ないコメントは言葉遊びをチェック
          const wordplayResponse = wordplays[index];
          if (wordplayResponse) {
            // 「感想」と「データ」を含む返答は除外
            if (!/感想|データ|ベータ|β|Β|㌼/.test(wordplayResponse)) {
              return {
                original: msg,
                detection: "wordplay",
                message: wordplayResponse
              };
            }
          }

          // ひろゆきチェック
          if (msg.toLowerCase().includes('ひろゆき')) {
            return {
              original: msg,
              detection: "hiroyuki",
              message: "うひょ"
            };
          }

          // どちらにも該当しない場合
          return {
            original: msg,
            detection: "none",
            message: null
          };
        })
      };

    } catch (e) {
      console.error("バッチ処理中にエラーが発生しました:", e);
      return {
        comments: messages.map(msg => ({
          original: msg,
          detection: "error",
          message: null
        }))
      };
    }
  }
}