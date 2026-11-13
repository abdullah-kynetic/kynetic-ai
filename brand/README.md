# Kynetic AI brand assets

Source of truth for the Kynetic AI logo system. Assets only — no site pages live here.

## Concept
A forward-leaning **K** whose lower half forms an **A** ("Kynetic AI" in one shape).

## Source (`source/`)
Original AI-generated raster artwork, kept for reference only (not for production use):
- `k-mark-a.png`, `k-mark-b.png` — two K mark variants (orange drifts between ~#E07A3F and ~#D9662A)
- `wordmark-dark-text.png` — wordmark, near-black text (for light backgrounds)
- `wordmark-light-text.png` — wordmark, off-white text (for dark backgrounds)

## Plan
All steps done. Final file tree:

```
brand/
  README.md
  preview.html                       contact sheet of every asset
  source/                            original raster artwork (reference only)
  logo/
    mark.svg  mark-ink.svg  mark-offwhite.svg
    wordmark-a/                      squared wordmark (K shared with the mark)
      wordmark-a-light.svg  wordmark-a-espresso.svg
    wordmark-b/                      refined luxury wordmark
      wordmark-b-light.svg  wordmark-b-dark.svg
      wordmark-b-sans-light.svg  wordmark-b-sans-dark.svg
    lockups/                         clear space baked into each viewBox
      lockup-b-horizontal-light.svg  lockup-b-horizontal-dark.svg
      lockup-b-stacked-light.svg     lockup-b-stacked-dark.svg
      lockup-a-horizontal-light.svg  lockup-a-horizontal-espresso.svg
      clearspace-diagram.svg  CLEARSPACE.md
  web/
    favicon.ico  favicon.svg  apple-touch-icon.png
    icon-192.png  icon-512.png  maskable-512.png
    og-image-light.png  og-image-espresso.png
    site.webmanifest  README.md      <head> snippet
```

Option A has no stacked lockup because its K is shared with the wordmark (see `logo/lockups/CLEARSPACE.md`).

## Palette
| Role | Hex |
|---|---|
| Orange (mark) | `#D9662A` |
| Near-black ink | `#14100c` |
| Off-white | `#f4f1ea` |
| Espresso | `#281F1C` |
| Champagne (espresso backgrounds only) | `#C9A96E` |
| Light page | `#faf8f5` |

Flat color only: no gradients, glows or shadows.

## Usage

### Choosing a file
- Light backgrounds: `-light` files (ink text). Dark backgrounds: `-dark` / `-espresso` files (off-white text).
- Prefer a lockup over a bare wordmark; lockups include the clear space (X = 25% of mark height, see `logo/lockups/CLEARSPACE.md`).
- Square or tiny spaces (avatars, favicons, app icons): the K mark alone.
- Web icons and the `<head>` snippet: `web/README.md`.

### Minimum sizes
| Asset | Digital | Print |
|---|---|---|
| K mark alone | 16 px | 8 mm |
| Wordmarks and lockups (width) | 120 px | 30 mm |

### Colors
- Mark: orange `#D9662A` on light or espresso, or single-color ink `#14100c` / off-white `#f4f1ea` (`mark-ink.svg`, `mark-offwhite.svg`) when one color is required.
- Text: ink on light, off-white on espresso.
- Champagne `#C9A96E` is for accents on espresso backgrounds only. It is never part of the logo.

### Do
- Use the supplied SVGs as they are and scale proportionally.
- Keep the clear space X free on all sides.
- Put the orange mark on flat `#faf8f5`, white or `#281F1C`.

### Don't
- Recolor the orange, or swap the text colors outside the supplied pairs.
- Stretch, squash, skew or rotate any logo file.
- Add effects: gradients, shadows, glows, outlines or bevels.
- Use champagne on light backgrounds, or recolor any logo in champagne.
- Place the orange mark on busy photos or on backgrounds close to orange. Use `mark-offwhite.svg` on a darkened image or a flat panel instead.
- Retype the name in a font, or rebuild a lockup by hand. Use the outlined files.
- Use the original PNGs in `source/` in production.
- Go below the minimum sizes.
