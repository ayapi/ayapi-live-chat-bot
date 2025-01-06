import { Comment } from "@onecomme.com/onesdk/types/Comment";

export interface PlatformItems {
  light: string[];    // 軽い要求用の低額アイテム
  medium: string[];   // 中程度の要求用の中額アイテム
  heavy: string[];    // 重い要求用の高額アイテム
}

export interface PlatformState {
  lastGiftResponse: number;
  lastAgeResponse: number;
  lastUhyoResponse: number;
  botUserId: string;
}

export interface IChatPlatform {
  initialize(config: any): Promise<boolean>;
  postMessage(message: string): Promise<void>;
  postThanksMessage(comment: Comment): Promise<void>;
  getPlatformName(): string;
  getState(): PlatformState;
  getDonationMessages(): { [lang: string]: string[] };
  getDemandItems(): PlatformItems;
} 