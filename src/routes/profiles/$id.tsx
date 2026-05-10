import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getProfile, saveProfile, blobUrl, newId, type Profile, type ProfilePhoto } from "@/lib/profile";
import { measureBody } from "@/lib/measure";
import { compressImage } from "@/lib/imageUtils";
import { useApiKey, ApiKeyDialog } from "@/components/ApiKeyManager";
import { PhotoGuide } from "@/components/PhotoGuide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Camera, Sparkles, Trash2, Upload, Loader2, Key, X, RefreshCw } from "lucide-react";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/profiles/$id")({
  head: () => ({ meta: [{ title: "Profile — FitCheck AI" }] }),
  component: ProfileDetail,
});

function ProfileDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate({ from: "/profiles/$id" });
  const { apiKey, save } = useApiKey();
  const [keyOpen, setKeyOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pose, setPose] = useState<ProfilePhoto["pose"]>("front");
  const [measuring, setMeasuring] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [progressPct, setProgressPct] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getProfile(id).then((p) => {
      if (!p) { toast.error("Profile not found"); nav({ to: "/profiles" }); return; }
      setProfile(p);
    });
  }, [id, nav]);

  if (!profile) return <div className="container mx-auto p-6 text-sm text-muted-foreground">Loading...</div>;

  const persist = async (next: Profile) => {
    setProfile({ ...next });
    await saveProfile(next);
  };

  const addPhoto = async (file: File) => {
    try {
      const { data, mime } = await compressImage(file);
      
      const byteCharacters = atob(data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      
      const photo: ProfilePhoto = { id: newId(), pose, blob, addedAt: Date.now() };
      const next = { ...profile, photos: [...profile.photos, photo] };
      await persist(next);
      toast.success(`Photo added (${pose})`);
    } catch (err: any) {
      toast.error("Failed to add photo: " + err.message);
    }
  };

  const removePhoto = async (pid: string) => {
    const next = { ...profile, photos: profile.photos.filter((p) => p.id !== pid) };
    await persist(next);
  };

  const onMeasure = async () => {
    if (!apiKey) { setKeyOpen(true); return; }
    if (!profile.photos.length) { toast.error("Add at least one photo"); return; }
    setMeasuring(true);
    setProgress("Preparing...");
    setProgressPct(10);
    abortRef.current = new AbortController();

    // Fake progress ticker so user sees it's working during long calls
    let pct = 10;
    const ticker = setInterval(() => {
      pct = Math.min(pct + 3, 90);
      setProgressPct(pct);
    }, 1500);

    try {
      const m = await measureBody(apiKey, profile, {
        signal: abortRef.current.signal,
        onProgress: setProgress,
      });
      const next: Profile = { ...profile, measurement: m, measurementUpdatedAt: Date.now() };
      await persist(next);
      setProgressPct(100);
      toast.success("Body measured by AI");
    } catch (e: any) {
      if (e?.name === "AbortError") toast.message("Cancelled");
      else toast.error(e?.message || "Measurement failed");
    } finally {
      clearInterval(ticker);
      setMeasuring(false);
      setTimeout(() => setProgressPct(0), 800);
    }
  };

  const cancel = () => abortRef.current?.abort();

  const m = profile.measurement;

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <ApiKeyDialog open={keyOpen} onOpenChange={setKeyOpen} apiKey={apiKey} onSave={save} />

      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon"><Link to="/profiles"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div>
              <h1 className="text-base font-semibold">{profile.name}</h1>
              <p className="text-xs text-muted-foreground">{profile.gender} · {profile.height_ft}′{profile.height_in}″</p>
            </div>
          </div>
          <Button variant={apiKey ? "outline" : "default"} size="sm" onClick={() => setKeyOpen(true)}>
            <Key className="mr-1 h-4 w-4" /> {apiKey ? "Key" : "Add Key"}
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl space-y-5 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Camera className="h-4 w-4" /> Body photos</CardTitle>
            <CardDescription>Add 1–4 photos. More poses = better measurement accuracy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PhotoGuide />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Pose for next upload</label>
                <Select value={pose} onValueChange={(v: any) => setPose(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="front">Front</SelectItem>
                    <SelectItem value="side">Side</SelectItem>
                    <SelectItem value="apose">A-pose</SelectItem>
                    <SelectItem value="back">Back</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) addPhoto(f);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
              <Button onClick={() => fileRef.current?.click()} className="sm:w-auto">
                <Upload className="mr-2 h-4 w-4" /> Add photo
              </Button>
            </div>

            {profile.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {profile.photos.map((p) => (
                  <div key={p.id} className="relative">
                    <img src={blobUrl(p.blob)} alt={p.pose} className="aspect-[3/4] w-full rounded-md border border-border object-cover" />
                    <Badge variant="secondary" className="absolute left-1 top-1 text-[10px]">{p.pose}</Badge>
                    <button
                      onClick={() => removePhoto(p.id)}
                      className="absolute right-1 top-1 rounded-full bg-background/90 p-1 shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-4 w-4" /> AI body measurement
            </CardTitle>
            <CardDescription>
              Gemini deeply analyzes your photos and returns body measurements as JSON.
              You can re-run after adding more photos to refine results.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {measuring ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{progress || "Working..."}</span>
                </div>
                <Progress value={progressPct} />
                <p className="text-xs text-muted-foreground">Deep analysis can take 30–90 seconds. We'll keep retrying on slow networks.</p>
                <Button variant="outline" size="sm" onClick={cancel}>Cancel</Button>
              </div>
            ) : (
              <Button onClick={onMeasure} disabled={!profile.photos.length} className="w-full">
                {m ? <RefreshCw className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {m ? "Re-measure with current photos" : "Measure my body with AI"}
              </Button>
            )}

            {m && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {m.body_type && <Badge variant="outline">Body: {m.body_type}</Badge>}
                  {m.posture && <Badge variant="outline">Posture: {m.posture}</Badge>}
                  {m.skin_tone && <Badge variant="outline">Skin: {m.skin_tone}</Badge>}
                  {m.confidence && <Badge>{m.confidence} confidence</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  {Object.entries(m)
                    .filter(([k, v]) => !["raw", "body_type", "posture", "skin_tone", "confidence", "build_notes"].includes(k) && v !== undefined && v !== null && v !== "")
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between rounded bg-muted/40 px-2 py-1.5">
                        <span className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}</span>
                        <span className="font-medium">{String(v)}</span>
                      </div>
                    ))}
                </div>
                {m.build_notes && (
                  <p className="rounded-md border border-border bg-secondary/40 p-3 text-sm">{m.build_notes}</p>
                )}
                <div className="flex gap-2">
                  <Button asChild className="flex-1">
                    <Link to="/" search={{ profile: profile.id } as any}>Use this profile to check a product</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fit DNA Passport</CardTitle>
            <CardDescription>Personal preferences for the AI to consider.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Favorite Fit</Label>
                <Input 
                  placeholder="e.g. Loose, Slim, Regular" 
                  value={profile.fitDNA?.favoriteFit || ""} 
                  onChange={e => persist({ ...profile, fitDNA: { ...profile.fitDNA, favoriteFit: e.target.value, comfortPreference: profile.fitDNA?.comfortPreference || "" } })} 
                />
              </div>
              <div>
                <Label>Comfort Preference</Label>
                <Input 
                  placeholder="e.g. Needs stretch, hates polyester" 
                  value={profile.fitDNA?.comfortPreference || ""} 
                  onChange={e => persist({ ...profile, fitDNA: { ...profile.fitDNA, comfortPreference: e.target.value, favoriteFit: profile.fitDNA?.favoriteFit || "" } })} 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
