import { get, set, del, keys } from "idb-keyval";

export type ProfilePhoto = {
  id: string;
  pose: "front" | "side" | "back" | "apose" | "other";
  blob: Blob;
  addedAt: number;
};

export type BodyMeasurement = {
  // All in inches; AI may return strings — keep flexible
  chest_in?: number | string;
  shoulder_in?: number | string;
  waist_in?: number | string;
  hip_in?: number | string;
  torso_length_in?: number | string;
  arm_length_in?: number | string;
  neck_in?: number | string;
  thigh_in?: number | string;
  inseam_in?: number | string;
  height_estimate_in?: number | string;
  body_type?: string; // slim/athletic/average/heavy
  posture?: string;
  skin_tone?: string;
  build_notes?: string;
  confidence?: "low" | "medium" | "high";
  raw?: any;
};

export type Profile = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  // Self-reported
  gender: "male" | "female" | "other";
  age?: string;
  height_ft?: string;
  height_in?: string;
  weight_kg?: string;
  notes?: string;
  // Photos (Blobs only — never leave device)
  photos: ProfilePhoto[];
  // AI-derived measurements (latest)
  measurement?: BodyMeasurement;
  measurementUpdatedAt?: number;
  
  // Fit DNA
  fitDNA?: {
    favoriteFit: string;
    comfortPreference: string;
  };
  skin_undertone?: string;
  color_palette?: string[];
};

const PREFIX = "fitcheck:profile:";

export const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export async function saveProfile(p: Profile) {
  p.updatedAt = Date.now();
  await set(PREFIX + p.id, p);
}

export async function getProfile(id: string): Promise<Profile | undefined> {
  return get(PREFIX + id);
}

export async function listProfiles(): Promise<Profile[]> {
  const all = await keys();
  const ours = all.filter((k) => typeof k === "string" && (k as string).startsWith(PREFIX));
  const items = await Promise.all(ours.map((k) => get(k as string)));
  return (items.filter(Boolean) as Profile[]).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProfile(id: string) {
  await del(PREFIX + id);
}

export function blobUrl(b?: Blob | null): string {
  return b ? URL.createObjectURL(b) : "";
}
