import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BD_MEN_TOP, BD_WOMEN_TOP, BD_BOTTOMS, inToCm, type SizeRange } from "@/lib/sizeChart";
import { Ruler } from "lucide-react";

export const Route = createFileRoute("/sizes")({
  head: () => ({
    meta: [
      { title: "Bangladesh Size Chart — FitCheck AI" },
      { name: "description", content: "Bangladesh garment size chart (XS–XXL) with cm and inch conversions for shirts, kurtis, and pants." },
    ],
  }),
  component: SizesPage,
});

function SizesPage() {
  const [unit, setUnit] = useState<"in" | "cm">("in");
  const fmt = (r: [number, number]) =>
    unit === "in" ? `${r[0]}–${r[1]}″` : `${inToCm(r[0])}–${inToCm(r[1])} cm`;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Ruler className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">BD Size Chart</h1>
              <p className="text-xs text-muted-foreground">XS–3XL · body measurements</p>
            </div>
          </div>
          <div className="flex rounded-md border border-border p-0.5 text-xs">
            <button onClick={() => setUnit("in")} className={`rounded px-2 py-1 ${unit === "in" ? "bg-primary text-primary-foreground" : ""}`}>inch</button>
            <button onClick={() => setUnit("cm")} className={`rounded px-2 py-1 ${unit === "cm" ? "bg-primary text-primary-foreground" : ""}`}>cm</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-4">
        <Tabs defaultValue="men">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="men">Men Top</TabsTrigger>
            <TabsTrigger value="women">Women Top</TabsTrigger>
            <TabsTrigger value="bottoms">Bottoms</TabsTrigger>
          </TabsList>

          <TabsContent value="men" className="pt-3">
            <ChartTable rows={BD_MEN_TOP} fmt={fmt} kind="top" />
          </TabsContent>
          <TabsContent value="women" className="pt-3">
            <ChartTable rows={BD_WOMEN_TOP} fmt={fmt} kind="top" />
          </TabsContent>
          <TabsContent value="bottoms" className="pt-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bottoms (Pant / Jeans)</CardTitle>
                <CardDescription>Body waist & inseam</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left">Size</th>
                      <th className="px-3 py-2 text-left">Waist</th>
                      <th className="px-3 py-2 text-left">Hip</th>
                      <th className="px-3 py-2 text-left">Inseam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BD_BOTTOMS.map((b) => (
                      <tr key={b.size} className="border-t border-border">
                        <td className="px-3 py-2 font-semibold"><Badge variant="outline">{b.size}</Badge></td>
                        <td className="px-3 py-2">{fmt(b.waist_in)}</td>
                        <td className="px-3 py-2">{fmt(b.hip_in)}</td>
                        <td className="px-3 py-2">{fmt(b.inseam_in)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">How to measure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs text-muted-foreground">
            <p><strong className="text-foreground">Chest:</strong> across the fullest part, under the arms, tape level.</p>
            <p><strong className="text-foreground">Shoulder:</strong> from one shoulder edge to the other, across the back.</p>
            <p><strong className="text-foreground">Waist:</strong> around the natural waist (above the belly button).</p>
            <p><strong className="text-foreground">Length:</strong> from base of neck down the back to the desired hem.</p>
            <p className="pt-2">📏 1 inch = 2.54 cm. BD market sizes can vary ±1″ per brand.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function ChartTable({ rows, fmt, kind }: { rows: SizeRange[]; fmt: (r: [number, number]) => string; kind: "top" }) {
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Size</th>
              <th className="px-3 py-2 text-left">Chest</th>
              <th className="px-3 py-2 text-left">Shoulder</th>
              <th className="px-3 py-2 text-left">Waist</th>
              <th className="px-3 py-2 text-left">Length</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.size} className="border-t border-border">
                <td className="px-3 py-2"><Badge variant="outline">{r.size}</Badge></td>
                <td className="px-3 py-2">{fmt(r.chest_in)}</td>
                <td className="px-3 py-2">{fmt(r.shoulder_in)}</td>
                <td className="px-3 py-2">{fmt(r.waist_in)}</td>
                <td className="px-3 py-2">{fmt(r.length_in)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
