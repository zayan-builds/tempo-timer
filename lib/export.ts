import { Solve } from "@/hooks/useHistory";

export function exportSolves(solves: Solve[]): string {
  return JSON.stringify(
    { app: "tempo", version: 1, exportedAt: Date.now(), total: solves.length, solves },
    null,
    2,
  );
}

export type ImportResult = {
  solves: Solve[];
  errors: string[];
};

export function parseImport(raw: string): ImportResult {
  const errors: string[] = [];
  // Android file managers often persist a UTF-8 BOM, which JSON.parse rejects.
  // Strip it plus any surrounding whitespace before parsing.
  const text = (raw || "").replace(/^\uFEFF/, "").trim();
  if (!text) {
    return { solves: [], errors: ["the file is empty — try exporting from tempo again"] };
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { solves: [], errors: ["not a valid tempo JSON file"] };
  }

  if (!data || typeof data !== "object") {
    return { solves: [], errors: ["this file doesn't contain tempo history"] };
  }

  const obj = data as Record<string, unknown>;
  const list = Array.isArray(obj.solves) ? obj.solves : Array.isArray(data) ? data : [];

  if (!Array.isArray(list) || list.length === 0) {
    return { solves: [], errors: ["no solves found in this file"] };
  }

  const solves: Solve[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i] as Record<string, unknown> | undefined;
    if (!item || !item.id || typeof item.id !== "string") {
      errors.push(`entry ${i + 1}: missing or invalid id`);
      continue;
    }
    if (typeof item.time_ms !== "number" || item.time_ms <= 0 || !isFinite(item.time_ms)) {
      errors.push(`entry ${i + 1}: missing or invalid time_ms`);
      continue;
    }
    if (typeof item.timestamp !== "number" || item.timestamp <= 0) {
      errors.push(`entry ${i + 1}: missing or invalid timestamp`);
      continue;
    }
    solves.push({
      id: item.id,
      time_ms: item.time_ms,
      scramble: typeof item.scramble === "string" ? item.scramble : "",
      timestamp: item.timestamp,
      event: typeof item.event === "string" ? item.event : "3x3",
    });
  }

  return { solves, errors };
}

export async function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    try {
      return await file.text();
    } catch {
      // fall through to FileReader
    }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("could not read file"));
    reader.readAsText(file);
  });
}

export type ExportOutcome =
  | { kind: "downloads"; path?: string }
  | { kind: "shared" }
  | { kind: "saved" };

export async function downloadJson(
  json: string,
  filename = `tempo-history.json`,
): Promise<ExportOutcome> {
  // 1) Native: write straight to the public Downloads folder via the custom
  //    DownloadsPlugin (MediaStore on API 29+, legacy path on 24-28).
  try {
    const { Downloads } = await import("@/lib/native-downloads");
    const res = await Downloads.save({ fileName: filename, data: json });
    return { kind: "downloads", path: res.path };
  } catch {
    // No native bridge (plain web) or plugin unavailable — keep going.
  }

  // 2) Native fallback: cache + system share sheet.
  try {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const path = `tempo/${Date.now()}-${filename}`;
    await Filesystem.writeFile({ path, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title: "Tempo history",
        text: "Check out my solve history on Tempo",
        files: [uri],
      });
      return { kind: "shared" };
    } catch {
      // share cancelled/declined — file is still saved in cache
      return { kind: "saved" };
    }
  } catch {
    // Capacitor Filesystem unavailable — fall back to web download
  }

  // 3) Web: anchor download.
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { kind: "saved" };
}
