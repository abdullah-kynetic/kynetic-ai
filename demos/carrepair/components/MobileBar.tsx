"use client";
import { site } from "@/lib/content";

// Phone-only bar that keeps call, text and the free estimate one tap away.
export function MobileBar() {
  const b = "flex h-[48px] items-center justify-center rounded-full text-[15px] font-medium";
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-page/95 px-3 pt-2 backdrop-blur md:hidden" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
      <div className="grid grid-cols-[1fr_1fr_1.6fr] gap-2">
        <a href={`tel:${site.tel}`} className={`${b} border border-black/20 bg-white`}>Call</a>
        <a href={`sms:${site.tel}`} className={`${b} border border-black/20 bg-white`}>Text</a>
        <a href="#estimate" className={`${b} bg-sun`}>Free estimate</a>
      </div>
    </div>
  );
}
