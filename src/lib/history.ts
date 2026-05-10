import { get, set, del, keys } from "idb-keyval";

export type HistoryItem = {
  id: string;
  createdAt: number;
  title: string; // "Cotton Shirt — M test"
  // Inputs snapshot
  user: {
    height_ft?: string;
    height_in?: string;
    weight?: string;
    age?: string;
    gender?: string;
    chest?: string;
    shoulder?: string;
    length?: string;
    waist?: string;
  };
  product: {
    name?: string;
    type: string;
    color?: string;
    chest?: string;
    shoulder?: string;
    length?: string;
    sleeve?: string;
    waist?: string;
    size?: string;
  };
  notes?: string;
  // Photos (Blobs stored locally only)
  userPhoto?: Blob;
  productPhotos?: Blob[];
  // AI result (any shape)
  result: any;
  // Local heuristic suggestion at time of save
  chartSuggestion?: { size: string | null; source: string; note: string };
};

const PREFIX = "fitcheck:hist:";

export async function saveHistory(item: HistoryItem) {
  await set(PREFIX + item.id, item);
}

export async function listHistory(): Promise<HistoryItem[]> {
  const allKeys = await keys();
  const ours = allKeys.filter((k) => typeof k === "string" && (k as string).startsWith(PREFIX));
  const items = await Promise.all(ours.map((k) => get(k as string)));
  return (items.filter(Boolean) as HistoryItem[]).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getHistory(id: string): Promise<HistoryItem | undefined> {
  return get(PREFIX + id);
}

export async function deleteHistory(id: string) {
  await del(PREFIX + id);
}

export async function clearHistory() {
  const all = await keys();
  await Promise.all(
    all.filter((k) => typeof k === "string" && (k as string).startsWith(PREFIX)).map((k) => del(k as string)),
  );
}

export function blobToObjectUrl(b?: Blob | null): string {
  return b ? URL.createObjectURL(b) : "";
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
