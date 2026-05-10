import { z } from "zod";
import { callGemini, tryParseJSON, type GeminiPart } from "./gemini";
import type { BodyMeasurement, Profile, ProfilePhoto } from "./profile";
import { fileToBase64 } from "./gemini";

// --- Schemas ---

export const QualityCheckSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
  pose: z.enum(["front", "side", "back", "apose", "other"]),
  apose_valid: z.boolean().optional(),
});

export const BodyTypeSchema = z.object({
  body_type: z.enum(["slim", "athletic", "average", "heavy"]),
  posture: z.string(),
  skin_tone: z.string(),
  build_notes: z.string(),
});

export const MeasurementSchema = z.object({
  chest_in: z.number().optional(),
  shoulder_in: z.number().optional(),
  waist_in: z.number().optional(),
  hip_in: z.number().optional(),
  torso_length_in: z.number().optional(),
  arm_length_in: z.number().optional(),
  neck_in: z.number().optional(),
  thigh_in: z.number().optional(),
  inseam_in: z.number().optional(),
  height_estimate_in: z.number().optional(),
  confidence: z.enum(["low", "medium", "high"]),
});

export async function checkPhotoQuality(apiKey: string, photo: ProfilePhoto): Promise<z.infer<typeof QualityCheckSchema>> {
  const { data, mime } = await fileToBase64(photo.blob);
  const parts: GeminiPart[] = [
    { text: "Analyze this body photo for tailoring. Return JSON strictly matching this schema: {\"valid\": boolean, \"reason\": \"if invalid, why\", \"pose\": \"front|side|back|apose|other\", \"apose_valid\": boolean}. Reject blurry or extremely dark photos. For 'front' poses, verify 'apose_valid': are the arms slightly lifted away from the torso? If arms are completely flat against the sides obscuring the chest boundary, set 'apose_valid': false and 'valid': false." },
    { inline_data: { mime_type: mime, data } }
  ];
  const text = await callGemini(apiKey, parts, { temperature: 0.1, json: true });
  return QualityCheckSchema.parse(JSON.parse(text));
}

export async function analyzeBodyType(apiKey: string, photos: ProfilePhoto[], profile: Profile): Promise<z.infer<typeof BodyTypeSchema>> {
  const parts: GeminiPart[] = [
    { text: `Analyze the user's body type and skin tone from these photos. User is ${profile.gender}, weight ${profile.weight_kg}kg. Return strict JSON matching: {\"body_type\": \"slim|athletic|average|heavy\", \"posture\": \"string\", \"skin_tone\": \"fair|wheatish|medium|dusky|dark + undertone\", \"build_notes\": \"short notes\"}` }
  ];
  for (const ph of photos) {
    const { data, mime } = await fileToBase64(ph.blob);
    parts.push({ inline_data: { mime_type: mime, data } });
  }
  const text = await callGemini(apiKey, parts, { temperature: 0.2, json: true });
  return BodyTypeSchema.parse(JSON.parse(text));
}

export async function extractMeasurements(apiKey: string, photos: ProfilePhoto[], profile: Profile): Promise<z.infer<typeof MeasurementSchema>> {
  const parts: GeminiPart[] = [
    { text: `Estimate body measurements in inches. 
User height: ${profile.height_ft}'${profile.height_in}". 
CRITICAL CALIBRATION:
1. HEIGHT-PROPORTIONAL BASELINE: Average shoulders are ~25% of height. Start from this baseline and adjust based on whether the user looks broader/narrower than average in the photo.
2. REFERENCE OBJECT: Check if the user is holding a Credit Card (85.6mm wide) or A4 paper (210mm wide). If found, use its pixel-width to calculate exact mathematical measurements for the chest and shoulders.
Return strict JSON with numeric values only matching: {\"chest_in\": number, \"shoulder_in\": number, \"waist_in\": number, \"hip_in\": number, \"torso_length_in\": number, \"arm_length_in\": number, \"neck_in\": number, \"thigh_in\": number, \"inseam_in\": number, \"height_estimate_in\": number, \"confidence\": \"low|medium|high\"}` }
  ];
  for (const ph of photos) {
    const { data, mime } = await fileToBase64(ph.blob);
    parts.push({ inline_data: { mime_type: mime, data } });
  }
  const text = await callGemini(apiKey, parts, { temperature: 0.1, json: true, timeoutMs: 90000 });
  return MeasurementSchema.parse(JSON.parse(text));
}

export async function measureBody(
  apiKey: string,
  profile: Profile,
  opts: { signal?: AbortSignal; onProgress?: (msg: string) => void } = {},
): Promise<BodyMeasurement> {
  if (!profile.photos.length) throw new Error("Add at least one photo first");
  
  // Pipeline 1: Quality Check
  opts.onProgress?.("Pipeline 1: Checking image quality...");
  for (const ph of profile.photos) {
    const quality = await checkPhotoQuality(apiKey, ph);
    if (!quality.valid) {
      throw new Error(`Photo rejected: ${quality.reason || "Poor quality"}`);
    }
  }

  // Pipeline 2: Body Type
  opts.onProgress?.("Pipeline 2: Analyzing body type & tone...");
  const bodyType = await analyzeBodyType(apiKey, profile.photos, profile);

  // Pipeline 3: Measurements
  opts.onProgress?.("Pipeline 3: Extracting landmarks and measuring...");
  const measurements = await extractMeasurements(apiKey, profile.photos, profile);

  return {
    ...measurements,
    ...bodyType,
    raw: { bodyType, measurements }
  };
}

export const PHOTO_GUIDE: { pose: ProfilePhoto["pose"]; title: string; tip: string }[] = [
  { pose: "front", title: "Front view (A-Pose)", tip: "Stand straight, arms slightly lifted away from body (A-Pose). Hold a Credit Card against your chest for highest accuracy." },
  { pose: "side", title: "Side view", tip: "Turn 90°. Arms relaxed. Helps with waist and posture." },
  { pose: "back", title: "Back view (optional)", tip: "Helps with precise shoulder width measurement." },
];

export const PHOTO_RULES = [
  "Wear fitted clothing (or as little loose fabric as possible).",
  "Ensure arms are slightly lifted (A-Pose) so the chest is visible.",
  "Hold a standard credit card flat against your chest for mathematical scaling.",
  "Phone camera vertical, at chest height, ~2 meters away.",
  "Whole body in frame from head to toes.",
];
