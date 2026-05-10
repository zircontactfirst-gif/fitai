export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export type CallOptions = {
  model?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
  temperature?: number;
  json?: boolean;
};

export async function callGemini(
  apiKey: string,
  parts: GeminiPart[],
  opts: CallOptions | string = {},
): Promise<string> {
  // Backwards compat: callGemini(key, parts, "model-name")
  const o: CallOptions = typeof opts === "string" ? { model: opts } : opts;
  const model = o.model ?? "gemini-flash-latest";
  const timeoutMs = o.timeoutMs ?? 120_000;
  const retries = o.retries ?? 1;
  const temperature = o.temperature ?? 0.4;
  const json = o.json !== false;

  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController();
    const userAbort = () => ctl.abort();
    if (o.signal) {
      if (o.signal.aborted) ctl.abort();
      else o.signal.addEventListener("abort", userAbort);
    }
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": apiKey,
          },
          signal: ctl.signal,
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature,
              ...(json ? { responseMimeType: "application/json" } : {}),
            },
          }),
        },
      );
      if (!res.ok) {
        const t2 = await res.text();
        throw new Error(`Gemini error ${res.status}: ${t2.slice(0, 300)}`);
      }
      const data = await res.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
      if (!text) throw new Error("Empty response from Gemini");
      return text;
    } catch (e: any) {
      lastErr = e;
      const aborted = e?.name === "AbortError";
      const userCancelled = aborted && o.signal?.aborted;
      if (userCancelled) throw e;
      if (attempt === retries) break;
      // backoff
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    } finally {
      clearTimeout(t);
      if (o.signal) o.signal.removeEventListener("abort", userAbort);
    }
  }
  throw lastErr ?? new Error("Gemini call failed");
}

import { compressImage } from "./imageUtils";

export async function fileToBase64(file: File | Blob): Promise<{ data: string; mime: string }> {
  return compressImage(file);
}

export function tryParseJSON<T = any>(text: string): T | null {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
