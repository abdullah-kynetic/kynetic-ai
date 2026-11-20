"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { en, es, type Copy, type Lang } from "./copy";
import { site } from "./content";

const KEY = "aa-lang";
type Ctx = { lang: Lang; setLang: (l: Lang) => void; c: Copy & { site: typeof site } };
const L = createContext<Ctx | null>(null);

// English is the default. The saved choice is read after mount so the static HTML always matches the first render.
export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, set] = useState<Lang>("en");
  useEffect(() => { try { if (localStorage.getItem(KEY) === "es") set("es"); } catch { /* storage blocked: stays English */ } }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    const u = (lang === "es" ? es : en).ui;
    document.title = u.pageTitle;
    document.querySelector('meta[name="description"]')?.setAttribute("content", u.pageDesc);
  }, [lang]);
  const setLang = useCallback((l: Lang) => { set(l); try { localStorage.setItem(KEY, l); } catch { /* ignore */ } }, []);
  const value = useMemo(() => ({ lang, setLang, c: { ...(lang === "es" ? es : en), site } }), [lang, setLang]);
  return <L.Provider value={value}>{children}</L.Provider>;
}
export const useLang = () => { const x = useContext(L); if (!x) throw new Error("LangProvider missing"); return x; };
export const useCopy = () => useLang().c;
