// Shape of a niche landing page. One file per niche in src/niches/ (e.g. remodelers.ts); the route
// /<slug> is generated from it by src/pages/[niche].astro and rendered by src/layouts/NichePage.astro.
// To add Solar & Battery or Foundation Repair: copy remodelers.ts, change the slug and swap the copy.
//
// Unfinished items (any `todo`, the founder-video placeholder, an unapproved guarantee, proof placeholders)
// stay in the config but are NOT rendered unless the build sets PUBLIC_SHOW_DRAFTS=1.
export interface CaseCard { client: string; contact: string; built: string; result: string }  // real, approved data only

export interface Niche {
  slug: string;                                 // URL path, e.g. "remodelers"
  draft: boolean;                               // true => noindex, left out of sitemap.xml
  metaTitle: string;
  metaDescription: string;
  hero: { eyebrow: string; headline: string; sub: string; ctaLabel: string; ctaNote?: string; termsLink?: string };
  example: { title: string };                   // worked lost-revenue example (example inputs live in LeakCalc.astro)
  video: { title: string; embedUrl: string | null; placeholder: string; todo: string };  // renders only when embedUrl is set
  services: {
    eyebrow: string; title: string; lede: string;
    core: { title: string; name: string; badge: string; desc: string; points: string[]; demo: { title: string; steps: { label: string; detail: string }[] } };
    addonsTitle: string; addonsNote: string;
    addons: { outcome: string; name: string; desc: string; badge: string; price: string }[];  // badge must not claim "live" until confirmed
    own: string;                                // "you own it" line under the add-ons
    todo: string;
  };
  how: { eyebrow: string; title: string; steps: { title: string; desc: string }[] };
  portal: { eyebrow: string; title: string; lede: string; points: string[]; mockNote: string };
  guarantee: { eyebrow: string; title: string; wording: string; termsTitle: string; terms: string[]; approved: boolean; todo: string };  // the offer wording is Abdullah's; renders only when approved
  proof: { eyebrow: string; title: string; cases: CaseCard[]; emptyNote: string; placeholders: string[]; todo: string };
  finalCta: { title: string; sub: string; ctaLabel: string; capacity?: string; steps: string };
}
