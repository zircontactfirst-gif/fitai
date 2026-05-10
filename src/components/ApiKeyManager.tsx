import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Key } from "lucide-react";

const KEY = "gemini_api_key";

export function useApiKey() {
  const [apiKey, setApiKey] = useState<string>("");
  useEffect(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    if (v) setApiKey(v);
  }, []);
  const save = (k: string) => {
    setApiKey(k);
    localStorage.setItem(KEY, k);
  };
  const clear = () => {
    setApiKey("");
    localStorage.removeItem(KEY);
  };
  return { apiKey, save, clear };
}

export function ApiKeyDialog({
  open,
  onOpenChange,
  apiKey,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  apiKey: string;
  onSave: (k: string) => void;
}) {
  const [val, setVal] = useState(apiKey);
  useEffect(() => setVal(apiKey), [apiKey, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Key className="h-4 w-4" /> Gemini API Key</DialogTitle>
          <DialogDescription>
            Get a free key from{" "}
            <a className="text-primary underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              Google AI Studio
            </a>
            . Stored only in your browser.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="key">API Key</Label>
          <Input id="key" type="password" placeholder="AIza..." value={val} onChange={(e) => setVal(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              onSave(val.trim());
              onOpenChange(false);
            }}
            disabled={!val.trim()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
