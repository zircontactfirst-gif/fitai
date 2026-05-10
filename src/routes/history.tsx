import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { listHistory, deleteHistory, blobToObjectUrl, type HistoryItem } from "@/lib/history";
import { Trash2, GitCompare, Shirt } from "lucide-react";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — FitCheck AI" },
      { name: "description", content: "Browse all your saved outfit fit analyses." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const load = async () => {
    const list = await listHistory();
    setItems(list);
    const t: Record<string, string> = {};
    list.forEach((i) => {
      if (i.userPhoto) t[i.id] = blobToObjectUrl(i.userPhoto);
      else if (i.productPhoto) t[i.id] = blobToObjectUrl(i.productPhoto);
    });
    setThumbs(t);
  };

  useEffect(() => {
    load();
    return () => Object.values(thumbs).forEach(URL.revokeObjectURL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePick = (id: string) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));
  };

  const onDelete = async (id: string) => {
    await deleteHistory(id);
    toast.success("Deleted");
    setPicked((p) => p.filter((x) => x !== id));
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-semibold leading-none">History</h1>
            <p className="text-xs text-muted-foreground">{items.length} saved analyses</p>
          </div>
          {picked.length >= 2 && (
            <Button asChild size="sm">
              <Link to="/compare" search={{ ids: picked.join(",") }}>
                <GitCompare className="mr-1.5 h-4 w-4" /> Compare ({picked.length})
              </Link>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-3 px-4 py-4">
        {items.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              <Shirt className="mx-auto mb-3 h-10 w-10 opacity-30" />
              No saved analyses yet. Run an analysis and tap “Save”.
            </CardContent>
          </Card>
        )}
        {items.map((it) => {
          const score = it.result?.overall_score ?? 0;
          const scoreColor = score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-destructive";
          const isPicked = picked.includes(it.id);
          return (
            <Card key={it.id} className={isPicked ? "ring-2 ring-primary" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <Checkbox checked={isPicked} onCheckedChange={() => togglePick(it.id)} className="mt-1" />
                  {thumbs[it.id] ? (
                    <img src={thumbs[it.id]} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Shirt className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-sm">{it.title}</CardTitle>
                    <CardDescription className="text-xs">
                      {new Date(it.createdAt).toLocaleString()}
                    </CardDescription>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {it.product.type}
                      </Badge>
                      {it.result?.recommended_size && (
                        <Badge className="text-[10px]">Size {it.result.recommended_size}</Badge>
                      )}
                      <span className={`ml-auto text-sm font-bold ${scoreColor}`}>{score}/100</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {it.result?.summary_en && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{it.result.summary_en}</p>
                )}
                <div className="mt-2 flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => onDelete(it.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {items.length > 0 && picked.length < 2 && (
          <p className="pt-2 text-center text-xs text-muted-foreground">
            Tick 2–3 entries to compare side-by-side.
          </p>
        )}
      </main>
    </div>
  );
}
