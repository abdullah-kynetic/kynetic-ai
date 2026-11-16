---
version: alpha
name: Kynetic Portal
description: One calm, premium, owner-friendly design system for the Kynetic AI portal, admin and client sides. Light by default, color used only for meaning.
colors:
  primary: "#14100C"
  on-primary: "#FFFFFF"
  secondary: "#F2EEE8"
  on-secondary: "#14100C"
  brand: "#D9662A"
  brand-text: "#A8461A"
  on-brand: "#0E0D0B"
  background: "#FAF8F5"
  surface: "#FFFFFF"
  surface-sunken: "#F4F0EA"
  border: "#E8E2D8"
  border-strong: "#857D72"
  ink: "#14100C"
  ink-muted: "#5C5650"
  alert: "#C2255C"
  alert-soft: "#FCE8EF"
  gain: "#1E7A46"
  gain-soft: "#E4F3EA"
  attention: "#8A5A06"
  attention-soft: "#FDF0D8"
  neutral: "#5C5650"
  neutral-soft: "#F2EEE8"
  focus-ring: "#A8461A"
  dark-background: "#14110F"
  dark-surface: "#1D1916"
  dark-surface-sunken: "#241F1B"
  dark-border: "#322B25"
  dark-ink: "#F4F1EA"
  dark-ink-muted: "#B9B2A7"
  dark-alert: "#FF7AA2"
  dark-gain: "#6FD39A"
  dark-attention: "#F2B552"
typography:
  display:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.025em
  headline:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.015em
  title:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
  kpi:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -0.02em
    fontFeature: "'tnum' 1"
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  subtitle:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.3
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.3
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  section: 48px
components:
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 24px
  card-sunken:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 16px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 0 16px
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 0 16px
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: 32px
    padding: 0 12px
  chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: 32px
    padding: 0 12px
  segmented-toggle:
    backgroundColor: "{colors.neutral-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 4px
  status-pill-alert:
    backgroundColor: "{colors.alert-soft}"
    textColor: "{colors.alert}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 2px 10px
  status-pill-gain:
    backgroundColor: "{colors.gain-soft}"
    textColor: "{colors.gain}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 2px 10px
  status-pill-attention:
    backgroundColor: "{colors.attention-soft}"
    textColor: "{colors.attention}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 2px 10px
  status-pill-neutral:
    backgroundColor: "{colors.neutral-soft}"
    textColor: "{colors.neutral}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 2px 10px
  sidebar:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink}"
    width: 264px
    padding: 16px
  workspace-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 10px
  action-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 20px
---

# Kynetic Portal design system

## Overview

The portal should feel like a quiet, well-run office: calm, premium and easy for a busy business owner to read in ten seconds. It is light by default, spacious, and honest about what matters. Margin is the layout and hierarchy reference; Sunfoster is the reference for the workspace switcher and the dark theme. We borrow structure and feel only, never their names, data, copy or logos.

Every page does three things in order. It states the conclusion in plain English as a big title, it shows the three to five numbers that back it up, and it ends every insight with one clear button. Titles say what is true ("Why labor is leaking", "Where the profit went"), never what the page is called ("Reports"). A one-line muted subtitle under each title gives the scope or date.

This document is the normative design contract. Components use the tokens above through the shadcn variable names in `crm/src/styles/themes/kynetic.css`; a page never introduces a one-off color, radius or font size.

## Colors

Color carries meaning, never decoration. The page itself is warm off-white and cards are white, so almost everything is ink and gray.

- **Primary (#14100C):** near-black. Primary buttons, selected chips, selected segmented items and the sidebar's active row.
- **Secondary (#F2EEE8):** light warm gray. Secondary buttons and unselected toggles.
- **Brand (#D9662A):** Kynetic's existing burnt orange. It is the brand mark and the focus accent only. It is not an alert color and not a chart fill. Orange text uses `brand-text` (#A8461A) for contrast.
- **Alert (#C2255C):** pink-red for money lost, overdue and problems. This is the single alert accent.
- **Gain (#1E7A46):** green for gains and on target.
- **Attention (#8A5A06):** amber for needs attention soon.
- **Neutral (#5C5650):** gray for everything else, including deltas with no judgment.

Never mix meanings: a delta that is up but bad (for example cost up) uses alert, not gain. Meaning is never carried by color alone; pair it with an icon, sign or word. Text and soft-fill pairs meet 4.5:1.

## Typography

One neutral sans typeface, Inter, throughout the app, with tabular figures for numbers. The serif display face stays on the marketing site and the sign-in frame and is not used inside the portal. Scale: display 40, headline 24, title 18, KPI 36, body 14, subtitle 15, label 13, caption 12. Titles use tight tracking. Body text is never below 14px and captions never below 12px. Muted text uses `ink-muted` and never carries critical information.

## Layout

Generous spacing on a 4px base: 24px inside cards, 16 to 24px between cards, 48px between page sections. Page content is a single column up to a 1280px wrapper; dashboards use a 12-column grid that collapses to one column below 768px and must be usable at 390px wide. The page header is: breadcrumb, big title, one-line subtitle, and the page's one or two actions at the right.

Data patterns:

- **KPI strip:** three to five numbers, each with a label, a big number and a small delta chip.
- **Drill path:** a breadcrumb of pills ("All leakage > Labor overruns > Dallas") with a Reset action.
- **Dot and unit charts and heatmaps:** one mark equals a stated unit ("each dot is one install"). Gray by default; alert for the thing that matters.
- **Progress bars:** always labelled "x of y" with the bar as a supporting visual.
- **Status pills:** soft fill with colored text and a dot.
- **Where to act first:** action cards where every insight ends in exactly one button.
- **Sidebar:** Kynetic AI logo, workspace card, search with Cmd-K, grouped navigation with small section labels, then notifications, settings, help and the signed-in user card pinned to the bottom. Admin navigation is Today, Prospecting, Sales, Clients, Money, Settings.

## Elevation & Depth

Flat first. Cards separate from the page with a hairline border (`border`) or, at most, a very faint 0 1px 2px shadow at 6% ink. Popovers and the workspace switcher use one soft shadow (0 8px 24px at 12% ink) plus the hairline. No gradients, glows, glass or colored shadows anywhere.

## Shapes

Cards and popovers use 20px (`xl`) corners, nested panels 16px, buttons and inputs 12px, chips, toggles, pills and avatars are fully round. The workspace logo tile is a rounded square (`md`).

## Components

- **Buttons:** primary is near-black with white label, secondary is light gray, 40px high. One primary button per card or header. The focus ring is a 2px `focus-ring` outline with a 2px offset, always visible on keyboard focus.
- **Filter chips and segmented toggles:** pill shaped, selected state is near-black.
- **Workspace card:** square tile, bold business name, muted second line. Admin gets an up-and-down chevron and opens a searchable switcher; client users get a static card with no chevron.
- **Banner (view as client):** full-width strip at the top while impersonating, with an Exit button; it uses attention tokens, never alert.
- **Empty, loading and error states:** each list and chart has all three. Skeletons use `surface-sunken`. Errors say what happened and what to do next.

## Motion

Subtle and functional only. Interactions take 120 to 200ms and never more than 250ms, using ease-out. Allowed: switcher popover open and close, banner enter, hover and press states, skeleton loading, and number count-ups on the admin Today page only. Everything respects `prefers-reduced-motion`.

## Dark mode

Dark tokens (`dark-*`) are defined and modeled on Sunfoster's deep, low-contrast surfaces but in Kynetic's warm neutrals; they are not the default and not shipped as one. Alert, gain and attention shift to lighter tints so each still passes 4.5:1 on `dark-surface`.

## Do's and Don'ts

- Do lead each page with one plain-English conclusion and end each insight with one button.
- Do use color only for meaning, and back it with text or an icon.
- Do keep all numbers tabular and show units ("of 12", "per install").
- Do use real data only. Never invent calls, leads, reviews or revenue.
- Don't use gradients, glows, emoji icons, decorative animation or one-off colors.
- Don't use Margin's orange or Sunfoster's purple, or any of their names, copy or logos.
- Don't use red or pink for anything that is not a loss or a problem.
- Don't show other tenants, the switcher or any admin navigation to a client user.
