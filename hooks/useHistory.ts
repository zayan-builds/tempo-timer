"use client";
import { useCallback, useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";
import { decryptJson, encryptJson } from "@/lib/crypto";

export type Solve = {
  id: string;
  time_ms: number;
  scramble: string;
  timestamp: number;
  event: string;
};

type StoredPlain = Solve & { encrypted?: false };
type StoredEnc = { id: string; timestamp: number; encrypted: true; iv: string; ct: string };
type Stored = StoredPlain | StoredEnc;

const DB_NAME = "tempo";
const STORE = "solves";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadAll(): Promise<Solve[]> {
  const db = await openDB();
  const records: Stored[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as Stored[]);
    req.onerror = () => reject(req.error);
  });

  const out: Solve[] = [];
  for (const r of records) {
    if ("encrypted" in r && r.encrypted) {
      try {
        const plain = await decryptJson<Solve>({ iv: r.iv, ct: r.ct });
        out.push(plain);
      } catch {
        // unreadable record — skip
      }
    } else {
      const { encrypted: _e, ...rest } = r as StoredPlain;
      out.push(rest as Solve);
    }
  }
  return out.sort((a, b) => a.timestamp - b.timestamp);
}

async function removeFromDb(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearAllFromDb(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function persist(solve: Solve, encrypt: boolean): Promise<void> {
  const db = await openDB();
  let record: Stored;
  if (encrypt) {
    const { iv, ct } = await encryptJson(solve);
    record = { id: solve.id, timestamp: solve.timestamp, encrypted: true, iv, ct };
  } else {
    record = { ...solve, encrypted: false };
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function useHistory() {
  const { settings } = useSettings();
  const [solves, setSolves] = useState<Solve[]>([]);
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<{ total: number; encrypted: number }>({ total: 0, encrypted: 0 });

  const refreshStats = useCallback(async () => {
    try {
      const db = await openDB();
      const records: Stored[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result as Stored[]);
        req.onerror = () => reject(req.error);
      });
      let encrypted = 0;
      for (const r of records) if ("encrypted" in r && r.encrypted) encrypted++;
      setStats({ total: records.length, encrypted });
    } catch {
      // stats are best-effort
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAll()
      .then((items) => {
        if (!cancelled) {
          setSolves(items);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    void refreshStats();
    return () => {
      cancelled = true;
    };
  }, [refreshStats]);

  const addSolve = useCallback(
    (time_ms: number, scramble: string, event = "3x3"): { isPB: boolean; solves: Solve[] } => {
      const solve: Solve = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time_ms,
        scramble,
        timestamp: Date.now(),
        event,
      };
      const next = [...solves, solve];
      const prevBest = solves.length ? Math.min(...solves.map((s) => s.time_ms)) : Infinity;
      const isPB = solves.length > 0 && time_ms < prevBest;
      setSolves(next);
      void persist(solve, settings.encryptHistory).then(() => void refreshStats());
      return { isPB, solves: next };
    },
    [solves, settings.encryptHistory, refreshStats],
  );

  const deleteSolve = useCallback((id: string) => {
    setSolves((prev) => prev.filter((s) => s.id !== id));
    void removeFromDb(id).then(() => void refreshStats());
  }, [refreshStats]);

  const clearAll = useCallback(() => {
    setSolves([]);
    void clearAllFromDb().then(() => void refreshStats());
  }, [refreshStats]);

  const refreshSolves = useCallback(() => {
    loadAll()
      .then((items) => { setSolves(items); })
      .catch(() => {});
  }, []);

  const bulkImport = useCallback(async (importSolves: Solve[]): Promise<{ imported: number; skipped: number }> => {
    const db = await openDB();
    let imported = 0;
    let skipped = 0;
    for (const solve of importSolves) {
      const existing = await new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(solve.id);
        req.onsuccess = () => resolve(!!req.result);
        req.onerror = () => reject(req.error);
      });
      if (existing) { skipped++; continue; }
      await persist(solve, settings.encryptHistory);
      imported++;
    }
    const all = await loadAll();
    setSolves(all);
    await refreshStats();
    return { imported, skipped };
  }, [settings.encryptHistory, refreshStats]);

  return { solves, ready, stats, addSolve, deleteSolve, clearAll, refreshSolves, bulkImport };
}

export function avgOfN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const last = solves.slice(-n).map((s) => s.time_ms);
  const sorted = [...last].sort((a, b) => a - b);
  const trim = n >= 5 ? Math.ceil(n * 0.05) || 1 : 0;
  const middle = sorted.slice(trim, sorted.length - trim);
  if (middle.length === 0) return null;
  return middle.reduce((a, b) => a + b, 0) / middle.length;
}
