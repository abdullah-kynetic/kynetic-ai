"use client";
import { toast } from "sonner";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shows freshly generated recovery codes. They are never shown again, so make saving them easy. */
export function RecoveryCodes({ codes, onDone, doneLabel = "I've saved them" }: { codes: string[]; onDone?: () => void; doneLabel?: string }) {
  const text = `Kynetic Portal recovery codes\nEach code works once. Keep them somewhere safe.\n\n${codes.join("\n")}\n`;
  return (
    <div className="grid gap-4 rounded-xl border border-warning/30 bg-warning/5 p-4">
      <div>
        <div className="font-medium">Save your recovery codes</div>
        <p className="mt-1 text-sm text-muted">If you lose your authenticator app, one of these codes signs you in. Each works once. They won&apos;t be shown again.</p>
      </div>
      <ul className="grid grid-cols-2 gap-2 font-mono text-sm">{codes.map((c) => <li key={c} className="rounded-md border border-border bg-background px-3 py-1.5 text-center">{c}</li>)}</ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={async () => { await navigator.clipboard.writeText(codes.join("\n")); toast.success("Copied."); }}><Copy />Copy</Button>
        <Button variant="secondary" size="sm" onClick={() => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
          a.download = "kynetic-portal-recovery-codes.txt";
          a.click();
          URL.revokeObjectURL(a.href);
        }}><Download />Download</Button>
        {onDone ? <Button size="sm" onClick={onDone}>{doneLabel}</Button> : null}
      </div>
    </div>
  );
}
