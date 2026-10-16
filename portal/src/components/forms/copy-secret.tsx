"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyField({ value }: { value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs">{shown ? value : value.replace(/.(?=.{6})/g, "•")}</code>
      <Button variant="secondary" size="sm" onClick={() => setShown((s) => !s)}>{shown ? "Hide" : "Show"}</Button>
      <Button variant="secondary" size="icon-sm" aria-label="Copy" onClick={async () => { await navigator.clipboard.writeText(value); toast.success("Copied."); }}><Copy /></Button>
    </div>
  );
}
