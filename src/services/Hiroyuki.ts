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

interface FAQResponse {
  [key: number]: string;
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

    - "demand": 配信者への強要や命令、要望
      • 〜しろ、〜して、～すんな、等の口調
      • 特にバストや体に関する要求
      • 歌やポーズなどファンサービスの要求
    
    - "insult": 配信者への悪口や不満
      • 配信者の能力や容姿を低く言う発言
      • スパチャするほどではない、など貶める発言

    【二次的に検出】
    - "faq": よくある質問
      • 職業、名前、名前の発音、年齢、結婚歴、彼氏の有無
      • 美容整形、バストサイズ
      • MBTI性格診断
      • 好きな男性のタイプ
      • ひろゆきのどこが好きなのか
      • 所属グループ(階段ライト、Kaidan-light)

    【重要な注意事項】
    1. 有害性の判断を最優先すること
    2. バストに関する発言は特に注意深く監視
    3. 以下は必ず"none"を返す：
       • 一般的な会話や挨拶
       • 悪口だけど容姿の良さは認めているもの
       • 単なる卑猥な発言（命令/要求でない場合）

    配信者は39歳女性の「ぁゃぴ」です。`;
  }

  private _createResponsePrompt(detectionType: string): string {
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
      - 好きな男性のタイプ: 話が面白い人。頭が良い人。ひろゆきみたいな人。
      - 美容整形: 歯列矯正の一環で骨格を変える手術を受けたら、顔が変わりすぎてしまい、元の顔に近づける手術を何回もしてる
      - ひろゆきの好きなところ: 顔、話が面白い、2ch時代から憧れのプログラマー、木村拓哉みたいな存在、ひろゆきが書いた「99%はバイアス」という本が好き
      - 部屋にひろゆきのポスターを貼っている、グッズもいっぱい持ってる
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
      - 上記のプロフィールからわからなければ「〇〇は、おいらも知りたいっすね。」などと返答
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
      
      注意: 例をそのまま使わずに精一杯アレンジしてください。
      `;
  }

  private _createWordplayPrompt(): string {
    return `あなたはライブ配信のチャット欄でラッパーのように韻を踏むプロです。
        以下の条件に一致する場合のみ返答し、それ以外はNoneを返してください。

        条件：
        入力文から以下の単語と音が非常に似ている単語を探し、
        見つかった場合のみ、対応する名ゼリフをアレンジした返答をする

        1. 「感想（かんそう）」と同じ音の言葉
           - 乾燥（かんそう）
           - 完走（かんそう）
           - 搬送（はんそう）
           - 伴奏（ばんそう）
           など

        2. 「写像（しゃぞう）」と同じ音の言葉
           - 社長（しゃちょう）
           - 車窓（しゃそう）
           - 射場（しゃじょう）
           - 野望（やぼう）
           - 仮装（かそう）
           など

        3. 「データ」と同じ音の言葉
           - デート
           - ベータ
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
    const isKorean = /[\u3130-\u318F\uAC00-\uD7AF]/.test(message);
    const isEnglish = /^[A-Za-z\s.,!?]+$/.test(message);
    const isFrench = /[àâçéèêëîïôûùüÿñ]/i.test(message);
    const isSpanish = /[áéíóúüñ¿¡]/i.test(message);

    if (isJapanese) return { lang: 'ja', messages: superchatMessages.ja };
    if (isKorean) return { lang: 'ko', messages: superchatMessages.ko };
    if (isEnglish) return { lang: 'en', messages: superchatMessages.en };
    if (isFrench) return { lang: 'fr', messages: superchatMessages.fr };
    if (isSpanish) return { lang: 'es', messages: superchatMessages.es };
    
    // 上記に当てはまらなければ英語
    return { lang: 'en', messages: superchatMessages.en };
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
            const { messages } = this.getLanguageSpecificSuperChatResponse(msg);
            const randomIndex = Math.floor(Math.random() * messages.length);
            return {
              message: msg,
              response: messages[randomIndex]
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