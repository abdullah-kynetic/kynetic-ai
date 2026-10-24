# Web assets

Generated from `../logo/mark.svg` and the lockups. Copy these files to the site's public root (paths below assume `/`).

| File | Use |
|---|---|
| `favicon.ico` | 16/32/48 px, legacy and default |
| `favicon.svg` | Modern browsers, orange mark on transparent |
| `apple-touch-icon.png` | 180 px, mark on `#1C1916` with ~14% padding |
| `icon-192.png`, `icon-512.png` | PWA icons, mark on `#1C1916` |
| `maskable-512.png` | PWA maskable icon, mark inside the 80% safe-zone circle |
| `og-image-light.png`, `og-image-espresso.png` | 1200x630 social share images |
| `site.webmanifest` | Name, colors and icon list |

## Paste into `<head>`

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1C1916">
<meta property="og:title" content="Kynetic AI">
<meta property="og:description" content="AI voice agents that answer, qualify and book">
<meta property="og:image" content="https://kyneticai.com/og-image-espresso.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://kyneticai.com/og-image-espresso.png">
```

Use an absolute URL for the OG image. Swap in `og-image-light.png` if a light card suits the page better. Check the domain above against the real site before pasting.
