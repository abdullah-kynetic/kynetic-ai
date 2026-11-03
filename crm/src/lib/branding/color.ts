// Tenant primary color rules (DESIGN_SYSTEM "Per-client branding", F-39). Pure and dependency free so
// the browser form and the server run the same code.

export const LIGHT_BG = '#faf8f5';
export const DARK_BG = '#26211c';
const LIGHT_SURFACES = ['#ffffff', '#faf8f5', '#f2eee8'] as const;
const DARK_SURFACES = ['#26211c', '#1c1916'] as const;
const LABEL_DARK = '#0e0d0b';
const LABEL_LIGHT = '#ffffff';

export const MIN_FILL_CONTRAST = 3;
export const MIN_TEXT_CONTRAST = 4.5;

export type Rgb = readonly [number, number, number];

export function normalizeHex(input: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(input.trim());
  return m ? `#${m[1]!.toLowerCase()}` : null;
}

function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: Rgb): string {
  const c = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

const lin = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const unlin = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

type Lch = { l: number; c: number; h: number };

function hexToOklch(hex: string): Lch {
  const [r, g, b] = hexToRgb(hex).map(lin) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: (Math.atan2(B, A) * 180) / Math.PI };
}

function oklchToHex({ l, c, h }: Lch): string {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const b = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
  return rgbToHex([unlin(r), unlin(g), unlin(b)]);
}

const withL = (hex: string, l: number) => {
  const lch = hexToOklch(hex);
  return oklchToHex({ ...lch, l: Math.min(1, Math.max(0, l)) });
};

/** The better of the two label colors on this fill, and its contrast. */
export function onPrimary(hex: string): { color: string; ratio: number } {
  const dark = contrast(hex, LABEL_DARK);
  const light = contrast(hex, LABEL_LIGHT);
  return dark >= light ? { color: LABEL_DARK, ratio: dark } : { color: LABEL_LIGHT, ratio: light };
}

export type ColorCheck = {
  ok: boolean;
  /** Fill contrast on the light and dark page backgrounds, and the best label contrast. */
  ratios: { light: number; dark: number; label: number };
  /** Set when not ok: the nearest passing color. */
  suggestion?: string;
  /** Hue within about 20 degrees of the error red or success green: warn, never block. */
  warning?: string;
};

function passes(hex: string): boolean {
  return (
    contrast(hex, LIGHT_BG) >= MIN_FILL_CONTRAST &&
    contrast(hex, DARK_BG) >= MIN_FILL_CONTRAST &&
    onPrimary(hex).ratio >= MIN_TEXT_CONTRAST
  );
}

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return Math.min(d, 360 - d);
};

/**
 * Hard rule (DESIGN_SYSTEM rule 4): the fill needs 3:1 against both page backgrounds, because the
 * theme is a per-user toggle and one stored color serves both, and its label needs 4.5:1. A failing
 * color comes back with the nearest passing one (same hue and chroma, lightness moved the least).
 */
export function checkPrimaryColor(input: string): ColorCheck | null {
  const hex = normalizeHex(input);
  if (!hex) return null;
  const ratios = {
    light: contrast(hex, LIGHT_BG),
    dark: contrast(hex, DARK_BG),
    label: onPrimary(hex).ratio
  };
  const lch = hexToOklch(hex);
  let warning: string | undefined;
  if (lch.c > 0.08) {
    const nearRed = hueDistance(lch.h, hexToOklch('#b3261e').h) <= 20;
    const nearGreen = hueDistance(lch.h, hexToOklch('#1e7a46').h) <= 20;
    if (nearRed || nearGreen)
      warning = `This color is close to the ${nearRed ? 'error red' : 'success green'} used for status, so buttons may read as ${nearRed ? 'destructive' : 'confirmations'}.`;
  }
  if (passes(hex)) return { ok: true, ratios, warning };

  let best: string | undefined;
  for (let step = 1; step <= 100 && !best; step++) {
    for (const dir of [-1, 1]) {
      const candidate = withL(hex, lch.l + (dir * step) / 100);
      if (passes(candidate)) {
        best = candidate;
        break;
      }
    }
  }
  return { ok: false, ratios, suggestion: best, warning };
}

export type ThemeColors = {
  primary: string;
  onPrimary: string;
  hover: string;
  /** Links, money and other text in the brand color. */
  text: string;
};

function deriveText(hex: string, mode: 'light' | 'dark'): string {
  const surfaces = mode === 'light' ? LIGHT_SURFACES : DARK_SURFACES;
  const lch = hexToOklch(hex);
  const dir = mode === 'light' ? -1 : 1;
  for (let i = 0; i <= 100; i++) {
    const candidate = i === 0 ? hex : withL(hex, lch.l + (dir * i) / 100);
    if (surfaces.every((s) => contrast(candidate, s) >= MIN_TEXT_CONTRAST)) return candidate;
  }
  return mode === 'light' ? LABEL_DARK : LABEL_LIGHT;
}

/** Derived values for one stored color (rule 3). Both themes share the fill, label and hover. */
export function deriveBranding(input: string): { light: ThemeColors; dark: ThemeColors } {
  const primary = normalizeHex(input);
  if (!primary) throw new Error('Not a #rrggbb color');
  const label = onPrimary(primary);
  const lch = hexToOklch(primary);
  // Move lightness away from the label color; back off if the label would drop under 4.5:1.
  const sign = label.color === LABEL_DARK ? 1 : -1;
  let hover = primary;
  for (let shift = 0.06; shift > 0; shift -= 0.01) {
    const candidate = withL(primary, lch.l + sign * shift);
    if (contrast(candidate, label.color) >= MIN_TEXT_CONTRAST) {
      hover = candidate;
      break;
    }
  }
  const base = { primary, onPrimary: label.color, hover };
  return {
    light: { ...base, text: deriveText(primary, 'light') },
    dark: { ...base, text: deriveText(primary, 'dark') }
  };
}

export const KYNETIC_ORANGE = '#d9662a';

/** CSS that sets the shadcn tokens for a tenant. Values come from deriveBranding, never user text. */
export function brandingCss(input: string): string {
  const { light, dark } = deriveBranding(input);
  const vars = (t: ThemeColors) =>
    `--primary:${t.primary};--primary-foreground:${t.onPrimary};--primary-hover:${t.hover};` +
    `--primary-text:${t.text};--ring:${t.text};--sidebar-primary:${t.primary};` +
    `--sidebar-primary-foreground:${t.onPrimary};`;
  return `html[data-theme='kynetic']{${vars(light)}}html[data-theme='kynetic'].dark{${vars(dark)}}`;
}
