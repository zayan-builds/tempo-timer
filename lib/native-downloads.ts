import { registerPlugin } from "@capacitor/core";

export type DownloadResult = { path: string };

export interface DownloadsPlugin {
  save(options: { fileName: string; data: string }): Promise<DownloadResult>;
}

// Registered in MainActivity (android/app/src/main/java/com/zayan/tempo).
// On plain web there is no native implementation — calls reject and callers
// fall back to the share sheet / anchor download.
export const Downloads = registerPlugin<DownloadsPlugin>("Downloads");
