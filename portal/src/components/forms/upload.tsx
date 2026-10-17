"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function UploadBox({ clientId }: { clientId?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [category, setCategory] = useState("General");

  async function send(file: File) {
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("category", category);
    if (clientId) fd.set("clientId", clientId);
    try {
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(j.error ?? "Upload failed.");
      else { toast.success(`${file.name} uploaded.`); router.refresh(); }
    } catch { toast.error("Upload failed."); }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void send(f); }}
      className={cn("flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors", drag ? "border-brand bg-brand-tint" : "border-white/15")}
    >
      <UploadCloud className="size-6 text-muted" />
      <p className="text-sm text-muted">Drag a file here, or choose one. PDF, images, Office docs, up to 25&nbsp;MB.</p>
      <div className="flex w-full max-w-sm items-center gap-2">
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" aria-label="Category" maxLength={60} />
        <Button disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : "Choose file"}</Button>
      </div>
      <input ref={input} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); }} />
    </div>
  );
}
