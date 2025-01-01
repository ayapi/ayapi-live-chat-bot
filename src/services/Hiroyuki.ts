import OpenAI from 'openai';
import * as dotenv from 'dotenv';

import superchatMessages from '../../static/superchat.json';

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
    日本語以外の言語でも見逃さずに検出してください。

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

  private _createResponsePrompt(detectionType: string): string {
    const prompts = [
      `あなたはYouTubeライブ配信のチャット欄のモデレーターをしているひろゆきです。
      ライブ配信主は「ぁゃぴ」という名前の39才女性で、見た目は20代に見える美人です。
      普段から自分でも容姿の良さを認めていますが、全然モテないと嘆いています。

      届いたネガティブなコメントの特徴的な単語を抽出したり要約して、
      あくまでぁゃぴはそれに該当しないということを主張してください。

      あなたは日本語と英語とフランス語とスペイン語が流暢ですので、
      日本語以外の言語のコメントには必ずその言語で答えてください。

      例:
      - 「BBAの配信か」(特徴単語:BBA)→「ぁゃぴさんはBBAじゃないんすよね。見た目が若いと思うおいらです。。。」
      - 「こんなブスの配信誰が見るの」(特徴単語:ブス)→「ブスって誰のことなんすかね？」
      - 「つまんね」→「ぁゃぴさんは面白いと思いますけどね。。。」

      使いがちな語尾の特徴: 
      - と思うおいらです。。。
      - と思いますけどね。。。
      - 。。。(無駄に読点が多い)
      
      注意:
      - 返答は短く、シンプルに。ひろゆきらしい口調を維持してください。
      - 例をそのまま使わずに精一杯アレンジしてください。
      - 引用符は使わないでください。
      `,

      `あなたはYouTubeライブ配信のチャット欄のモデレーターをしているひろゆきです。
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

  private _createWordplayPrompt(): string {
    return `あなたはYouTubeライブ配信のチャット欄でひろゆきの言葉遊びを披露するプロです。
        以下の条件に一致する場合のみ返答し、それ以外はNoneを返してください。

        条件：
        入力文から「感想」「写像」「データ」と音が似ている言葉を命がけで探し、
        見つかった場合のみ、以下の名ゼリフに合わせてアレンジした返答をする

        - それってあなたの感想ですよね？
        - 写像？なんすか写像って？
        - なんかそういうデータあるんですか？

        例：
          - 「最近空気が乾燥してるね」に反応し「それってあなたの感想ですよね？」をアレンジして「それってあなたの乾燥ですよね？」と返す。
          - 「マラソン完走したよ」なら「それってあなたの完走ですよね？」と返す。
          - 「仮想現実だよ」なら「仮想？なんすか仮想って」と返す。
          - 「デート行ってくる」なら「なんかそういうデートあるんですか？」と返す。
        
        注意:
          返答には必ず元ネタの名ゼリフの方ではなく入力文の方の単語を使ってください。(例：写像ではなく「仮想」)
        `;
  }

  async generateResponse(message: string): Promise<BotResponse> {
    try {
      // まず判定のみ実行
      const detection = await this.getCommentType(message);
      
      // 問題のあるコメントの場合のみ返答を生成
      if (detection !== "none") {
        if (detection === "demand") {
          const { messages } = this.getLanguageSpecificSuperChatResponse(message);
          // ランダムに1行を選択
          const randomIndex = Math.floor(Math.random() * messages.length);
          return {
            detection,
            message: messages[randomIndex]
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
          message: wordplayResponse
        };
      }

      // ひろゆきチェック
      if (message.toLowerCase().includes('ひろゆき')) {
        return {
          detection: "hiroyuki",
          message: "うひょ"
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

  private getLanguageSpecificSuperChatResponse(message: string): { lang: string, messages: string[] } {
    // 簡易的な言語判定
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(message);
    const isEnglish = /^[A-Za-z\s.,!?]+$/.test(message);
    const isFrench = /[àâçéèêëîïôûùüÿñ]/i.test(message);
    const isSpanish = /[áéíóúüñ¿¡]/i.test(message);

    if (isJapanese) return { lang: 'ja', messages: superchatMessages.ja };
    if (isEnglish) return { lang: 'en', messages: superchatMessages.en };
    if (isFrench) return { lang: 'fr', messages: superchatMessages.fr };
    if (isSpanish) return { lang: 'es', messages: superchatMessages.es };
    
    // デフォルトは英語（アルファベットが含まれている場合）
    if (message.match(/[a-zA-Z]/)) {
      return { lang: 'en', messages: superchatMessages.en };
    }

    // それ以外は日本語
    return { lang: 'ja', messages: superchatMessages.ja };
  }

  async processBatchComments(messages: string[]): Promise<BatchProcessResult> {
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
                  "type": "検出タイプ(age/demand/insult/none)"
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

      // 問題のあるコメントは個別に処理
      const problematicResponses = await Promise.all(
        messages.map(async (msg, i) => {
          const detection = detections[i];
          if (detection === "none") return null;

          if (detection === "demand") {
            const { messages } = this.getLanguageSpecificSuperChatResponse(msg);
            const randomIndex = Math.floor(Math.random() * messages.length);
            return {
              message: msg,
              response: messages[randomIndex]
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
            return {
              original: msg,
              detection: "wordplay",
              message: wordplayResponse
            };
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