export class ReplyDetector {
  private static readonly ALLOWED_TARGETS = ['ぁゃぴ', 'あやぴ', 'あゃぴ', 'ぁやぴ', 'みな', 'ひろゆき'];

  private static readonly GREETINGS = [
    'おは',
    'こんにちは',
    'こんにちわ',
    'こんばんは',
    'こんばんわ',
    'はじめまして',
    'よろしく',
    'お疲れ様',
    'おつかれさま',
    'おやすみ',
    'いってらっしゃい',
    'いってきます',
    'ただいま',
    'おかえり'
  ];

  private static readonly HONORIFICS = [
    'さん',
    'くん',
    'ちゃん',
    '君',
    'さま',
    'のお兄さん',
    'のお姉さん'
  ];

  static detectGreetingReply(message: string): boolean {
    const pattern = new RegExp(
      `^([^、,]+)(${this.HONORIFICS.join('|')})[、,\\s]*(${this.GREETINGS.join('|')})`,
      'i'
    );

    const match = message.match(pattern);
    if (!match) return false;

    const target = match[1];

    return !this.ALLOWED_TARGETS.some(allowed => 
      target.toLowerCase().includes(allowed.toLowerCase())
    );
  }
}