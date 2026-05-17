import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiKeyDialog, useApiKey } from "@/components/ApiKeyManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Upload, Key, Shirt, Ruler, Camera, X, User, Plus, History as HistoryIcon } from "lucide-react";
import { toast, Toaster } from "sonner";
import { suggestSize, type GenderKey } from "@/lib/sizeChart";
import { parseSizeChart } from "@/lib/sizeChartParser";
import { listProfiles, getProfile, blobUrl, type Profile } from "@/lib/profile";
import { setPending, type PendingAnalysis } from "@/lib/pending";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>) => ({ profile: (s.profile as string) || "" }),
  head: () => ({
    meta: [
      { title: "FitCheck AI — Outfit & Size Analyzer" },
      { name: "description", content: "AI-powered outfit fit analyzer for Bangladeshi shoppers. Find your perfect size before buying online." },
    ],
  }),
  component: HomePage,
});

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function HomePage() {
  const { apiKey, save } = useApiKey();
  const [keyOpen, setKeyOpen] = useState(false);
  const nav = useNavigate();
  const { profile: profileQuery } = useSearch({ from: "/" });

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [profile, setProfile] = useState<Profile | null>(null);

  // Manual fallback (when no profile)
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [bodyChest, setBodyChest] = useState("");
  const [bodyShoulder, setBodyShoulder] = useState("");
  const [bodyWaist, setBodyWaist] = useState("");
  const [bodyLength, setBodyLength] = useState("");
  const [userPhoto, setUserPhoto] = useState<File | null>(null);
  const [userPhotoUrl, setUserPhotoUrl] = useState("");

  // product
  const [productName, setProductName] = useState("");
  const [productType, setProductType] = useState("Shirt");
  const [productColor, setProductColor] = useState("");
  const [productFabric, setProductFabric] = useState("");
  const [productFitLabel, setProductFitLabel] = useState("Regular");
  const [productBrand, setProductBrand] = useState("");
  const [productOccasion, setProductOccasion] = useState("");
  const [productPhotos, setProductPhotos] = useState<File[]>([]);
  const [productPhotoUrls, setProductPhotoUrls] = useState<string[]>([]);
  const [pChest, setPChest] = useState("");
  const [pShoulder, setPShoulder] = useState("");
  const [pLength, setPLength] = useState("");
  const [pSleeve, setPSleeve] = useState("");
  const [pWaist, setPWaist] = useState("");
  const [pHip, setPHip] = useState("");
  const [pInseam, setPInseam] = useState("");
  const [pSize, setPSize] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [parsingChart, setParsingChart] = useState(false);

  const userFileRef = useRef<HTMLInputElement>(null);
  const productFileRef = useRef<HTMLInputElement>(null);
  const chartFileRef = useRef<HTMLInputElement>(null);

  const handleChartUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!apiKey) { toast.error("Add Gemini API key first"); return; }
    setParsingChart(true);
    try {
      const parsed = await parseSizeChart(apiKey, file, pSize || "M");
      if (parsed.chest_in) setPChest(String(parsed.chest_in));
      if (parsed.shoulder_in) setPShoulder(String(parsed.shoulder_in));
      if (parsed.length_in) setPLength(String(parsed.length_in));
      if (parsed.sleeve_in) setPSleeve(String(parsed.sleeve_in));
      if (parsed.waist_in) setPWaist(String(parsed.waist_in));
      if (parsed.hip_in) setPHip(String(parsed.hip_in));
      if (parsed.inseam_in) setPInseam(String(parsed.inseam_in));
      toast.success("Size chart parsed successfully");
    } catch (err: any) {
      toast.error("Failed to parse size chart: " + err.message);
    } finally {
      setParsingChart(false);
      if (chartFileRef.current) chartFileRef.current.value = "";
    }
  };

  useEffect(() => { listProfiles().then(setProfiles); }, []);
  useEffect(() => {
    if (profileQuery && !selectedProfileId) setSelectedProfileId(profileQuery);
  }, [profileQuery, selectedProfileId]);
  useEffect(() => {
    if (selectedProfileId) getProfile(selectedProfileId).then((p) => setProfile(p ?? null));
    else setProfile(null);
  }, [selectedProfileId]);

  const handleUserPhoto = (f: File | null) => {
    setUserPhoto(f);
    if (userPhotoUrl) URL.revokeObjectURL(userPhotoUrl);
    setUserPhotoUrl(f ? URL.createObjectURL(f) : "");
  };
  const handleProductPhotos = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    setProductPhotos((prev) => [...prev, ...newFiles]);
    const newUrls = newFiles.map((f) => URL.createObjectURL(f));
    setProductPhotoUrls((prev) => [...prev, ...newUrls]);
  };

  const removeProductPhoto = (index: number) => {
    setProductPhotos((prev) => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(productPhotoUrls[index]);
    setProductPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const effectiveGender: GenderKey = (profile?.gender ?? gender) as GenderKey;
  const chartSuggestion = useMemo(() => {
    const m = profile?.measurement;
    const ft = parseFloat(profile?.height_ft || heightFt) || 0;
    const inch = parseFloat(profile?.height_in || heightIn) || 0;
    const num = (v: any) => { const n = parseFloat(String(v ?? "")); return isNaN(n) ? undefined : n; };
    return suggestSize({
      productType,
      gender: effectiveGender,
      chest_in: num(m?.chest_in) ?? num(bodyChest),
      shoulder_in: num(m?.shoulder_in) ?? num(bodyShoulder),
      waist_in: num(m?.waist_in) ?? num(bodyWaist),
      height_in: ft * 12 + inch || undefined,
      weight_kg: num(profile?.weight_kg) ?? num(weight),
    });
  }, [profile, productType, effectiveGender, bodyChest, bodyShoulder, bodyWaist, heightFt, heightIn, weight]);

  const onAnalyze = async () => {
    if (!apiKey) { toast.error("Add your Gemini API key first"); setKeyOpen(true); return; }
    if (!profile && !userPhoto && !heightFt && !weight) {
      toast.error("Add a profile or fill in some body info");
      return;
    }
    const id = newId();
    const payload: PendingAnalysis = {
      id,
      createdAt: Date.now(),
      profile: profile ?? null,
      manual: profile ? undefined : {
        height_ft: heightFt, height_in: heightIn, weight_kg: weight, age, gender,
        chest_in: bodyChest, shoulder_in: bodyShoulder, waist_in: bodyWaist, length_in: bodyLength,
        userPhoto: userPhoto ?? undefined,
      },
      product: {
        name: productName, type: productType, color: productColor, fabric: productFabric,
        fit_label: productFitLabel, brand: productBrand, occasion: productOccasion,
        chest_in: pChest, shoulder_in: pShoulder, length_in: pLength, sleeve_in: pSleeve,
        waist_in: pWaist, hip_in: pHip, inseam_in: pInseam, size: pSize,
        photos: productPhotos, notes: extraNotes,
      },
    };
    await setPending(payload);
    nav({ to: "/result", search: { key: id } });
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <ApiKeyDialog open={keyOpen} onOpenChange={setKeyOpen} apiKey={apiKey} onSave={save} />

      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shirt className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">FitCheck AI</h1>
              <p className="text-xs text-muted-foreground">Outfit & size analyzer</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/history"><HistoryIcon className="h-4 w-4" /></Link></Button>
            <Button variant={apiKey ? "outline" : "default"} size="sm" onClick={() => setKeyOpen(true)}>
              <Key className="mr-1 h-4 w-4" /> {apiKey ? "Key" : "Add Key"}
            </Button>
          </div>
        </div>
      </header>

      <section className="border-b border-border bg-gradient-to-b from-secondary/40 to-background">
        <div className="container mx-auto px-4 py-8 text-center md:py-12">
          <Badge variant="secondary" className="mb-3"><Sparkles className="mr-1 h-3 w-3" /> Powered by Gemini deep analysis</Badge>
          <h2 className="mx-auto max-w-2xl text-2xl font-bold tracking-tight md:text-4xl">Will this outfit really fit you?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Save a body profile once — then check any product in seconds with an expert AI verdict.
          </p>
        </div>
      </section>

      <main className="container mx-auto max-w-3xl space-y-5 px-4 py-6">
        {/* Profile selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><User className="h-4 w-4" /> Whose body?</CardTitle>
            <CardDescription>Pick a saved profile (with AI-measured body) or fill in manually below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={selectedProfileId || "__none"} onValueChange={(v) => setSelectedProfileId(v === "__none" ? "" : v)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select profile" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Manual (no profile) —</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.measurement ? "✓" : "(unmeasured)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button asChild variant="outline"><Link to="/profiles/new"><Plus className="mr-1 h-4 w-4" /> New profile</Link></Button>
            </div>
            {profile && (
              <div className="flex gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                {profile.photos[0] && (
                  <img src={blobUrl(profile.photos[0].blob)} className="h-20 w-16 rounded object-cover" alt={profile.name} />
                )}
                <div className="flex-1 text-sm">
                  <p className="font-medium">{profile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {profile.gender} · {profile.height_ft}′{profile.height_in}″ · {profile.weight_kg ? `${profile.weight_kg}kg` : "—"}
                  </p>
                  {profile.measurement ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {profile.measurement.chest_in && <Badge variant="outline" className="text-[10px]">Chest {profile.measurement.chest_in}″</Badge>}
                      {profile.measurement.shoulder_in && <Badge variant="outline" className="text-[10px]">Sh {profile.measurement.shoulder_in}″</Badge>}
                      {profile.measurement.waist_in && <Badge variant="outline" className="text-[10px]">Waist {profile.measurement.waist_in}″</Badge>}
                      {profile.measurement.body_type && <Badge variant="outline" className="text-[10px]">{profile.measurement.body_type}</Badge>}
                    </div>
                  ) : (
                    <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                      <Link to="/profiles/$id" params={{ id: profile.id }}>Add photos & measure →</Link>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {!profile && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Ruler className="h-4 w-4" /> Quick body info</CardTitle>
              <CardDescription>Optional — but more data = more accurate fit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div><Label>Height (ft)</Label><Input type="number" placeholder="5" value={heightFt} onChange={(e) => setHeightFt(e.target.value)} /></div>
                <div><Label>Height (in)</Label><Input type="number" placeholder="8" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} /></div>
                <div><Label>Weight (kg)</Label><Input type="number" placeholder="65" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
                <div><Label>Age</Label><Input type="number" placeholder="25" value={age} onChange={(e) => setAge(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={(v: any) => setGender(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Chest (in)</Label><Input type="number" value={bodyChest} onChange={(e) => setBodyChest(e.target.value)} /></div>
                <div><Label>Shoulder (in)</Label><Input type="number" value={bodyShoulder} onChange={(e) => setBodyShoulder(e.target.value)} /></div>
                <div><Label>Waist (in)</Label><Input type="number" value={bodyWaist} onChange={(e) => setBodyWaist(e.target.value)} /></div>
              </div>

              <Separator />

              <div>
                <Label className="mb-2 flex items-center gap-2"><Camera className="h-4 w-4" /> Your photo (recommended)</Label>
                <input ref={userFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleUserPhoto(e.target.files?.[0] ?? null)} />
                {userPhotoUrl ? (
                  <div className="relative w-fit">
                    <img src={userPhotoUrl} alt="user" className="h-40 rounded-md border border-border object-cover" />
                    <button onClick={() => handleUserPhoto(null)} className="absolute right-1 top-1 rounded-full bg-background/90 p-1 shadow"><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <button onClick={() => userFileRef.current?.click()} className="flex h-28 w-full items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
                    <Upload className="mr-2 h-4 w-4" /> Upload photo
                  </button>
                )}
                <p className="mt-2 text-xs text-muted-foreground">Tip: Save as a Profile for better AI measurements.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Shirt className="h-4 w-4" /> Product details</CardTitle>
            <CardDescription>The more details, the more accurate the verdict.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><Label>Name</Label><Input placeholder="Cotton Shirt" value={productName} onChange={(e) => setProductName(e.target.value)} /></div>
              <div>
                <Label>Type</Label>
                <Select value={productType} onValueChange={setProductType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Shirt", "T-Shirt", "Pant", "Jeans", "Panjabi", "Polo", "Jacket", "Hoodie", "Saree", "Kurti"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Color</Label><Input placeholder="Navy blue" value={productColor} onChange={(e) => setProductColor(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><Label>Brand</Label><Input placeholder="Aarong, Yellow..." value={productBrand} onChange={(e) => setProductBrand(e.target.value)} /></div>
              <div><Label>Fabric</Label><Input placeholder="Cotton, denim..." value={productFabric} onChange={(e) => setProductFabric(e.target.value)} /></div>
              <div>
                <Label>Fit type</Label>
                <Select value={productFitLabel} onValueChange={setProductFitLabel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Slim", "Regular", "Relaxed", "Oversized"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label>Occasion</Label><Input placeholder="Office, casual, wedding" value={productOccasion} onChange={(e) => setProductOccasion(e.target.value)} /></div>
              <div>
                <Label>Labeled size</Label>
                <Select value={pSize} onValueChange={setPSize}>
                  <SelectTrigger><SelectValue placeholder="optional" /></SelectTrigger>
                  <SelectContent>
                    {["XS", "S", "M", "L", "XL", "XXL", "3XL"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Garment measurements (any you have)</p>
              <div>
                <input ref={chartFileRef} type="file" accept="image/*" className="hidden" onChange={handleChartUpload} />
                <Button variant="outline" size="sm" onClick={() => chartFileRef.current?.click()} disabled={parsingChart}>
                  {parsingChart ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Camera className="mr-2 h-3 w-3" />}
                  Auto-extract from size chart
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><Label>Chest (in)</Label><Input type="number" value={pChest} onChange={(e) => setPChest(e.target.value)} /></div>
              <div><Label>Shoulder (in)</Label><Input type="number" value={pShoulder} onChange={(e) => setPShoulder(e.target.value)} /></div>
              <div><Label>Length (in)</Label><Input type="number" value={pLength} onChange={(e) => setPLength(e.target.value)} /></div>
              <div><Label>Sleeve (in)</Label><Input type="number" value={pSleeve} onChange={(e) => setPSleeve(e.target.value)} /></div>
              <div><Label>Waist (in)</Label><Input type="number" value={pWaist} onChange={(e) => setPWaist(e.target.value)} /></div>
              <div><Label>Hip (in)</Label><Input type="number" value={pHip} onChange={(e) => setPHip(e.target.value)} /></div>
              <div><Label>Inseam (in)</Label><Input type="number" value={pInseam} onChange={(e) => setPInseam(e.target.value)} /></div>
            </div>

            <div>
              <Label className="mb-2 flex items-center gap-2"><Camera className="h-4 w-4" /> Product photos</Label>
              <p className="mb-2 text-[10px] text-muted-foreground">Upload front, back, fabric close-up, and care label tags for highest AI accuracy.</p>
              <input ref={productFileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleProductPhotos(e.target.files)} />
              
              <div className="flex flex-wrap gap-2">
                {productPhotoUrls.map((url, i) => (
                  <div key={i} className="relative w-fit">
                    <img src={url} alt={`product ${i}`} className="h-24 w-20 rounded-md border border-border object-cover" />
                    <button onClick={() => removeProductPhoto(i)} className="absolute right-1 top-1 rounded-full bg-background/90 p-1 shadow"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                {productPhotos.length < 4 && (
                  <button onClick={() => productFileRef.current?.click()} className="flex h-24 w-20 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
                    <Upload className="h-4 w-4" /> Add
                  </button>
                )}
              </div>
            </div>

            <div>
              <Label>Extra notes</Label>
              <Textarea placeholder="e.g. I prefer slim fit, will wear over a t-shirt..." value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {chartSuggestion.size && (
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Quick chart guess (BD)</span>
              <Badge variant="outline">{chartSuggestion.size}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{chartSuggestion.note}</p>
          </div>
        )}

        <Button onClick={onAnalyze} disabled={!apiKey} size="lg" className="w-full">
          <Sparkles className="mr-2 h-4 w-4" /> Run deep AI analysis
        </Button>
        {!apiKey && <p className="text-center text-xs text-muted-foreground">Add your free Gemini API key to start →</p>}
      </main>

      <footer className="border-t border-border py-6">
        <p className="text-center text-xs text-muted-foreground">
          Built for Bangladeshi shoppers • Photos & key never leave your browser
        </p>
      </footer>
    </div>
  );
}
