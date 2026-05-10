import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listProfiles, deleteProfile, blobUrl, type Profile } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Plus, Trash2, Camera } from "lucide-react";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/profiles/")({
  head: () => ({ meta: [{ title: "Profiles — FitCheck AI" }] }),
  component: ProfilesPage,
});

function ProfilesPage() {
  const [items, setItems] = useState<Profile[]>([]);
  const reload = () => listProfiles().then(setItems);
  useEffect(() => { reload(); }, []);

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-semibold">Profiles</h1>
            <p className="text-xs text-muted-foreground">Save body profiles for instant fit checks</p>
          </div>
          <Button asChild size="sm">
            <Link to="/profiles/new"><Plus className="mr-1 h-4 w-4" /> New</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
              <User className="h-10 w-10 opacity-30" />
              <p>No profiles yet. Create one with your photos so AI can measure your body — then reuse it for any product.</p>
              <Button asChild>
                <Link to="/profiles/new"><Plus className="mr-1 h-4 w-4" /> Create profile</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                <div className="flex gap-3 p-3">
                  <div className="h-24 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                    {p.photos[0] ? (
                      <img src={blobUrl(p.photos[0].blob)} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Camera className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{p.name}</p>
                      <Badge variant="outline" className="text-xs">{p.gender}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.height_ft}′{p.height_in}″ · {p.weight_kg ? `${p.weight_kg}kg` : "—"}
                      {p.measurement?.body_type ? ` · ${p.measurement.body_type}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.photos.length} photo{p.photos.length === 1 ? "" : "s"}
                      {p.measurement ? " · measured" : " · not measured"}
                    </p>
                    <div className="mt-auto flex gap-2 pt-2">
                      <Button asChild size="sm" variant="outline" className="flex-1">
                        <Link to="/profiles/$id" params={{ id: p.id }}>Open</Link>
                      </Button>
                      <Button asChild size="sm" className="flex-1">
                        <Link to="/" search={{ profile: p.id } as any}>Use</Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm(`Delete profile "${p.name}"?`)) return;
                          await deleteProfile(p.id);
                          toast.success("Deleted");
                          reload();
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
