import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getPending, delPending } from "@/lib/pending";
import { useApiKey, ApiKeyDialog } from "@/components/ApiKeyManager";
import { callGemini, fileToBase64, tryParseJSON, type GeminiPart } from "@/lib/gemini";
import { formatSizeChartForPrompt, suggestSize, type GenderKey } from "@/lib/sizeChart";
import { saveHistory, newId as histId } from "@/lib/history";
import { calculateFit } from "@/lib/fitMath";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Sparkles, Save, AlertTriangle, CheckCircle2, RefreshCw, Key } from "lucide-react";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/result")({
  validateSearch: (s: Record<string, unknown>) => ({ key: (s.key as string) || "" }),
  head: () => ({ meta: [{ title: "Analysis Result — FitCheck AI" }] }),
  component: ResultPage,
});

type DeepResult = {
  recommended_size?: string;
  size_confidence?: "low" | "medium" | "high";
  alternative_sizes?: { size: string; reason: string }[];
  estimated_user_measurements?: Record<string, string | number>;
  product_measurements_used?: Record<string, string | number>;
  fit_prediction?: { area: string; verdict: "Tight" | "Perfect" | "Loose" | "Slightly Tight" | "Slightly Loose"; mm_diff?: string; note: string }[];
  ease_analysis?: { area: string; ease_in: string; comment: string }[];
  fabric_drape_estimate?: string;
  movement_comfort?: string;
  visual_preview?: string;
  styling_advice?: string;
  color_advice?: string;
  occasion_match?: string;
  pros?: string[];
  cons?: string[];
  risks?: string[];
  alternative_suggestion?: string;
  return_likelihood?: string;
  overall_score?: number;
  overall_score?: number;
  expert_verdict_bn?: string;
  expert_verdict_en?: string;
  // Advanced Accuracy Metrics
  fabric_composition?: string;
  stretch_factor?: "low" | "medium" | "high";
  cut_style?: string;
  shrinkage_risk?: "low" | "high";
  waist_fastening?: "elastic" | "button" | "drawstring" | "unknown";
  
  // Master Tailor Additions
  alteration_complexity?: "low" | "medium" | "high" | "impossible";
  tension_lines?: string[];
  durability_score?: number;
};

function ResultPage() {
  const { key } = useSearch({ from: "/result" });
  const { apiKey, save } = useApiKey();
  const [keyOpen, setKeyOpen] = useState(false);
  const [stage, setStage] = useState("Loading payload...");
  const [pct, setPct] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<DeepResult | null>(null);
  const [raw, setRaw] = useState<string>("");
  const [retryKey, setRetryKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const payloadRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    let ticker: any;
    (async () => {
      setLoading(true);
      setError("");
      setResult(null);
      setPct(5);
      setStage("Loading payload...");
      try {
        if (!key) throw new Error("Missing analysis key");
        const payload = await getPending(key);
        if (!payload) throw new Error("Analysis payload expired — start again");
        payloadRef.current = payload;
        if (!apiKey) { setKeyOpen(true); throw new Error("Add your Gemini API key to continue"); }

        const productType = payload.product.type;
        const gender: GenderKey = (payload.profile?.gender ?? payload.manual?.gender ?? "male") as GenderKey;

        // Build heuristic prior
        const m = payload.profile?.measurement;
        const ft = parseFloat(payload.profile?.height_ft || payload.manual?.height_ft || "0");
        const inch = parseFloat(payload.profile?.height_in || payload.manual?.height_in || "0");
        const heuristic = suggestSize({
          productType,
          gender,
          chest_in: numberish(m?.chest_in) ?? num(payload.manual?.chest_in),
          shoulder_in: numberish(m?.shoulder_in) ?? num(payload.manual?.shoulder_in),
          waist_in: numberish(m?.waist_in) ?? num(payload.manual?.waist_in),
          height_in: ft * 12 + inch || undefined,
          weight_kg: num(payload.profile?.weight_kg || payload.manual?.weight_kg),
        });
        const chart = formatSizeChartForPrompt(productType, gender);

        setStage("Encoding photos...");
        setPct(20);
        const parts: GeminiPart[] = [{ text: buildExpertPrompt(payload, chart, heuristic) }];

        // Profile photos
        if (payload.profile) {
          for (const ph of payload.profile.photos.slice(0, 4)) {
            const { data, mime } = await fileToBase64(ph.blob);
            parts.push({ text: `USER PHOTO (pose: ${ph.pose})` });
            parts.push({ inline_data: { mime_type: mime, data } });
          }
        } else if (payload.manual?.userPhoto) {
          const { data, mime } = await fileToBase64(payload.manual.userPhoto);
          parts.push({ text: "USER PHOTO" });
          parts.push({ inline_data: { mime_type: mime, data } });
        }
        if (payload.product.photos && payload.product.photos.length > 0) {
          for (let i = 0; i < payload.product.photos.length; i++) {
            const { data, mime } = await fileToBase64(payload.product.photos[i]);
            parts.push({ text: `PRODUCT PHOTO ${i + 1}` });
            parts.push({ inline_data: { mime_type: mime, data } });
          }
        }

        if (cancelled) return;
        setStage("Deep researching fit with Gemini (this takes 30–90s)...");
        setPct(35);
        abortRef.current = new AbortController();
        let p = 35;
        ticker = setInterval(() => { p = Math.min(p + 2, 92); setPct(p); }, 2000);

        const text = await callGemini(apiKey, parts, {
          signal: abortRef.current.signal,
          timeoutMs: 180_000,
          retries: 2,
          temperature: 0.3,
          json: true,
        });
        clearInterval(ticker);
        if (cancelled) return;
        setStage("Parsing expert verdict...");
        setPct(96);
        setRaw(text);
        const parsed = tryParseJSON<DeepResult>(text);
        if (!parsed) throw new Error("Could not parse AI JSON");

        // Deterministic Fit Math replacing AI guessing
        const userM = parsed.estimated_user_measurements || {};
        const prodM = parsed.product_measurements_used || {};
        const fitOptions = {
          stretchFactor: parsed.stretch_factor,
          cutStyle: parsed.cut_style,
          shrinkageRisk: parsed.shrinkage_risk,
          fastening: parsed.waist_fastening,
        };
        const fitMathResult = calculateFit(userM, prodM, fitOptions as any);
        
        parsed.fit_prediction = [
          { area: "Overall", verdict: fitMathResult.overallFit as any, note: "Calculated deterministically" },
          { area: "Chest", verdict: fitMathResult.chest as any, note: "" },
          { area: "Shoulder", verdict: fitMathResult.shoulder as any, note: "" },
          { area: "Waist", verdict: fitMathResult.waist as any, note: "" },
          { area: "Length", verdict: fitMathResult.length as any, note: "" },
        ].filter(f => f.verdict !== "Unknown") as any;

        parsed.ease_analysis = fitMathResult.notes.map(n => ({ area: "Note", ease_in: "-", comment: n }));

        setResult(parsed);
        setPct(100);
        toast.success("Analysis complete");
      } catch (e: any) {
        if (e?.name === "AbortError") setError("Cancelled");
        else setError(e?.message || "Failed");
      } finally {
        if (ticker) clearInterval(ticker);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; abortRef.current?.abort(); if (ticker) clearInterval(ticker); };
  }, [key, apiKey, retryKey]);

  const onSave = async () => {
    const payload = payloadRef.current;
    if (!result || !payload) return;
    try {
      await saveHistory({
        id: histId(),
        createdAt: Date.now(),
        title: `${payload.product.name || payload.product.type}${result.recommended_size ? ` — ${result.recommended_size}` : ""}`,
        user: {
          height_ft: payload.profile?.height_ft || payload.manual?.height_ft,
          height_in: payload.profile?.height_in || payload.manual?.height_in,
          weight: payload.profile?.weight_kg || payload.manual?.weight_kg,
          age: payload.profile?.age || payload.manual?.age,
          gender: payload.profile?.gender || payload.manual?.gender,
          chest: String(payload.profile?.measurement?.chest_in || payload.manual?.chest_in || ""),
          shoulder: String(payload.profile?.measurement?.shoulder_in || payload.manual?.shoulder_in || ""),
          length: String(payload.profile?.measurement?.torso_length_in || payload.manual?.length_in || ""),
          waist: String(payload.profile?.measurement?.waist_in || payload.manual?.waist_in || ""),
        },
        product: {
          name: payload.product.name, type: payload.product.type, color: payload.product.color,
          chest: payload.product.chest_in, shoulder: payload.product.shoulder_in,
          length: payload.product.length_in, sleeve: payload.product.sleeve_in,
          waist: payload.product.waist_in, size: payload.product.size,
        },
        notes: payload.product.notes,
        userPhoto: payload.profile?.photos[0]?.blob ?? payload.manual?.userPhoto,
        productPhotos: payload.product.photos,
        result,
      });
      toast.success("Saved to history");
    } catch (e: any) { toast.error("Save failed: " + e?.message); }
  };

  const cleanup = async () => { if (key) await delPending(key); };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <ApiKeyDialog open={keyOpen} onOpenChange={setKeyOpen} apiKey={apiKey} onSave={save} />

      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon" onClick={cleanup}><Link to="/"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div>
              <h1 className="text-base font-semibold">Expert Fit Report</h1>
              <p className="text-xs text-muted-foreground">Powered by Gemini deep analysis</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setKeyOpen(true)}>
            <Key className="mr-1 h-4 w-4" /> Key
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl space-y-5 px-4 py-6">
        {loading && (
          <Card>
            <CardContent className="space-y-3 py-8">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> {stage}
              </div>
              <Progress value={pct} />
              <p className="text-xs text-muted-foreground">
                Deep multimodal analysis. We use long timeouts (3 min) and auto-retry to handle slow networks.
              </p>
              <Button variant="outline" size="sm" onClick={() => abortRef.current?.abort()}>Cancel</Button>
            </CardContent>
          </Card>
        )}

        {error && !loading && (
          <Card className="border-destructive/40">
            <CardContent className="space-y-3 py-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <p className="font-medium">{error}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setRetryKey((k) => k + 1)}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
                <Button asChild variant="outline"><Link to="/">Back</Link></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {result && <ExpertResultView r={result} onSave={onSave} />}

        {!result && raw && !loading && (
          <Card><CardContent className="py-4"><pre className="max-h-96 overflow-auto text-xs">{raw}</pre></CardContent></Card>
        )}
      </main>
    </div>
  );
}

function ExpertResultView({ r, onSave }: { r: DeepResult; onSave: () => void }) {
  const score = r.overall_score ?? 0;
  const tone = score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-destructive";
  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Recommended Size</p>
            <p className="text-4xl font-bold">{r.recommended_size ?? "—"}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {r.size_confidence && <Badge variant="outline">{r.size_confidence} confidence</Badge>}
              {r.alternative_sizes?.map((a, i) => (
                <Badge key={i} variant="secondary" className="text-xs">alt: {a.size}</Badge>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Match Score</p>
            <p className={`text-4xl font-bold ${tone}`}>{score}<span className="text-base text-muted-foreground">/100</span></p>
            {r.return_likelihood && <p className="text-xs text-muted-foreground">Return risk: {r.return_likelihood}</p>}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="verdict">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="verdict">Verdict</TabsTrigger>
          <TabsTrigger value="fit">Fit</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="verdict" className="space-y-3 pt-4">
          {r.expert_verdict_bn && (
            <Card className="border-primary/50 bg-primary/5"><CardContent className="py-4">
              <p className="mb-1 text-xs font-semibold text-primary">বিশেষজ্ঞ মতামত (Master Tailor Verdict)</p>
              <p className="text-sm leading-relaxed">{r.expert_verdict_bn}</p>
            </CardContent></Card>
          )}
          {r.expert_verdict_en && (
            <Card className="border-primary/50 bg-primary/5"><CardContent className="py-4">
              <p className="mb-1 text-xs font-semibold text-primary">Expert Verdict (English)</p>
              <p className="text-sm leading-relaxed">{r.expert_verdict_en}</p>
            </CardContent></Card>
          )}

          {(r.alteration_complexity || (r.tension_lines && r.tension_lines.length > 0)) && (
            <Card>
              <CardContent className="py-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Sparkles className="h-3 w-3" /> Tailor's Assessment</p>
                {r.alteration_complexity && (
                  <div className="flex items-center justify-between text-sm">
                    <span>Alteration Complexity:</span>
                    <Badge variant={r.alteration_complexity === "impossible" || r.alteration_complexity === "high" ? "destructive" : r.alteration_complexity === "medium" ? "secondary" : "outline"}>
                      {r.alteration_complexity}
                    </Badge>
                  </div>
                )}
                {r.tension_lines && r.tension_lines.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-sm">Identified Tension Lines:</span>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground">
                      {r.tension_lines.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {r.visual_preview && (
            <Card><CardContent className="py-4">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">How it will look on you</p>
              <p className="text-sm leading-relaxed">{r.visual_preview}</p>
            </CardContent></Card>
          )}
          <List title="Pros" items={r.pros} icon="ok" />
          <List title="Cons" items={r.cons} icon="warn" />
          <List title="Risks" items={r.risks} icon="warn" />
          {r.alternative_suggestion && (
            <Card><CardContent className="py-4">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Alternative suggestion</p>
              <p className="text-sm">{r.alternative_suggestion}</p>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="fit" className="space-y-3 pt-4">
          <Card><CardContent className="py-4 space-y-2">
            {r.fit_prediction?.map((f, i) => (
              <div key={i} className="flex items-start gap-3 rounded-md border border-border p-3">
                <Badge
                  className={
                    f.verdict === "Perfect" ? "bg-green-600 hover:bg-green-600" :
                    f.verdict === "Tight" || f.verdict === "Slightly Tight" ? "bg-destructive hover:bg-destructive" :
                    "bg-amber-500 hover:bg-amber-500"
                  }
                >{f.verdict}</Badge>
                <div className="flex-1 text-sm">
                  <p className="font-medium capitalize">{f.area}{f.mm_diff ? ` (${f.mm_diff})` : ""}</p>
                  <p className="text-xs text-muted-foreground">{f.note}</p>
                </div>
              </div>
            ))}
          </CardContent></Card>
          {r.ease_analysis && r.ease_analysis.length > 0 && (
            <Card><CardContent className="py-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Ease analysis (garment − body)</p>
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                {r.ease_analysis.map((e, i) => (
                  <div key={i} className="rounded-md bg-muted/40 p-2">
                    <p className="font-medium capitalize">{e.area} · {e.ease_in}</p>
                    <p className="text-muted-foreground">{e.comment}</p>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          )}
          {(r.fabric_drape_estimate || r.movement_comfort) && (
            <Card><CardContent className="py-4 space-y-2 text-sm">
              {r.fabric_drape_estimate && <p><span className="text-xs font-semibold text-muted-foreground">Fabric drape: </span>{r.fabric_drape_estimate}</p>}
              {r.movement_comfort && <p><span className="text-xs font-semibold text-muted-foreground">Movement comfort: </span>{r.movement_comfort}</p>}
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="style" className="space-y-3 pt-4">
          {r.color_advice && <Card><CardContent className="py-4 text-sm"><p className="mb-1 text-xs font-semibold text-muted-foreground">Color advice</p>{r.color_advice}</CardContent></Card>}
          {r.styling_advice && <Card><CardContent className="py-4 text-sm"><p className="mb-1 text-xs font-semibold text-muted-foreground">Styling advice</p>{r.styling_advice}</CardContent></Card>}
          {r.occasion_match && <Card><CardContent className="py-4 text-sm"><p className="mb-1 text-xs font-semibold text-muted-foreground">Occasion match</p>{r.occasion_match}</CardContent></Card>}
          
          {(r.fabric_composition || r.stretch_factor || r.cut_style) && (
            <Card>
              <CardContent className="py-4 space-y-2 text-sm">
                {r.fabric_composition && <p><span className="text-xs font-semibold text-muted-foreground">Fabric: </span>{r.fabric_composition}</p>}
                {r.stretch_factor && <p className="flex justify-between items-center"><span className="text-xs font-semibold text-muted-foreground">Stretch: </span><Badge variant="outline">{r.stretch_factor}</Badge></p>}
                {r.cut_style && <p className="flex justify-between items-center"><span className="text-xs font-semibold text-muted-foreground">Cut/Style: </span><span>{r.cut_style}</span></p>}
                {r.shrinkage_risk === "high" && <p className="flex justify-between items-center"><span className="text-xs font-semibold text-destructive">Shrinkage Risk: </span><span>High - Consider sizing up</span></p>}
                {r.durability_score !== undefined && <p className="flex justify-between items-center"><span className="text-xs font-semibold text-muted-foreground">Durability Score: </span><span className={r.durability_score >= 70 ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>{r.durability_score}/100</span></p>}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="data" className="space-y-3 pt-4">
          <DataTable title="Estimated user measurements" data={r.estimated_user_measurements} />
          <DataTable title="Product measurements used" data={r.product_measurements_used} />
          {r.alternative_sizes && r.alternative_sizes.length > 0 && (
            <Card><CardContent className="py-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Alternative sizes</p>
              <div className="space-y-2 text-sm">
                {r.alternative_sizes.map((a, i) => (
                  <div key={i} className="rounded-md border border-border p-2">
                    <p className="font-medium">{a.size}</p>
                    <p className="text-xs text-muted-foreground">{a.reason}</p>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex gap-2">
        <Button onClick={onSave} variant="outline" className="flex-1"><Save className="mr-2 h-4 w-4" /> Save to History</Button>
        <Button asChild className="flex-1"><Link to="/"><Sparkles className="mr-2 h-4 w-4" /> New analysis</Link></Button>
      </div>
    </div>
  );
}

function DataTable({ title, data }: { title: string; data?: Record<string, any> }) {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <Card><CardContent className="py-4">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">{title}</p>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex justify-between rounded bg-muted/40 px-2 py-1">
            <span className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}</span>
            <span className="font-medium">{String(v)}</span>
          </div>
        ))}
      </div>
    </CardContent></Card>
  );
}

function List({ title, items, icon }: { title: string; items?: string[]; icon: "ok" | "warn" }) {
  if (!items?.length) return null;
  const Icon = icon === "ok" ? CheckCircle2 : AlertTriangle;
  const cls = icon === "ok" ? "text-green-600" : "text-amber-600";
  return (
    <Card><CardContent className="py-4">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">{title}</p>
      <ul className="space-y-1.5">
        {items.map((p, i) => (
          <li key={i} className="flex gap-2 text-sm"><Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} />{p}</li>
        ))}
      </ul>
    </CardContent></Card>
  );
}

function num(v?: string) { const n = parseFloat(v || ""); return isNaN(n) ? undefined : n; }
function numberish(v: any) { if (v == null) return undefined; const n = parseFloat(String(v)); return isNaN(n) ? undefined : n; }

function buildExpertPrompt(payload: any, chart: string, heuristic: any): string {
  const profile = payload.profile;
  const m = profile?.measurement;
  const userBlock = profile ? {
    source: "saved_profile",
    name: profile.name,
    gender: profile.gender,
    age: profile.age || null,
    height: `${profile.height_ft || 0}ft ${profile.height_in || 0}in`,
    weight_kg: profile.weight_kg || null,
    notes: profile.notes || null,
    ai_measurements: m || null,
    photos_provided: profile.photos.length,
  } : {
    source: "manual",
    ...payload.manual,
  };

  return `You are a senior tailor + fashion fit consultant with 20 years of experience dressing Bangladeshi customers (Aarong, Yellow, Cats Eye markets). Your job is to give an EXPERT, evidence-based fit verdict.

THINK STEP BY STEP (silently, do not output reasoning):
1. Reconcile user data: prefer AI-measured body measurements from the profile.
2. Reconcile product data: use given product measurements. If missing, infer from labeled size + size chart + multiple product photos. Look for Model Calibration text (e.g., "Model is 6'1 wearing size M") to scale the garment accurately.
3. Decide BEST size from BD chart. Provide 1–2 alternative sizes with trade-offs.
4. Estimate fabric drape, composition (check for care labels), and compute a stretch_factor (low/medium/high). Note the waist_fastening (elastic/button/drawstring).
5. Identify cut_style (e.g. drop-shoulder, tapered, oversized) and shrinkage_risk (high if 100% linen/viscose).
6. Give visual description, color advice considering skin tone, occasion match, styling tips.
7. Estimate return-likelihood (very low / low / medium / high) honestly.
8. Score 0–100 overall.
9. Write expert verdict in Bangla AND English.

USER:
${JSON.stringify(userBlock, null, 2)}

PRODUCT:
${JSON.stringify(payload.product, null, 2)}

LOCAL HEURISTIC SIZE PRIOR: ${heuristic.size || "none"} (source: ${heuristic.source}). Use as a prior but override if your analysis disagrees.

${chart}

Return STRICT JSON ONLY (no markdown, no prose) matching this schema:
{
  "recommended_size": "S|M|L|XL|XXL|3XL",
  "size_confidence": "low|medium|high",
  "alternative_sizes": [{ "size": "", "reason": "" }],
  "estimated_user_measurements": { "chest_in": "", "shoulder_in": "", "waist_in": "", "hip_in": "", "torso_length_in": "", "arm_length_in": "", "body_type": "" },
  "product_measurements_used": { "chest_in": "", "shoulder_in": "", "length_in": "", "sleeve_in": "", "waist_in": "", "fit_type": "", "fabric_guess": "" },
  "fabric_composition": "e.g. 95% Cotton, 5% Spandex",
  "stretch_factor": "low|medium|high",
  "cut_style": "e.g. drop-shoulder",
  "shrinkage_risk": "low|high",
  "waist_fastening": "elastic|button|drawstring|unknown",
  "fabric_drape_estimate": "",
  "movement_comfort": "",
  "visual_preview": "vivid 3-4 line description of how it will look on this person",
  "styling_advice": "what pants/shoes/layers pair well",
  "color_advice": "honest take on color vs. user's skin tone",
  "occasion_match": "",
  "pros": [""],
  "cons": [""],
  "risks": ["e.g. shoulder may feel tight when raising arms"],
  "alternative_suggestion": "if fit is poor, what to look for instead",
  "return_likelihood": "very low|low|medium|high",
  "overall_score": 0,
  "alteration_complexity": "low|medium|high|impossible",
  "tension_lines": ["e.g. X-folds forming at the waist button"],
  "durability_score": 0,
  "expert_verdict_bn": "৩-৫ লাইনের বাংলা মতামত",
  "expert_verdict_en": "3-5 line English verdict"
}
`;
}
