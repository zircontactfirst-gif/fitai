import { get, set, del } from "idb-keyval";
import type { Profile } from "./profile";

export type PendingAnalysis = {
  id: string;
  createdAt: number;
  profile?: Profile | null;
  // Manual user fallback (when no profile selected)
  manual?: {
    height_ft?: string;
    height_in?: string;
    weight_kg?: string;
    age?: string;
    gender?: "male" | "female" | "other";
    chest_in?: string;
    shoulder_in?: string;
    waist_in?: string;
    length_in?: string;
    userPhoto?: Blob;
  };
  product: {
    name?: string;
    type: string;
    color?: string;
    fabric?: string;
    fit_label?: string;
    brand?: string;
    occasion?: string;
    chest_in?: string;
    shoulder_in?: string;
    length_in?: string;
    sleeve_in?: string;
    waist_in?: string;
    hip_in?: string;
    inseam_in?: string;
    size?: string;
    photos?: Blob[];
    notes?: string;
  };
};

const KEY = (id: string) => `fitcheck:pending:${id}`;

export const setPending = (p: PendingAnalysis) => set(KEY(p.id), p);
export const getPending = (id: string) => get<PendingAnalysis>(KEY(id));
export const delPending = (id: string) => del(KEY(id));
