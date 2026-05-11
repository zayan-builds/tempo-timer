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
    return () => {
      cancelled = true;
    };
  }, []);

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
      void persist(solve, settings.encryptHistory);
      return { isPB, solves: next };
    },
    [solves, settings.encryptHistory],
  );

  return { solves, ready, addSolve };
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
