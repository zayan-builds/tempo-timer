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
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { solves: [], errors: ["invalid JSON file"] };
  }

  if (!data || typeof data !== "object") {
    return { solves: [], errors: ["file does not contain valid tempo data"] };
  }

  const obj = data as Record<string, unknown>;
  const list = Array.isArray(obj.solves) ? obj.solves : (Array.isArray(data) ? data : []);

  if (!Array.isArray(list) || list.length === 0) {
    return { solves: [], errors: ["no solves found in file"] };
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

export async function downloadJson(
  json: string,
  filename = `tempo-history.json`,
): Promise<"shared" | "saved"> {
  // Native: write to cache, resolve a real file:// URI, then hand it to the
  // system share sheet. Passing a bare filename breaks Android silently.
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
      return "shared";
    } catch {
      // share cancelled/declined — file is still saved in cache
      return "saved";
    }
  } catch {
    // Capacitor Filesystem unavailable — fall back to web download
  }
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return "saved";
}
