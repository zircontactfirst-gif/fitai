import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getHistory, blobToObjectUrl, type HistoryItem } from "@/lib/history";
import { Shirt, ArrowLeft } from "lucide-react";

const search = z.object({ ids: z.string().optional() });

export const Route = createFileRoute("/compare")({
  validateSearch: zodValidator(search),
  head: () => ({
    meta: [
      { title: "Compare — FitCheck AI" },
      { name: "description", content: "Compare previous outfit fit recommendations side-by-side." },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const { ids } = Route.useSearch();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!ids) return;
    (async () => {
      const list = await Promise.all(ids.split(",").map((i: string) => getHistory(i)));
      const valid = list.filter(Boolean) as HistoryItem[];
      setItems(valid);
      const t: Record<string, string> = {};
      valid.forEach((i) => {
        if (i.productPhoto) t[i.id] = blobToObjectUrl(i.productPhoto);
        else if (i.userPhoto) t[i.id] = blobToObjectUrl(i.userPhoto);
      });
      setThumbs(t);
    })();
  }, [ids]);

  if (!ids || items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-xl px-4 py-10 text-center">
          <p className="mb-4 text-sm text-muted-foreground">Pick 2–3 items in History to compare.</p>
          <Button asChild>
            <Link to="/history">Go to History</Link>
          </Button>
        </main>
      </div>
    );
  }

  const rows: { label: string; get: (i: HistoryItem) => React.ReactNode }[] = [
    { label: "Recommended size", get: (i) => <strong>{i.result?.recommended_size ?? "—"}</strong> },
    { label: "Confidence", get: (i) => i.result?.size_confidence ?? "—" },
    { label: "Score", get: (i) => `${i.result?.overall_score ?? 0}/100` },
    { label: "Chart suggestion", get: (i) => i.chartSuggestion?.size ?? "—" },
    { label: "Product type", get: (i) => i.product.type },
    { label: "Labeled size", get: (i) => i.product.size || "—" },
    { label: "Color", get: (i) => i.product.color || "—" },
    { label: "Chest fit", get: (i) => i.result?.fit_prediction?.find((f: any) => f.area === "chest")?.verdict ?? "—" },
    { label: "Shoulder fit", get: (i) => i.result?.fit_prediction?.find((f: any) => f.area === "shoulder")?.verdict ?? "—" },
    { label: "Length fit", get: (i) => i.result?.fit_prediction?.find((f: any) => f.area === "length")?.verdict ?? "—" },
    { label: "Summary", get: (i) => <span className="text-xs">{i.result?.summary_en ?? "—"}</span> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/history"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-base font-semibold">Compare ({items.length})</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-4">
        {/* Card preview row — horizontal scroll on mobile */}
        <div className="-mx-3 mb-4 flex gap-3 overflow-x-auto px-3 pb-2 snap-x snap-mandatory">
          {items.map((it) => {
            const score = it.result?.overall_score ?? 0;
            const scoreColor = score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-destructive";
            return (
              <Card key={it.id} className="w-64 shrink-0 snap-start">
                <CardHeader className="pb-2">
                  <p className="truncate text-sm font-semibold">{it.title}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(it.createdAt).toLocaleDateString()}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {thumbs[it.id] ? (
                    <img src={thumbs[it.id]} alt="" className="h-32 w-full rounded-md object-cover" />
                  ) : (
                    <div className="flex h-32 items-center justify-center rounded-md bg-muted">
                      <Shirt className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{it.product.type}</Badge>
                    <span className={`text-2xl font-bold ${scoreColor}`}>{score}</span>
                  </div>
                  <Badge className="w-full justify-center">Size {it.result?.recommended_size ?? "—"}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Comparison table */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left text-xs font-semibold">Attribute</th>
                {items.map((i) => (
                  <th key={i.id} className="min-w-[140px] px-3 py-2 text-left text-xs font-semibold">{i.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-border">
                  <td className="sticky left-0 bg-background px-3 py-2 text-xs font-medium text-muted-foreground">{r.label}</td>
                  {items.map((i) => (
                    <td key={i.id} className="px-3 py-2 align-top">{r.get(i)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
