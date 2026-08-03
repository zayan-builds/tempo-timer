import { registerPlugin } from "@capacitor/core";

export type JsonPickResult = { name: string; size: number; text: string };

export interface JsonPickerPlugin {
  pick(): Promise<JsonPickResult>;
}

// Registered in MainActivity (android/app/src/main/java/com/zayan/tempo).
// On plain web there is no native implementation — calls reject and callers
// fall back to the web <input type="file"> path.
export const JsonPicker = registerPlugin<JsonPickerPlugin>("JsonPicker");
