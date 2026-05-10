import { z } from "zod";
import { callGemini, fileToBase64, type GeminiPart } from "./gemini";

export const ParsedSizeChartSchema = z.object({
  chest_in: z.number().optional(),
  shoulder_in: z.number().optional(),
  length_in: z.number().optional(),
  sleeve_in: z.number().optional(),
  waist_in: z.number().optional(),
  hip_in: z.number().optional(),
  inseam_in: z.number().optional(),
});

export async function parseSizeChart(apiKey: string, file: File, targetSize?: string): Promise<z.infer<typeof ParsedSizeChartSchema>> {
  const { data, mime } = await fileToBase64(file);
  const parts: GeminiPart[] = [
    { text: `Extract the measurements for the size "${targetSize || "M"}" from this size chart image. If a measurement is not available, leave it out. Assume inches unless it clearly says cm. If it is cm, convert it to inches. Return STRICT JSON only matching this schema: {"chest_in": number, "shoulder_in": number, "length_in": number, "sleeve_in": number, "waist_in": number, "hip_in": number, "inseam_in": number}` },
    { inline_data: { mime_type: mime, data } }
  ];
  const text = await callGemini(apiKey, parts, { temperature: 0.1, json: true, timeoutMs: 60000 });
  return ParsedSizeChartSchema.parse(JSON.parse(text));
}
