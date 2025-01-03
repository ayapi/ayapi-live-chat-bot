import { Comment } from "@onecomme.com/onesdk/types/Comment";

export interface PlatformState {
  lastGiftResponse: number;
  lastAgeResponse: number;
  lastUhyoResponse: number;
  botUserId: string;
}

export interface IChatPlatform {
  initialize(config: any): Promise<boolean>;
  postMessage(message: string): Promise<void>;
  getPlatformName(): string;
  getState(): PlatformState;
  convertToComment(rawComment: any): Comment;
} 