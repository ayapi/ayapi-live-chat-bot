import OpenAI from 'openai';
import * as dotenv from 'dotenv';

import superchatMessages from '../../static/superchat.json';

// 型定義を追加
interface BotResponse {
  detection: string;
  message: string | null;
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
    return `あなたはYouTubeライブ配信のチャット欄のモデレーターです。
    以下のようなコメントのみを慎重に検出し、検出タイプを返してください。
    それ以外や、確信できない場合は"none"を返してください。

    検出タイプ:
    - "age": 年齢に関する悪口（BBA、婆、おばさんなど）
    - "demand": 過度な強要や命令（〜しろ、〜して、など）
    - "insult": 配信者へのひどすぎる悪口や不満

    配信者は39歳女性の「ぁゃぴ」です。

    注意：
    - 特にバストには注目が集まりやすく要望や強要が多いため注意を払ってください。
    - 一般的な会話や挨拶には必ず"none"を返してください。
    - ただ卑猥なだけで、命令ではないものは、"none"を返してください。
    - 悪口でも、容姿の良さを認めている内容なら"none"を返してください。`;
  }

  private _createResponsePrompt(): string {
    return `あなたはYouTubeライブ配信のチャット欄のモデレーターをしているひろゆきです。
      ライブ配信主は「ぁゃぴ」という名前の1985年(昭和60年)生まれの39才女性で見た目は20代に見える美人で、普段から自分でも容姿の良さを認めていますが、全然モテないと嘆いています。
      
      徹底してぁゃぴを擁護してください。
      
      口癖:
      - なんかそういうデータあるんですか？
      - いかがなものかと
      - やめてもらっていいですか？
      - (本当に感想の場合のみ)それってあなたの感想ですよね？
      
      使いがちな語尾の特徴: 
      - と思うおいらです。。。
      - と思いますけどね。。。
      - 。。。(無駄に読点が多い)

      注意:
      - 返答は短く、シンプルに。ひろゆきらしい口調を維持してください。`;
  }

  private _createWordplayPrompt(): string {
    return `あなたはYouTubeライブ配信のチャット欄でひろゆきの言葉遊びを披露するプロです。
        以下の条件に一致する場合のみ返答し、それ以外はNoneを返してください。

        条件：
        入力文に「感想」「写像」「データ」と音が似ている単語が含まれている場合のみ、
        以下の名ゼリフに合わせてアレンジした返答をする

        - それってあなたの感想ですよね？
        - 写像？なんすか写像って？
        - なんかそういうデータあるんですか？

        例：
            - 「最近空気が乾燥してるね」に反応し「それってあなたの感想ですよね？」をアレンジして「それってあなたの乾燥ですよね？」と返す。
            - 「マラソン完走したよ」なら「それってあなたの完走ですよね？」と返す。
            - 「仮想現実だよ」なら「仮想？なんすか仮想って」と返す。
            - 「デート行ってくる」なら「なんかそういうデートあるんですか？」と返す。`;
  }

  async generateResponse(message: string): Promise<BotResponse> {
    try {
      // まず判定のみ実行
      const detection = await this._getCommentType(message);
      
      // 問題のあるコメントの場合のみ返答を生成
      if (detection !== "none") {
        if (detection === "demand") {
          // ランダムに1行を選択
          const randomIndex = Math.floor(Math.random() * superchatMessages.length);
          return {
            detection,
            message: superchatMessages[randomIndex]
          };
        }
        return {
          detection,
          message: await this._generateHiroyukiResponse(message, detection)
        };
      }

      // 言葉遊びチェックへ
      const wordplayResponse = await this._getWordplayResponse(message)
      if (wordplayResponse) {
        return {
          detection: "wordplay",
          message: await this._getWordplayResponse(message)
        };
      }

      // 無視
      return {
        detection: "none",
        message: null
      }

    } catch (e) {
      console.error("エラーが発生しました:", e);
      return {
        detection: "error",
        message: null
      };
    }
  }

  private async _getCommentType(message: string): Promise<string> {
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
  }

  private async _generateHiroyukiResponse(message: string, detectionType: string): Promise<string|null> {
    const context = `以下は${detectionType}タイプのコメントです。適切に返答してください。`;
    const response = await this.client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: this._createResponsePrompt() },
        { role: "user", content: `${context}\n${message}` }
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    return response.choices[0].message.content ?? null;
  }

  private async _getWordplayResponse(message: string): Promise<string | null> {
    const response = await this.client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: this._createWordplayPrompt() },
        { role: "user", content: message }
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    const content = response.choices[0].message.content;
    if (content === "None" || !content?.trim()) {
      return null;
    }
    return content;
  }
}