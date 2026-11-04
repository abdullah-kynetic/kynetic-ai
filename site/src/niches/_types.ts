// Shape of a niche landing page. One file per niche in src/niches/ (e.g. remodelers.ts); the route
// /<slug> is generated from it by src/pages/[niche].astro and rendered by src/layouts/NichePage.astro.
// To add Solar & Battery or Foundation Repair: copy remodelers.ts, change the slug and swap the copy.
export type Todo = { todo: string };            // renders a visible, dashed "TODO" marker on the page

export interface Niche {
  slug: string;                                 // URL path, e.g. "remodelers"
  draft: boolean;                               // true => noindex, left out of sitemap.xml
  metaTitle: string;
  metaDescription: string;
  hero: { eyebrow: string; headline: string; sub: string; ctaLabel: string; ctaNote?: string };
  video: { title: string; embedUrl: string | null; placeholder: string; todo: string };
  services: {
    eyebrow: string; title: string; lede: string;
    core: { name: string; badge: string; desc: string; points: string[] };
    addonsTitle: string; addonsNote: string;
    addons: { name: string; desc: string; badge: string }[];  // badge must not claim "live" until confirmed
    todo: string;
  };
  how: { eyebrow: string; title: string; steps: { title: string; desc: string }[] };
  portal: { eyebrow: string; title: string; lede: string; points: string[]; mockNote: string };
  guarantee: { eyebrow: string; title: string; draftWording: string; condition: string; todo: string };
  proof: { eyebrow: string; title: string; placeholders: string[]; todo: string };
  finalCta: { title: string; sub: string; ctaLabel: string };
}
