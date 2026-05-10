import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveProfile, newId, type Profile } from "@/lib/profile";
import { PhotoGuide } from "@/components/PhotoGuide";
import { ArrowLeft, User } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/profiles/new")({
  head: () => ({ meta: [{ title: "New Profile — FitCheck AI" }] }),
  component: NewProfile,
});

function NewProfile() {
  const nav = useNavigate({ from: "/profiles/new" });
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [age, setAge] = useState("");
  const [ft, setFt] = useState("");
  const [inch, setInch] = useState("");
  const [wt, setWt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const onCreate = async () => {
    if (!name.trim()) return toast.error("Profile name required");
    setSaving(true);
    try {
      const id = newId();
      const p: Profile = {
        id,
        name: name.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        gender,
        age,
        height_ft: ft,
        height_in: inch,
        weight_kg: wt,
        notes,
        photos: [],
      };
      await saveProfile(p);
      toast.success("Profile created — now add photos");
      nav({ to: "/profiles/$id", params: { id } });
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center gap-2 px-4 py-3">
          <Button asChild variant="ghost" size="icon"><Link to="/profiles"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-base font-semibold">New Profile</h1>
            <p className="text-xs text-muted-foreground">Step 1 — Basic info</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl space-y-5 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><User className="h-4 w-4" /> Who is this profile for?</CardTitle>
            <CardDescription>You'll add photos in the next step. AI will read your body measurements from those photos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Profile name</Label>
              <Input placeholder="e.g. Rakib (me)" value={name} onChange={(e) => setName(e.target.value)} />
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
              <div>
                <Label>Age</Label>
                <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
              </div>
              <div>
                <Label>Height (ft)</Label>
                <Input type="number" value={ft} onChange={(e) => setFt(e.target.value)} />
              </div>
              <div>
                <Label>Height (in)</Label>
                <Input type="number" value={inch} onChange={(e) => setInch(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Weight (kg)</Label>
                <Input type="number" value={wt} onChange={(e) => setWt(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="e.g. broad shoulders, slim waist, prefers loose fit"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How to take photos</CardTitle>
            <CardDescription>You'll do this on the next screen. Read the rules first for best AI accuracy.</CardDescription>
          </CardHeader>
          <CardContent>
            <PhotoGuide />
          </CardContent>
        </Card>

        <Button onClick={onCreate} disabled={saving} size="lg" className="w-full">
          {saving ? "Creating..." : "Continue — Add photos"}
        </Button>
      </main>
    </div>
  );
}
