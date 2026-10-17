---
name: demo-profile-generator
description: >
  Kynetic AI — Skill 1 (Demo Mode): Demo Profile Generator.
  Cold-start version of the Brand Profile Generator. Runs from a single raw-data.json file
  pulled from a Google Maps URL — no intake form, no client contact required.

  Produces an identical brand-profile.md to the full Skill 1 output. All fields that would
  normally come from an intake form are inferred from scraped GBP data, review analysis,
  and intelligent defaults. The output is indistinguishable downstream — site builder,
  voice agent config, and n8n automations read it exactly the same way.

  Input: path to clients/[business-slug]/raw-data.json
  Output: clients/[business-slug]/brand-profile.md
---

# Demo Profile Generator — Skill 1 Cold Start

## Purpose

This skill generates a complete Brand Profile for a prospect before any client contact has
been made. It reads the `raw-data.json` file produced by `tools/gbp_scrape.py` and infers
every field a full onboarding would collect — without asking anything.

The output is a complete `brand-profile.md` that every downstream skill can consume without
modification. The only difference from a full onboarding profile is the Demo Mode Notice
section at the bottom, which flags what to confirm after first contact.

**Do not confuse this with the Brand Profile Generator (full onboarding skill).** That skill
requires a completed intake form and is run after signing. This skill runs before outreach.

---

## Trigger Condition

When the user provides a path to a `raw-data.json` file — or pastes the JSON directly — this
skill activates. Example invocations:
- `/demo-profile-generator clients/right-choice-restoration-remediation/raw-data.json`
- `/demo-profile-generator` followed by pasted JSON content

---

## Execution Instructions

### Step 1 — Read the raw-data.json

Load and parse the JSON. Key fields consumed:
- `business_name`, `business_slug`, `address`, `phone`, `website_url`
- `star_rating`, `review_count`, `categories`, `gbp_description`
- `photo_count`, `place_id`, `review_link_url`, `maps_url`
- `reviews[]` — `text`, `rating`, `reviewer_name`
- `extracted_colors[]` — up to 2 hex values from their website
- `scrape_status` — used to note data quality in the profile

---

### Step 2 — Classify the Niche

Read `categories[]` from the JSON. Match to one of the 8 Kynetic AI niches:

| If GBP category contains... | Niche | Urgency | Direction |
|---|---|---|---|
| "Water damage" / "Flood" / "Remediation" | Water Damage | Emergency | Dark Authority |
| "Roofing" / "Roof" | Roofing | Hybrid | Dark Authority |
| "Foundation" | Foundation Repair | Hybrid | Dark Authority |
| "Tree" / "Arborist" / "Stump" | Tree Service | Emergency | Dark Authority |
| "Pool" / "Swimming" / "Spa" | Pool Builders | Consideration | Dark Aspiration |
| "Well" / "Septic" / "Sewer" / "Drilling" | Well Drilling & Septic | Hybrid | Dark Authority |
| "Land clearing" / "Grading" / "Excavat" | Land Clearing | Hybrid | Dark Authority |
| "Painting" / "Paint" (commercial context) | Commercial Painting | Consideration | Dark Aspiration |

If no category matches cleanly, classify as the closest niche and note the uncertainty.

**Primary emotion by niche:**
- Water Damage → Panic + helplessness (caller is in crisis)
- Roofing → Dread + financial anxiety (storm damage or proactive)
- Foundation Repair → Fear + home safety
- Tree Service → Urgency + powerlessness (emergency) or Aesthetic desire (non-emergency)
- Pool Builders → Aspiration + excitement
- Well/Septic → Disgust + urgency
- Land Clearing → Progress anxiety
- Commercial Painting → Professional pressure + deadline stress

---

### Step 3 — Derive the Design System from One Base Color

Every token in the design system is derived from a single base color. There are no fixed
niche palettes. Every business gets a unique theme.

#### Step 3A — Determine the Base Color

1. If `extracted_colors` is non-empty → use `extracted_colors[0]` as the base color
2. If `extracted_colors` is empty → generate a base color:
   - Choose a hue appropriate to the niche mood (see hue guidance below)
   - Randomize within that hue range: saturation 65–85%, lightness 48–62%
   - Express as HSL then convert to hex for all token output

**Hue guidance for random generation (only used when no extracted colors):**
- Water Damage → blues 200–240° or warm amber 25–40°
- Roofing → reds 0–15° or steel blue 200–220°
- Foundation Repair → greens 140–165° or earthy amber 35–50°
- Tree Service → greens 120–150°
- Pool Builders → cyans/sky blues 185–210° (can use brighter saturation)
- Well/Septic → lime greens 75–100° or earth greens 130–145°
- Land Clearing → ambers 35–50° or earth greens 130–145°
- Commercial Painting → violets 265–285° or any high-saturation creative hue

#### Step 3B — Derive All 19 Tokens from Base Color

Given a base color B (expressed as HSL: hue H, saturation S, lightness L):

```
color_primary    = hsl(H, S%, L%)              — the base color itself
color_accent     = hsl(H, min(S+10,95)%, min(L+15,72)%)   — brighter variant
color_accent_hover = hsl(H, min(S+10,95)%, min(L+25,80)%) — lightest variant

bg_base          = hsl(H, max(S-45,10)%, max(L-38,6)%)    — very dark, near-black
bg_surface       = hsl(H, max(S-45,10)%, max(L-34,10)%)   — +4% lightness from base
bg_elevated      = hsl(H, max(S-45,10)%, max(L-30,14)%)   — +8% lightness from base

bg_glass         = rgba(255, 255, 255, 0.06)   — fixed
blur_radius      = 16px                         — fixed

gradient_orb_1   = hsl(H, S%, L%)              — same as color_primary (at full opacity in CSS)
gradient_orb_2   = hsl((H+30)%360, S%, L%)     — +30° hue shift, same sat/light

color_text_primary = #F8FAFC                   — near white, always fixed
color_text_body    = #CBD5E1                   — slate 300, always fixed
color_text_muted   = #64748B                   — slate 500, always fixed

color_border     = rgba(R, G, B, 0.20)         — R,G,B from color_primary
color_glow       = rgba(R, G, B, 0.15)         — R,G,B from color_primary

radius_card      = 16px                        — fixed
radius_button    = 10px                        — fixed

font_display     — chosen by you (see font guidance below)
font_body        — chosen by you (see font guidance below)
```

**Convert HSL → hex** when writing the final token values. Do the math explicitly — do not
approximate. Output the exact hex for every token.

#### Step 3C — WCAG Contrast Check

After deriving tokens, verify:
- `color_text_body` (#CBD5E1) on `bg_base` — must achieve 4.5:1 minimum
- `color_primary` on `bg_base` — must achieve 3:1 minimum (large text / buttons)
- `color_text_primary` (#F8FAFC) on `bg_base` — will almost always pass 7:1 ✓

If `color_primary` on `bg_base` fails 3:1:
- Increase lightness of `color_primary` by 5% and recheck
- Repeat until passing — note the final adjusted value
- `color_accent` and `color_accent_hover` follow proportionally

Because `bg_base` is always near-black (L ~6–14%) and text colors are fixed near-white,
text contrast will always pass. The only check that can fail is `color_primary` on `bg_base`.

#### Step 3D — Font Selection

Choose a display + body font pair that fits the brand's niche mood and color character.
Base the choice on what the base color "feels like" combined with the niche personality.

**Available pairs (Google Fonts only):**
- Sora + DM Sans — technical, modern, clean (good for any emergency niche)
- Barlow Condensed + Inter — industrial, fast, legible (roofing, land clearing, tree)
- Outfit + Plus Jakarta Sans — structural, confident (foundation, well/septic)
- Clash Display + Satoshi — premium, editorial (pool, commercial painting, any bright base)
- Montserrat + Source Sans 3 — authoritative, professional (hybrid niches)
- Space Grotesk + DM Sans — geometric, contemporary (any niche with a bright/unusual base)

Never use: Inter, Roboto, Arial, or any system font as the display font.
Never use the same font for display and body.

---

### Step 4 — Derive the Theme Identity

Name the theme: a 2-word codename that captures the feeling of this specific business —
not its industry. It should sound like a film title or product line.

Build the full theme spec:

```
THEME NAME:      [2-word codename — evocative, not descriptive]
DIRECTION:       [Dark Authority / Dark Aspiration]
MOOD:            [exactly 3 words]
AESTHETIC:       [1 sentence painting a specific visual world]
ANTI-AESTHETIC:  [1 sentence — what this brand must never look like]
MOTION LANGUAGE: [subtle / moderate / expressive]
```

**Motion language by niche:**
- Emergency niches (Water Damage, Tree Service emergency) → subtle
- Hybrid niches (Roofing, Foundation, Well/Septic, Land Clearing, Tree non-emergency) → moderate
- Consideration niches (Pool Builders, Commercial Painting) → expressive

**Design thinking questions — answer before finalizing:**
1. PURPOSE: What problem does this site solve in the first 3 seconds a visitor lands?
2. TONE: What is the one feeling the visitor should have when they scroll past the hero?
3. DIFFERENTIATION: What is the single most memorable visual moment on this site?
4. ANTI-AI-SLOP CHECK: Does any element look like a generic contractor template?

---

### Step 5 — Derive Brand Voice and Positioning

**From review analysis:**
Read all reviews in `reviews[]`. Identify:
- The 2–3 themes that recur across multiple reviews (e.g., "fast response," "explained everything," "professional crew")
- The emotional language reviewers use (words like "amazing," "saved us," "wouldn't trust anyone else")
- Any specific details mentioned (technician names, same-day service, pricing transparency)

**Differentiator one-liner:**
Synthesize the most consistent review theme into a single punchy sentence under 15 words.
Must be specific and provable — not generic.
- Bad: "Fast, professional water damage restoration you can trust."
- Good: "Irving's only water damage crew that guarantees mold clearance before they leave."

If reviews are sparse (< 3), derive from GBP categories + niche knowledge. Flag it.

**Brand voice adjectives:** 3 words that describe how this business should sound.
Derive from the combination of niche psychology + review language + base color vibe.
Never use: "professional," "reliable," "experienced" alone — these are table stakes.

**Social proof anchors:** Select the 3 most emotionally resonant, specific review excerpts.
Rewrite them in brand voice — distilled, not copied verbatim. Each should be usable as a
pull-quote, hero subheadline, or social graphic caption.

---

### Step 6 — Derive Geographic Data

**City:** Extract from `address` field (the city portion).
**State:** Extract from `address` field.
**Cities served:** Start with the city from the address. Scan review text for any other
cities mentioned. List all found. If only one city found, list that plus 2–3 adjacent DFW
cities that are plausible for the niche (based on address location).

**Primary keyword:** `{primary_service} {city}` (e.g., "water damage restoration Irving")
**Secondary keywords:**
- `{niche} near me`
- `{primary_service} {city} TX`
- `{niche} {adjacent_city}`
- `emergency {primary_service} {city}` (for Emergency niches only)

---

### Step 7 — Derive Services

**Primary service:** First item in `categories[]`, cleaned to plain English.
(e.g., "Water damage restoration service" → "Water Damage Restoration")

**Secondary services:** Remaining categories, cleaned. If only one category found, infer
2–3 common secondary services for the niche:
- Water Damage: Mold remediation, Structural drying, Emergency extraction
- Roofing: Storm damage repair, Gutter installation, Roof inspection
- Foundation Repair: Pier installation, Drainage solutions, Crawl space encapsulation
- Tree Service: Stump grinding, Tree trimming, Emergency tree removal
- Pool Builders: Pool renovation, Water features, Outdoor living design
- Well/Septic: Septic pumping, Well pump repair, Drain field repair
- Land Clearing: Brush clearing, Lot grading, Demolition debris removal
- Commercial Painting: Interior painting, Exterior painting, Epoxy flooring

---

### Step 8 — Build the Hook Architecture

Apply the Hook Model to this specific business:

```
HOOK ARCHITECTURE:
Primary internal trigger: [niche-specific emotion from mapping table in Step 2]
Hero resolution statement: [the implied message the hero must communicate — not a headline]
Primary action: [call / form] — completable in: [X seconds]
Primary CTA copy direction: [e.g., "Call Now — We Answer 24/7" / "Get Your Free Estimate"]
Secondary CTA: [e.g., "See Our Work" / "Learn About Our Process"]
Variable reward moment: [what the caller/submitter gets immediately — be specific]
Investment loader: [what the first follow-up SMS says]
```

**Primary action logic:**
- Emergency niches → call. One tap. No form.
- Consideration niches → form. 3 fields max (name, phone, service interest).
- Hybrid → call primary, form secondary.

---

### Step 9 — Build the Social Media Spec

**Active vs dormant platforms (by niche):**
| Platform | Water Damage | Roofing | Foundation | Tree | Pool | Well/Septic | Land Clearing | Commercial Painting |
|---|---|---|---|---|---|---|---|---|
| Google Business Profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Facebook | ✅ | ✅ | ✅ | ✅ | ✅ | ⚪ | ⚪ | ✅ |
| Instagram | ⚪ | ✅ | ⚪ | ✅ | ✅ | ⚪ | ⚪ | ✅ |
| Nextdoor | ✅ | ✅ | ✅ | ✅ | ⚪ | ✅ | ⚪ | ⚪ |

**Content pillar split:**
- Emergency niches: 50% Job Spotlight / 25% Education / 15% Social Proof / 10% Seasonal
- Consideration niches: 40% Job Spotlight / 20% Education / 20% Social Proof / 20% Seasonal
- Hybrid niches: 45% Job Spotlight / 22% Education / 18% Social Proof / 15% Seasonal

**Hashtag clusters:** 5–8 hashtags. Mix niche + city + DFW. Never generic (#contractor, #smallbusiness).
Examples: #WaterDamageIrving #DFWRestoration #IrvingTexas #FloodCleanupDFW

**Grid aesthetic:** One sentence describing the visual identity of every social graphic.
**Post visual anchor:** The one recurring visual element on every graphic (e.g., "orange stat overlay on job photo").

---

### Step 10 — Assign Tech Stack

```
TECH STACK:
Stack: [A or B]
Rationale: [1 sentence]
Motion language: [subtle / moderate / expressive]
Font loading: [Google Fonts import URLs for both fonts]
Sections: Standard 11-section architecture
Interactive elements: [list any — or "none"]
Hosting: kydemo-[business-slug]-[city-slug].netlify.app
Form webhook: configure-on-deploy
```

**Stack decision:**
- Stack A (Vanilla HTML/CSS/JS): Emergency niches, subtle motion, no interactive elements
- Stack B (React 18 + TypeScript + Vite + Tailwind CSS 3): Aspiration niches OR expressive/moderate motion OR any interactive element needed

---

### Step 11 — Write the Brand Profile Document

Save to: `clients/{business_slug}/brand-profile.md`

Use this exact structure:

---

````
```json
{
  "business_name": "",
  "owner_first_name": "[Owner]",
  "owner_last_name": "[pending-setup]",
  "niche": "",
  "primary_phone": "",
  "physical_address": "",
  "primary_service": "",
  "secondary_services": [],
  "cities_served": [],
  "years_in_business": "Established",
  "gbp_url": "",
  "existing_website": "",
  "star_rating": 0,
  "review_count": 0,
  "tone_preference": "Professional",
  "primary_keyword": "",
  "secondary_keywords": [],
  "certifications": [],
  "differentiator_oneliner": "",
  "brand_voice_adjectives": [],
  "social_proof_anchors": [],
  "urgency_classification": "",
  "primary_emotion": "",
  "map_pack_visible": false,

  "design_direction": "",
  "design_tokens": {
    "bg_base": "",
    "bg_surface": "",
    "bg_elevated": "",
    "bg_glass": "rgba(255,255,255,0.06)",
    "blur_radius": "16px",
    "gradient_orb_1": "",
    "gradient_orb_2": "",
    "color_primary": "",
    "color_accent": "",
    "color_accent_hover": "",
    "color_text_primary": "#F8FAFC",
    "color_text_body": "#CBD5E1",
    "color_text_muted": "#64748B",
    "color_border": "",
    "color_glow": "",
    "radius_card": "16px",
    "radius_button": "10px",
    "font_display": "",
    "font_body": ""
  },

  "theme": {
    "name": "",
    "direction": "",
    "mood": [],
    "aesthetic_statement": "",
    "anti_aesthetic": "",
    "motion_language": ""
  },

  "hook_architecture": {
    "internal_trigger_emotion": "",
    "hero_resolution_statement": "",
    "primary_action": "",
    "primary_cta_copy_direction": "",
    "secondary_cta": "",
    "variable_reward_moment": "",
    "investment_loader": ""
  },

  "social_media": {
    "active_platforms": [],
    "dormant_platforms": [],
    "grid_aesthetic": "",
    "content_pillar_split": {
      "job_spotlight": "",
      "education": "",
      "social_proof": "",
      "seasonal_local": ""
    },
    "hashtag_clusters": [],
    "post_visual_anchor": ""
  },

  "tech_stack": {
    "stack": "",
    "motion_language": "",
    "font_display_url": "",
    "font_body_url": "",
    "sections": "standard-11",
    "interactive_elements": [],
    "hosting_subdomain": "",
    "form_webhook": "configure-on-deploy"
  },

  "voice_agent": {
    "agent_name": "pending-setup",
    "after_hours_mode": "pending-setup",
    "booking_method": "pending-setup",
    "transfer_name": "pending-setup"
  },

  "sequences": {
    "owner_signature": "pending-setup",
    "sms_from_number": "pending-setup",
    "seasonal_hooks": []
  },

  "gbp": {
    "place_id": "",
    "review_link_url": "",
    "categories": [],
    "current_description_exists": false,
    "photo_count": 0,
    "seasonal_content_hooks": []
  },

  "client": {
    "email": "pending-setup",
    "notion_page_url": "pending-setup",
    "retainer_start_date": "pending-setup"
  }
}
```

# [Business Name] — Brand Profile (Demo Mode)

**Generated:** [date]
**Mode:** Demo — inferred from public GBP data
**Niche:** [niche]
**Primary Market:** DFW → [city]

---

## Business Identity

| Field | Value |
|---|---|
| Business Name | |
| Owner | [Owner] — confirm after contact |
| Niche | |
| Primary Service | |
| Secondary Services | |
| Cities Served | |
| Years in Business | Established — confirm after contact |
| Phone | |
| GBP URL | |
| Existing Website | |

---

## Brand Voice

**Voice Adjectives:** [adj 1] · [adj 2] · [adj 3]

**Voice in Action:**
[2 sentences describing how this brand sounds and what it never sounds like — derived from review language and niche]

**Tone Preference:** Professional (default — confirm after contact)

---

## Core Positioning

**Differentiator One-Liner:**
> [synthesized from review themes — confirm accuracy with owner after contact]

**Brand Positioning Statement:**
[3 sentences: who they are, who they serve, what they deliver — written in brand voice]

**Primary Emotion:** [emotion] — [1-sentence explanation tied to niche psychology]

**Urgency Classification:** [Emergency / Consideration / Hybrid]

---

## Services

**Primary:** [primary service]

**Secondary:**
- [service]
- [service]
- [service]

---

## Local Identity

**Service Area:** [cities derived from address + review text]

**Local Anchors:** [any specific neighborhood or DFW-area references found in reviews or address]

---

## Social Proof

**Star Rating:** [X.X stars] | **Review Count:** [X reviews]

**Top Review Themes:**
- [theme 1 — from review analysis]
- [theme 2]
- [theme 3 if applicable]

**Social Proof Anchors (rewritten in brand voice):**
1. [anchor — specific, credible, usable as pull-quote]
2. [anchor]
3. [anchor]

**Map Pack Visibility:** Not verified (demo mode — check manually before outreach)

---

## Keywords

**Primary Keyword:** [primary keyword]

**Secondary Keywords:**
- [keyword]
- [keyword]
- [keyword]
- [keyword]

---

## Design System

**Design Direction:** [Dark Authority / Dark Aspiration]

**Base Color:** [hex] — [source: extracted from website / generated for niche]

### Background Layers
| Token | Value | Purpose |
|---|---|---|
| --bg-base | | Page root — derived from base color |
| --bg-surface | | Cards, sections |
| --bg-elevated | | Modals, dropdowns |
| --bg-glass | rgba(255,255,255,0.06) | Glass card surface |
| --blur-radius | 16px | CSS backdrop-filter |
| --gradient-orb-1 | | Base color |
| --gradient-orb-2 | | +30° hue shift |

### Colors
| Token | Value | Contrast on bg-base | WCAG |
|---|---|---|---|
| --color-primary | | [X.X:1] | ≥ 3:1 ✓/✗ |
| --color-accent | | [X.X:1] | ≥ 3:1 ✓/✗ |
| --color-accent-hover | | — | — |
| --color-text-primary | #F8FAFC | [X.X:1] | AAA ✓ |
| --color-text-body | #CBD5E1 | [X.X:1] | AA ✓ |
| --color-text-muted | #64748B | [X.X:1] | ≥ 3:1 ✓ |
| --color-border | | — | — |
| --color-glow | | — | — |

### Shape & Typography
| Token | Value |
|---|---|
| --radius-card | 16px |
| --radius-button | 10px |
| --font-display | [Font name] — [Google Fonts URL] |
| --font-body | [Font name] — [Google Fonts URL] |

### Theme Identity

```
THEME NAME:      [2-word codename]
DIRECTION:       [Dark Authority / Dark Aspiration]
MOOD:            [word] · [word] · [word]
AESTHETIC:       [1 sentence]
ANTI-AESTHETIC:  [1 sentence]
MOTION LANGUAGE: [subtle / moderate / expressive]
```

**Design Thinking:**
1. PURPOSE: [answer]
2. TONE: [answer]
3. DIFFERENTIATION: [answer]
4. ANTI-AI-SLOP CHECK: [answer]

---

## Hook Architecture

```
Primary internal trigger: [emotion]
Hero resolution statement: [implied message]
Primary action: [call / form] — completable in: [X seconds]
Primary CTA copy direction: [copy direction]
Secondary CTA: [secondary CTA]
Variable reward moment: [specific — not generic]
Investment loader: [first SMS content direction]
```

---

## Social Media

```
Active platforms: [list]
Dormant platforms: [list]
Grid aesthetic: [1 sentence]
Brand voice per channel:
  - GBP: [adj] + [adj]
  - Facebook: [adj] + [adj]
  - Instagram: [adj] + [adj] (if active)
  - Nextdoor: [adj] + [adj] (if active)
Content pillar split: [job%] / [education%] / [social proof%] / [seasonal%]
Hashtag clusters: [list — 5-8 tags]
Post visual anchor: [the one recurring element]
```

---

## Tech Stack

```
Stack: [A — Vanilla / B — React+Vite+Tailwind]
Rationale: [1 sentence]
Motion language: [subtle / moderate / expressive]
Font loading:
  Display: [Google Fonts import URL]
  Body: [Google Fonts import URL]
Sections: Standard 11-section architecture
Interactive elements: [list or "none"]
Hosting: kydemo-[business-slug]-[city-slug].netlify.app
Form webhook: configure-on-deploy
```

---

## Notes for Downstream Skills

- **Skill 2 (Website):** Read Design System before writing any code. Set all CSS custom
  properties from design tokens. Build gradient orbs as absolute-positioned radial-gradient
  divs — glass cards are invisible without them. Apply `backdrop-filter: blur(16px)` to glass
  surfaces only. Lead hero with the differentiator one-liner. Urgency determines CTA language.
- **Skill 3 (Voice Agent):** All voice agent fields are pending-setup — collect from owner
  on first call. Urgency classification determines routing branches.
- **Skill 4 (Sequences):** Primary emotion and urgency drive message pacing. Social proof
  anchors feed Day 3 and Day 7 messages.
- **Skill 5 (GBP Content):** Use primary + secondary keywords throughout. Local identity
  markers (specific neighborhoods) go into every post.

---

## Demo Mode Notice

This profile was generated from publicly available Google Business Profile data.
No client contact has occurred. The following fields require confirmation after first contact:

**Confirm with owner:**
- [ ] Owner first name (currently "[Owner]")
- [ ] Years in business (currently "Established")
- [ ] Differentiator one-liner (inferred from reviews — verify accuracy)
- [ ] Certifications, licenses, warranties (not available from GBP)
- [ ] Brand color preference (colors derived from website — may not reflect intended brand)
- [ ] Service area accuracy (cities inferred from address and reviews)

**Requires provisioning before downstream skills run:**
- [ ] Voice agent name and configuration
- [ ] Twilio SMS number
- [ ] Notion client page URL
- [ ] Owner email for report delivery
- [ ] Retainer start date

**Data quality notes:**
- GBP scrape: [reflect scrape_status.gbp_actor from raw-data.json]
- Website colors: [reflect scrape_status.color_source — "extracted from website" or "generated for niche"]
- Phone source: [reflect scrape_status.phone_source]
- Reviews captured: [count from reviews array]
````

---

## Quality Checks Before Saving

**Core Brand**
- [ ] Differentiator one-liner is specific — not "fast, professional [service]"
- [ ] Brand voice adjectives are not generic (no "professional, reliable, experienced" as trio)
- [ ] Social proof anchors are rewritten in brand voice — not copy-pasted
- [ ] Cities listed specifically — not just "DFW area"

**Design Token System**
- [ ] All 19 tokens populated — no empty strings
- [ ] `bg_base` is near-black (L ≤ 14%)
- [ ] `color_primary` achieves ≥ 3:1 on `bg_base`
- [ ] `color_text_body` (#CBD5E1) achieves ≥ 4.5:1 on `bg_base`
- [ ] Both hex values shown in full (#RRGGBB format)
- [ ] `color_border` and `color_glow` use rgba() with base color RGB values
- [ ] Fonts are named Google Fonts — not system fonts, not Inter as display

**Theme**
- [ ] Theme name is 2-word codename — not descriptive
- [ ] Mood is exactly 3 words
- [ ] Motion language matches niche urgency class

**Hook Architecture**
- [ ] Internal trigger matches niche psychology table
- [ ] Primary action is call or form — not ambiguous
- [ ] Variable reward moment is specific — not "we'll respond soon"

**Social Media**
- [ ] Platform active/dormant correctly assigned per niche matrix
- [ ] Content pillar percentages add to 100%
- [ ] Hashtags are niche + city specific

**Tech Stack**
- [ ] Stack A or B selected with rationale
- [ ] Font import URLs are complete and valid Google Fonts URLs
- [ ] Hosting subdomain uses kydemo- prefix

---

## File Handling

Save to: `clients/[business-slug]/brand-profile.md`

The slug comes from `business_slug` in `raw-data.json`.
