"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { confirmation, site } from "@/lib/content";
import { ease } from "./ui";

// "Get your free estimate" pop-up: one question per screen, answers saved in this browser for 30 days.
// Nothing is sent anywhere. Photos stay in memory (files cannot be saved in localStorage).
const KEY = "aa-estimate-v1";
const DAYS30 = 30 * 864e5;
const LETTERS = "ABCD";
const COUNT = 7;
const YES = "Yes";
type V = Record<string, string>;
type Saved = { step: string; v: V; photos?: number; ts: number };

const load = (): Saved | null => {
  try { const r = JSON.parse(localStorage.getItem(KEY) || "null") as Saved | null; return r && Date.now() - r.ts < DAYS30 ? r : null; } catch { return null; }
};
const save = (s: Omit<Saved, "ts">) => { try { localStorage.setItem(KEY, JSON.stringify({ ...s, ts: Date.now() })); } catch { /* storage blocked: still works */ } };
const wipe = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };

const input = "mt-2 h-[50px] w-full rounded-full border border-line bg-white px-5 text-[16px] outline-none placeholder:text-muted/70 focus:border-black";
const okBtn = "mt-6 h-[46px] rounded-full bg-sun px-8 text-[16px] font-medium";
const Q = ({ n, children, id }: { n: number; children: React.ReactNode; id?: string }) => (
  <h2 id={id} className="font-[family-name:var(--font-head)] text-[26px] font-medium leading-[1.15] tracking-[-0.04em] sm:text-[32px]"><b className="mr-3 font-[family-name:var(--font-mono)] text-[14px] font-normal text-muted">{String(n).padStart(2, "0")}</b>{children}</h2>
);

function Field({ k, label, v, set, ...rest }: { k: string; label: string; v: V; set: (k: string, val: string) => void } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="mt-5 block text-[15px] tracking-[-0.02em]">{label}<input name={k} value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={input} {...rest} /></label>;
}
function Opts({ items, step, v, choose }: { items: string[]; step: string; v: V; choose: (val: string) => void }) {
  const key = step === "5" ? "insured" : "contact";
  return (
    <fieldset className="mt-8 grid gap-3"><legend className="sr-only">Choose one</legend>
      {items.map((o, j) => (
        <label key={o} className={`flex cursor-pointer items-center gap-4 rounded-[16px] border px-4 py-3.5 text-[17px] ${v[key] === o ? "border-black bg-white" : "border-line bg-white/60 hover:border-black/50"}`}>
          <input type="radio" name={key} value={o} checked={v[key] === o} onChange={() => choose(o)} onClick={() => { if (v[key] === o && !(step === "5" && o === YES)) choose(o); }} data-focus={j === 0 || v[key] === o ? "" : undefined} className="sr-only" />
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-sun font-[family-name:var(--font-mono)] text-[13px]">{LETTERS[j]}</span>{o}
        </label>
      ))}
    </fieldset>
  );
}

export function EstimateDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("1");
  const [v, setV] = useState<V>({});
  const [err, setErr] = useState("");
  const [files, setFiles] = useState<{ url: string; name: string }[]>([]);
  const [lostPhotos, setLostPhotos] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const urls = useRef<string[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const reduce = useReducedMotion();
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  const show = useCallback((s: string) => { setErr(""); setStep(s); requestAnimationFrame(() => { const c = cardRef.current; c?.scrollTo(0, 0); (c?.querySelector<HTMLElement>("[data-focus]") ?? c)?.focus({ preventScroll: true }); }); }, []);
  const go = (to: string, nextV: V = v) => { clearTimeout(timer.current); save({ step: to, v: nextV, photos: files.length || undefined }); show(to); };

  const openDialog = useCallback((from?: HTMLElement | null) => {
    opener.current = from ?? (document.activeElement as HTMLElement | null);
    const s = load();
    if (s) { setV(s.v); setLostPhotos(s.photos ?? 0); setStep(s.step); } else { setV({}); setStep("1"); }
    setErr(""); setOpen(true);
  }, []);
  const close = useCallback(() => { setOpen(false); opener.current?.focus?.(); if (location.hash === "#estimate") history.replaceState(null, "", location.pathname + location.search); }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('a[href="#estimate"], [data-estimate-open]');
      if (!a || a.closest("[data-estimate-card]")) return;
      e.preventDefault(); openDialog(a);
    };
    const onHash = () => { if (location.hash === "#estimate") openDialog(); };
    document.addEventListener("click", onClick); window.addEventListener("hashchange", onHash); onHash();
    return () => { document.removeEventListener("click", onClick); window.removeEventListener("hashchange", onHash); };
  }, [openDialog]);

  useEffect(() => {
    if (!open) return;
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(() => (cardRef.current?.querySelector<HTMLElement>("[data-focus]") ?? cardRef.current)?.focus({ preventScroll: true }));
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { close(); return; }
    if (e.key === "Tab") {
      const f = [...(cardRef.current?.querySelectorAll<HTMLElement>("button, a[href], input:not([tabindex='-1']), textarea, select") ?? [])].filter((el) => !el.closest("[hidden]") && !(el as HTMLInputElement).disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      const inside = cardRef.current?.contains(document.activeElement);
      if (!inside) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return;
    }
    const t = e.target as HTMLElement;
    if (step === "5" || step === "6") {
      if (t.tagName === "INPUT" && (t as HTMLInputElement).type !== "radio") return;
      const opts = step === "5" ? ["Yes", "No", "Not sure"] : ["Call", "Text"];
      const i = LETTERS.indexOf(e.key.toUpperCase());
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && i >= 0 && opts[i]) choose(opts[i]);
    }
  };

  const keyRef = useRef(onKey);
  keyRef.current = onKey;
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => keyRef.current(e);
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => { const c = cardRef.current; if (c && !c.contains(document.activeElement)) (c.querySelector<HTMLElement>("[data-focus]") ?? c).focus({ preventScroll: true }); }, reduce ? 50 : 360);
    return () => clearTimeout(t);
  }, [open, step, reduce]);
  const choose = (val: string) => {
    const k = step === "5" ? "insured" : "contact";
    const nv = { ...v, [k]: val };
    setV(nv); setErr("");
    if (step === "5" && val === YES) { save({ step, v: nv }); return; }
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => go(String(Number(step) + 1), nv), 250);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = (k: string) => (v[k] ?? "").trim();
    if (step === "1") {
      if (v.trap) { go("done"); return; }
      if (!t("name")) return setErr("Please enter your name.");
      if ((t("phone").match(/\d/g) ?? []).length < 7) return setErr("Please enter a phone number.");
      if (t("email") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t("email"))) return setErr("Please enter a valid email address.");
    }
    if (step === "2" && t("vehicle").length < 2) return setErr("Please enter your year, make and model.");
    if (step === "3" && t("what").length < 2) return setErr("Please tell us a little about what happened.");
    if (step === "5" && !v.insured) return setErr("Please pick one.");
    if (step === "6" && !v.contact) return setErr("Please pick one.");
    if (step === "7") { go("done"); return; }
    go(String(Number(step) + 1));
  };
  const back = () => { clearTimeout(timer.current); go(String(Math.max(1, Number(step) - 1))); };
  const restart = () => { wipe(); urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current = []; setFiles([]); setLostPhotos(0); setV({}); show("1"); };

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/")).map((f) => ({ url: URL.createObjectURL(f), name: f.name }));
    urls.current.push(...next.map((n) => n.url)); setFiles((p) => [...p, ...next]); setLostPhotos(0); e.target.value = "";
  };

  const n = Number(step);
  const done = step === "done";
  const Err = () => <p role="alert" className="mt-4 min-h-[20px] text-[15px] text-[#b3261e]">{err}</p>;
  const Back = () => <button type="button" onClick={back} className="mt-5 block text-[15px] underline underline-offset-4">Back</button>;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100] grid place-items-center p-3 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.2 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={close} aria-hidden />
          <motion.div ref={cardRef} data-estimate-card role="dialog" aria-modal="true" aria-labelledby="est-title" tabIndex={-1}
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduce ? undefined : { opacity: 0, y: 16 }} transition={{ duration: 0.45, ease }}
            className="relative max-h-[calc(100dvh-24px)] w-full max-w-[580px] overflow-y-auto rounded-[28px] bg-page outline-none sm:max-h-[calc(100dvh-48px)]">
            <div className="sticky top-0 z-10 bg-page/95 backdrop-blur">
              <div className="flex items-center justify-between px-6 pt-5 sm:px-8">
                <span className="inline-flex items-center gap-2 rounded-full bg-dark px-4 py-1.5 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[.08em] text-white"><i className="h-2 w-2 rounded-full bg-sun" />{site.name}</span>
                <button type="button" onClick={close} className="rounded-full border border-line px-4 py-1.5 text-[14px] hover:border-black">Close ✕</button>
              </div>
              <div className="mx-6 mt-4 h-[3px] rounded-full bg-line sm:mx-8" aria-hidden><div className="h-full rounded-full bg-sun transition-[width] duration-500" style={{ width: done ? "100%" : `${Math.round(((n - 1) / COUNT) * 100)}%` }} /></div>
            </div>
            <div className="px-6 pb-8 pt-8 sm:px-8 sm:pb-10">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={step} initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease }}>
                  {done ? (
                    <div role="status">
                      <h2 id="est-title" className="font-[family-name:var(--font-head)] text-[32px] font-medium leading-[1.1] tracking-[-0.04em]">Thank you{v.name ? `, ${v.name.trim().split(" ")[0]}` : ""}.</h2>
                      <p className="mt-4 text-[18px] leading-[1.5]">{confirmation}</p>
                      <div className="mt-8 flex flex-wrap gap-3">
                        <a href={`tel:${site.tel}`} className="inline-flex h-[46px] items-center rounded-full bg-sun px-7 font-medium">Call {site.phone}</a>
                        <a href={`sms:${site.tel}`} className="inline-flex h-[46px] items-center rounded-full border border-line px-7 font-medium">Text us</a>
                      </div>
                      <button type="button" onClick={restart} className="mt-6 text-[15px] underline underline-offset-4">Start a new estimate</button>
                    </div>
                  ) : (
                    <form onSubmit={submit} noValidate>
                      {step === "1" && (<>
                        <Q n={1} id="est-title">Where can we reach you?</Q>
                        <Field v={v} set={set} k="name" label="Name" autoComplete="name" placeholder="Your full name" data-focus />
                        <Field v={v} set={set} k="phone" label="Phone number" type="tel" autoComplete="tel" placeholder="(214) 555-0100" />
                        <Field v={v} set={set} k="email" label="Email (optional)" type="email" autoComplete="email" placeholder="you@email.com" />
                        <input className="sr-only" name="trap" tabIndex={-1} autoComplete="off" aria-hidden value={v.trap ?? ""} onChange={(e) => set("trap", e.target.value)} />
                        <p className="mt-4 text-[13px] text-muted">We&rsquo;ll use these details to contact you about your free estimate.</p>
                      </>)}
                      {step === "2" && (<><Q n={2} id="est-title">What are we repairing?</Q><Field v={v} set={set} k="vehicle" label="Year / Make / Model" placeholder="e.g. 2018 Honda Accord" data-focus /></>)}
                      {step === "3" && (<><Q n={3} id="est-title">What happened?</Q>
                        <label className="mt-5 block text-[15px]">A short description is plenty<textarea name="what" rows={4} value={v.what ?? ""} onChange={(e) => set("what", e.target.value)} data-focus placeholder="e.g. Rear-ended at a light, bumper cracked" className="mt-2 w-full resize-none rounded-[20px] border border-line bg-white px-5 py-3 text-[16px] outline-none placeholder:text-muted/70 focus:border-black" /></label></>)}
                      {step === "4" && (<><Q n={4} id="est-title">Add photos of the damage</Q>
                        <p className="mt-2 text-[15px] text-muted">Optional. Photos help us give a better estimate.</p>
                        <label className="mt-6 flex h-[56px] cursor-pointer items-center justify-center rounded-full border border-dashed border-black/30 text-[15px] text-muted focus-within:border-black hover:border-black">+ Add photos
                          <input type="file" accept="image/*" multiple onChange={onFiles} data-focus className="sr-only" /></label>
                        {lostPhotos > 0 && files.length === 0 && <p className="mt-3 text-[14px] text-muted">Photos aren&rsquo;t saved if you leave the page. Please add them again.</p>}
                        {files.length > 0 && <ul className="mt-4 flex flex-wrap gap-2" aria-label="Selected photos">{files.map((f, i) => <li key={f.url}><img src={f.url} alt={`Damage photo ${i + 1}`} title={f.name} width={64} height={64} className="h-16 w-16 rounded-[12px] object-cover" /></li>)}</ul>}</>)}
                      {step === "5" && (<><Q n={5} id="est-title">Is this an insurance claim?</Q><Opts step={step} v={v} choose={choose} items={["Yes", "No", "Not sure"]} />
                        {v.insured === YES && (<div><Field v={v} set={set} k="insurer" label="Insurance company (optional)" placeholder="Company name" /><Field v={v} set={set} k="claim" label="Claim # (optional)" placeholder="Claim number" /></div>)}</>)}
                      {step === "6" && (<><Q n={6} id="est-title">How should we reach you?</Q><Opts step={step} v={v} choose={choose} items={["Call", "Text"]} /></>)}
                      {step === "7" && (<><Q n={7} id="est-title">When can you drop the car off?</Q><p className="mt-2 text-[15px] text-muted">Optional. A preferred date is fine.</p><Field v={v} set={set} k="date" label="Preferred drop-off date" type="date" data-focus /></>)}
                      <Err />
                      {(step === "1" || step === "2" || step === "3" || step === "4" || step === "7" || (step === "5" && v.insured === YES)) && (
                        <button type="submit" className={okBtn}>{step === "4" && files.length === 0 ? "Skip" : step === "7" && !v.date ? "Finish" : step === "7" ? "Get my free estimate" : "OK"}</button>)}
                      {n > 1 && <Back />}
                    </form>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
