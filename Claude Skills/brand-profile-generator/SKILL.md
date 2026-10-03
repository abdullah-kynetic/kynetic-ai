---
name: brand-profile-generator
description: >
  Kynetic AI — Skill 1: Brand Profile Generator.
  The foundational skill. Runs once per client at onboarding. Takes intake form answers
  and GBP scrape data and produces the Brand Profile — the single source of truth that
  every downstream skill, every Claude Code session, and every n8n workflow reads before
  executing. Nothing in the Kynetic AI system gets built without it.

  Covers five complete layers: (1) brand identity and voice, (2) full design token system
  with WCAG-verified contrast ratios and futuristic dark-first UI spec, (3) named theme
  identity with motion language, (4) UX hook architecture mapped to niche psychology,
  (5) social media brand system, tech stack spec, and all delivery configuration.

  Output: a single .md file — JSON frontmatter (60+ fields across 10 logical groups)
  consumed by n8n and automation; Markdown body consumed by Claude Code, Skills 2–10,
  and human review.

  References: frontend-design, theme-factory, hooked-ux, web-artifacts-builder skills.
---

# Skill 1 — Brand Profile Generator

## Purpose

This skill produces the **Brand Profile** — the single source of truth for every
client. Every downstream skill (S2 through S10), every Claude Code website build session,
and every n8n automation reads this file before executing. Get this right and everything
downstream runs cleanly. Get it wrong and every downstream output is wrong.

The Brand Profile is not a reformatted intake form. It is a derived, sharpened, complete
operational document that a contractor could not produce for themselves. It takes raw
answers and scrape data and extracts brand signal, design direction, psychological hooks,
and delivery configuration — all in a single file.

---

## Inputs Required

Two data sources must be provided before running this skill:

### Source A — Intake Form Answers

Collected during the onboarding call or sent as a form link immediately post-signing.
Every field is required. Do not run Skill 1 with blanks — partial data produces weak
output across every downstream skill.

Fields are grouped into 5 sections. The grouping reflects how they're collected
(some during the call, some sent afterward) and which downstream skill consumes them.

---

#### Section 1 — Business Identity
*(Collected verbally on the onboarding call)*

```
Business name:
Owner first name:
Owner last name (for formal communications):
Primary phone number (the number the voice agent will answer):
Niche: [Water Damage / Roofing / Foundation Repair / Tree Service / Pool Builders /
        Well Drilling & Septic / Land Clearing / Commercial Painting]
Years in business:
Physical address (full — used in footer, GBP, and local SEO):
Google Business Profile URL:
Existing website URL (if any — enter "none" if not applicable):
```

---

#### Section 2 — Services & Market Position
*(Collected verbally on the onboarding call)*

```
Primary service (the one that drives the most revenue):
Secondary services (list each — these populate the services grid):
Cities and areas served (list every city, neighborhood, county — be specific):
Certifications, licenses, warranties worth mentioning:
Differentiator: (exact answer to "What makes you different from every other
  [niche] company in DFW? Think specific — what can you guarantee or prove?"):
```

---

#### Section 3 — Brand & Voice
*(Can be collected on call or via follow-up form)*

```
Preferred communication tone: [Casual / Professional / In Between]
Existing logo: [Yes — file attached / No]
Existing brand colors: [Yes — hex codes or color names listed below / No]
  If yes, list: 
Owner photo available: [Yes — file attached / No]
Job photos uploaded: [Yes — count: ___ / No]
```

---

#### Section 4 — Voice Agent Configuration
*(Collected on onboarding call — operational decisions, not brand decisions)*

```
What should the AI agent call itself?
  (e.g. "Sarah", "Alex" — not the business name, a friendly first name):
After-hours handling preference:
  [Callback request — collect name + number and promise a call back]
  [SMS only — send automated SMS, no voicemail]
  [Voicemail — let caller leave a message]
How should the agent handle bookings?
  [Book directly — agent schedules into calendar link]
  [Callback — agent collects info and owner calls back to confirm]
  [Emergency dispatch — agent notifies owner immediately for same-day jobs]
If a caller insists on speaking to a person, who does the agent transfer to?
  (Enter the first name the agent should use — e.g. "Let me get Marcus for you"):
```

---

#### Section 5 — Administrative & Delivery
*(Collected at contract signing — not brand fields, but required for report delivery)*

```
Owner email address (where monthly reports are sent):
Retainer start date (MM/DD/YYYY):
Twilio phone number assigned to this client (enter after provisioning):
Notion client page URL (enter after creating their Notion page):
```

---

**Note on Section 5:** The Twilio number and Notion page URL will not exist at
intake — they're created during onboarding setup. Leave blank at intake and fill
in before running Skills 7, 8, and 10 for the first time.

### Source B — GBP Scrape Data

Pulled via Apify before running this skill. See `/references/gbp-scrape-guide.md`
for exact actor configuration and field extraction instructions.

Run both actors against the GBP URL from Section 1 of the intake form. Total cost
per client: ~$0.01. Do not run Skill 1 without this data — it sets the baseline
metrics that every downstream skill and monthly report measures against.

```
GBP SCRAPE DATA:

── Core business data (cheapget/google-business-profile) ──
Business name as listed on GBP:
Place ID (the CID from the Google Maps URL — format: ChIJ...):
Google review link URL (direct link to leave a review):
Current star rating:
Total review count:
Current GBP categories (list all active):
Current GBP business description (full text — or "none" if empty):
Current photo count:
Phone number on GBP (note if different from intake form):
Address as listed on GBP:

── Review data (automation-lab/google-maps-reviews-scraper) ──
Review 1 — most recent (full text):
Review 1 — star rating:
Review 1 — reviewer first name:
Review 2 (full text):
Review 2 — star rating:
Review 2 — reviewer first name:
Review 3 (full text):
Review 3 — star rating:
Review 3 — reviewer first name:

── Manual check (60 seconds, incognito browser) ──
Map pack visibility: [Showing / Not showing] for "[primary service] [primary city]"
Search term used for map pack check:
```

**Data mismatch protocol:** If the GBP phone number or address differs from the
intake form, flag the discrepancy in the Brand Profile and note which is correct.
Do not silently use one over the other — the client needs to align them.

---

## Execution Instructions

When this skill is triggered, do the following in order:

### Step 1 — Validate Inputs
Check that both Source A and Source B are present. If GBP scrape data is missing,
flag it and ask the user to provide it or confirm manual entry before proceeding.
Do not generate the Brand Profile with missing data — partial inputs produce weak outputs.

### Step 2 — Derive, Don't Just Copy
The Brand Profile is not a reformatted version of the intake form. You are extracting
signal, sharpening it, and producing language the client could not have written for
themselves. Apply these derivation rules:

**Brand voice descriptor:** Read the owner's differentiator answer and tone preference.
Derive 3 adjectives that describe how this business should sound (e.g., "direct, reassuring,
local" or "professional, expert-forward, approachable"). Then write 2 sentences that describe
the voice in action — what it sounds like, what it never sounds like.

**Core differentiator one-liner:** Take the owner's raw answer and sharpen it into a single
punchy sentence under 15 words. Remove filler. Make it specific and provable.
Bad: "We care about our customers and do great work."
Good: "30-year DFW foundation company — the only one that guarantees no surprise invoices."

**Primary emotion:** Derive what emotional state the customer is in when they first call.
Match to niche:
- Water Damage → Relief + Urgency (they're in crisis)
- Roofing → Protection + Practicality (storm damage or proactive)
- Foundation Repair → Anxiety + Trust (home safety fear)
- Tree Service → Urgency or Aspiration (emergency removal or yard improvement)
- Pool Builders → Aspiration + Excitement (lifestyle purchase)
- Well Drilling / Septic → Urgency + Relief (emergency or necessity)
- Land Clearing → Practicality + Progress (project milestone)
- Commercial Painting → Professional Standards + Deadlines

**Niche urgency classification:**
- Emergency: Water Damage, Tree Service (emergency branch), Well/Septic failure
- Consideration: Pool Builders, Land Clearing, Commercial Painting
- Hybrid: Roofing, Foundation Repair, Tree Service (non-emergency)

**Social proof anchors:** Read the 3 scraped reviews. Extract 2–3 specific phrases or
themes that appear (e.g., "fast response," "professional crew," "explained everything").
Rewrite them in brand voice — not copied verbatim, but distilled.

**Keywords:** Primary keyword = "[niche service] [primary city]" (e.g., "water damage
restoration Dallas"). Secondary keywords (4): add surrounding DFW cities + service variants.

**Design Token System — Full Brand System (not just colors):**

Every client brand profile must output a complete design token system, not just 3 hex
codes. This token system is what Claude Code reads to build the website. Every token
has a purpose — nothing is decorative noise. The design direction — dark, light, or
mid-tone — is determined by the niche, the primary emotion, and the client's positioning.
No direction is the default. The right direction is the one that makes a prospect feel
they've found the most capable option in their market.

**Step A — Determine the Design Direction**
Read the niche urgency classification and primary emotion, then assign one of two directions:

DIRECTION 1 — "Dark Premium" (Emergency niches by default: Water Damage, Plumbing, Electrician)
The caller is in crisis. Dark backgrounds project calm authority — the feeling of handing
your problem to someone who has done this a thousand times. Near-black base, serif italic
headlines, single deep accent color, gold rule dividers.
When to use: high-urgency niches, owner has a serious/authoritative brand voice, existing
brand colors are dark or neutral.

DIRECTION 2 — "Light Editorial" (Consideration niches by default: Pool Builders, Commercial Painting)
The caller is making a lifestyle or investment decision. Light cream or warm white
backgrounds project aspiration and craftsmanship — the feeling of a premium magazine or
architect's portfolio. Warm off-white base, serif italic headlines, deep rich accent,
gold rule dividers. Same typography system, inverted palette.
When to use: aspiration niches, client has a warm/approachable tone, existing brand
colors are warm or light.

DIRECTION 3 — "Warm Mid-Tone" (Craft niches by default: Roofing, Fence, Tree Service, Concrete, Land Clearing)
The caller is practical and discerning. Warm mid-tone backgrounds — think weathered oak,
aged concrete, fieldstone — project craftsmanship without going fully dark or fully light.
Neither corporate nor cold. Deep warm neutrals as the base, serif italic headlines,
one committed accent color.
When to use: outdoor/craft niches, owner has a plain-spoken no-nonsense voice, brand
colors are earthy or warm.

DIRECTION SELECTION LOGIC — read all four signals before assigning:
1. Niche urgency: Emergency → lean Dark Premium. Aspiration → lean Light Editorial.
   Craft/outdoor → lean Warm Mid-Tone.
2. Primary emotion: Panic/fear → Dark Premium (calm authority). Aspiration/desire →
   Light Editorial (premium possibility). Practicality/progress → Warm Mid-Tone.
3. Brand voice adjectives: "authoritative, precise, commanding" → Dark Premium.
   "warm, approachable, crafted" → Warm Mid-Tone. "refined, aspirational, elevated" →
   Light Editorial.
4. Client's existing colors: If they have existing brand colors, derive the direction
   from the dominant hue family. Dark navies/blacks → Dark Premium. Creams/warm whites →
   Light Editorial. Browns/greens/ambers → Warm Mid-Tone.
Override rule: if the client's differentiator is strongly premium/aspirational even in
an emergency niche, Light Editorial is valid. Always note the reasoning in the profile.

**Step B — Assign the Full Token Set**

Output ALL of the following tokens. Never leave a token blank. If client provided brand
colors, map them into the system. If not, use the niche defaults below.

TOKEN DEFINITIONS:
--bg-base           Page root. The primary background. Dark, light, or mid-tone depending
                    on direction. This is NOT always near-black.
--bg-surface        Card/section backgrounds. One layer above base. Same direction as base.
--bg-raised         Elevated cards, featured elements. Two steps from base.
--color-text-primary  All headlines. Must achieve 7:1+ contrast on --bg-base.
--color-text-body   Body copy. Must achieve 4.5:1+ contrast on --bg-base.
--color-text-muted  Labels, eyebrows, metadata. Must achieve 3:1+ contrast on --bg-base.
--color-text-on-accent  Text on accent buttons. Must achieve 4.5:1+ on --color-accent.
--color-border      Card/section borders. Subtle — 8–12% opacity of text color. Never solid.
--color-border-subtle  Lighter border variant for dividers within sections.
--color-accent      The CTA and action color. One committed color per site. Buttons only.
--color-accent-hover  Hover state. 10–15% shift toward lighter or more saturated.
--color-accent-glow   Box-shadow glow. Accent at 15% opacity.
--color-accent-dim    Featured card borders. Accent at 20% opacity.
--color-secondary   Supporting color. Used for badges, stat callouts, icon accents, section
                    highlights. Never competes with --color-accent. Must contrast 3:1+ on bg-base.
--color-secondary-dim  Secondary at 15% opacity. Background tints on supporting elements.
--color-tertiary    Tertiary color. Used for decorative micro-elements, hover fills on nav
                    links, subtle background patterns. The quietest color in the system.
--color-tertiary-dim   Tertiary at 15% opacity. Barely-there tint on alternating sections.
--color-gold        The premium divider signal. Warm gold. Thin 1px lines ONLY — never fills.
--color-gold-dim    Gold at 30% opacity. Subtle card top-borders.
--color-gold-faint  Gold at 15% opacity. Barely-there section dividers.
--radius-card       Border radius for cards. 12px default, 16px for aspirational niches.
--radius-button     Border radius for buttons. 6px default, 8px for aspirational niches.
--font-display      Playfair Display — serif italic for headlines. The premium signal.
--font-body         DM Sans — clean, pairs with serif display without competing.

WCAG CONTRAST REQUIREMENTS — NON-NEGOTIABLE:
Normal body text (--color-text-body on --bg-base): minimum 4.5:1 (WCAG AA)
Headline text (--color-text-primary on --bg-base): minimum 7:1 (WCAG AAA target)
Large button text (--color-accent on --bg-base): minimum 3:1 (large text exemption)
UI components like input borders: minimum 3:1 against adjacent background
Light theme text: always measure dark text on --bg-base, not on white — off-white
backgrounds still require contrast verification against the actual base value
NEVER place body-size text on pure accent color without verifying contrast ratio first

PREMIUM RESTRAINT RULES:
Gold rule is a 1px line — works on both dark and light backgrounds. Used as:
  - 32px-wide short line below eyebrow labels (before section headlines)
  - Full-width section dividers with a 48px gold left-accent via ::after
  - 1px top-border on featured/primary cards
Never use gold as a button fill, background color, or large decorative shape.
No glass morphism, no gradient orbs, no backdrop-filter on any direction.
The three-color hierarchy: accent (CTAs/buttons) → secondary (badges/stats) → tertiary
(micro-details). Each color plays one role. Never two colors fighting for the same role.
On light themes: ensure accent color has sufficient contrast on the light base
(minimum 3:1 for large button text, 4.5:1 for body-size text on accent).

NICHE DEFAULT TOKEN SETS:

Each niche has a recommended direction and a complete default palette.
The direction is a starting point — override it using the Direction Selection Logic
above if the client's signals point elsewhere. When you override, note why.

Shared across ALL directions:
--color-gold:       warm gold
--color-gold-dim:   gold at 30% opacity
--color-gold-faint: gold at 15% opacity
--radius-card:      12px (default) / 16px (aspirational niches)
--radius-button:    6px (default) / 8px (aspirational niches)
--font-display:     'Playfair Display'
--font-display-url: https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400;1,700;1,900&display=swap
--font-body:        'DM Sans'
--font-body-url:    https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap

─────────────────────────────────────────
WATER DAMAGE — Default: Dark Premium
─────────────────────────────────────────
Rationale: Caller is in crisis. Dark authority communicates calm competence.
--bg-base:              deep near-black (e.g. very dark navy-black)
--bg-surface:           one step lighter than base
--bg-raised:            two steps lighter than base
--color-text-primary:   warm off-white — 18:1+ on bg-base
--color-text-body:      muted warm — 5.5:1+ on bg-base
--color-text-muted:     subdued — 3.2:1+ on bg-base
--color-text-on-accent: white
--color-border:         white at 8% opacity
--color-border-subtle:  white at 4% opacity
--color-accent:         deep royal blue
--color-accent-hover:   15% lighter
--color-accent-glow:    accent at 15% opacity
--color-accent-dim:     accent at 20% opacity
--color-secondary:      muted steel or slate — supporting trust signal
--color-secondary-dim:  secondary at 15% opacity
--color-tertiary:       cool silver-gray — quiet decorative micro-element color
--color-tertiary-dim:   tertiary at 15% opacity
Theme mood: composed · urgent · exact

─────────────────────────────────────────
ROOFING — Default: Warm Mid-Tone
─────────────────────────────────────────
Rationale: Practical, storm-hardened. Weathered warm tone reads as experienced
and built-tough without going corporate dark.
--bg-base:              deep warm charcoal (dark warm brown-gray)
--bg-surface:           one step lighter, still warm
--bg-raised:            two steps lighter
--color-text-primary:   warm cream — 12:1+ on bg-base
--color-text-body:      warm tan — 5:1+ on bg-base
--color-text-muted:     warm gray — 3:1+ on bg-base
--color-text-on-accent: white
--color-border:         warm white at 10% opacity
--color-border-subtle:  warm white at 5% opacity
--color-accent:         burnt umber or iron red
--color-accent-hover:   15% lighter
--color-accent-glow:    accent at 15% opacity
--color-accent-dim:     accent at 20% opacity
--color-secondary:      warm amber or aged copper — weathered experience signal
--color-secondary-dim:  secondary at 15% opacity
--color-tertiary:       warm khaki or light sand — quiet structural element color
--color-tertiary-dim:   tertiary at 15% opacity
Theme mood: iron · storm-ready · built-to-last

─────────────────────────────────────────
PLUMBING — Default: Dark Premium
─────────────────────────────────────────
Rationale: Emergency niche. Dark projects reliability and speed.
--bg-base:              deep near-black
--bg-surface:           one step lighter
--bg-raised:            two steps lighter
--color-text-primary:   cool off-white — 18:1+ on bg-base
--color-text-body:      muted cool — 5.5:1+ on bg-base
--color-text-muted:     subdued — 3.2:1+ on bg-base
--color-text-on-accent: white
--color-border:         white at 8% opacity
--color-border-subtle:  white at 4% opacity
--color-accent:         deep steel blue
--color-accent-hover:   15% lighter
--color-accent-glow:    accent at 15% opacity
--color-accent-dim:     accent at 20% opacity
--color-secondary:      muted slate or pipe-gray — supporting reliability signal
--color-secondary-dim:  secondary at 15% opacity
--color-tertiary:       cool off-white or light silver — quiet structural element color
--color-tertiary-dim:   tertiary at 15% opacity
Theme mood: reliable · precise · no-drama

─────────────────────────────────────────
FENCE INSTALLATION — Default: Warm Mid-Tone
─────────────────────────────────────────
Rationale: Outdoor craft. Deep forest mid-tone reads as rooted and built-by-hand.
--bg-base:              deep forest green-black
--bg-surface:           one step lighter
--bg-raised:            two steps lighter
--color-text-primary:   warm cream — 14:1+ on bg-base
--color-text-body:      soft sage — 5:1+ on bg-base
--color-text-muted:     muted green — 3:1+ on bg-base
--color-text-on-accent: white
--color-border:         warm white at 8% opacity
--color-border-subtle:  warm white at 4% opacity
--color-accent:         deep forest green
--color-accent-hover:   15% lighter
--color-accent-glow:    accent at 15% opacity
--color-accent-dim:     accent at 20% opacity
--color-secondary:      muted bark brown or weathered timber — craft and durability signal
--color-secondary-dim:  secondary at 15% opacity
--color-tertiary:       warm stone or pale sage — quiet ground-level texture color
--color-tertiary-dim:   tertiary at 15% opacity
Theme mood: solid · rooted · built-by-hand

─────────────────────────────────────────
TREE SERVICE — Default: Warm Mid-Tone
─────────────────────────────────────────
Rationale: Outdoor authority. Deep natural tones project capability and decisiveness.
--bg-base:              very dark hunter green or bark brown
--bg-surface:           one step lighter
--bg-raised:            two steps lighter
--color-text-primary:   warm off-white — 15:1+ on bg-base
--color-text-body:      warm sage — 5:1+ on bg-base
--color-text-muted:     muted green — 3:1+ on bg-base
--color-text-on-accent: white
--color-border:         warm white at 8% opacity
--color-border-subtle:  warm white at 4% opacity
--color-accent:         hunter green or bark amber
--color-accent-hover:   15% lighter
--color-accent-glow:    accent at 15% opacity
--color-accent-dim:     accent at 20% opacity
--color-secondary:      deep moss or bark brown — supporting outdoor-authority signal
--color-secondary-dim:  secondary at 15% opacity
--color-tertiary:       warm sand or aged lichen — quiet natural texture color
--color-tertiary-dim:   tertiary at 15% opacity
Theme mood: capable · decisive · outdoor-authority

─────────────────────────────────────────
ELECTRICIAN — Default: Dark Premium
─────────────────────────────────────────
Rationale: Emergency niche, licensed trade. Dark projects precision and safety.
--bg-base:              deep near-black
--bg-surface:           one step lighter
--bg-raised:            two steps lighter
--color-text-primary:   warm off-white — 18:1+ on bg-base
--color-text-body:      muted warm — 5.5:1+ on bg-base
--color-text-muted:     subdued — 3.2:1+ on bg-base
--color-text-on-accent: white or deep dark
--color-border:         white at 8% opacity
--color-border-subtle:  white at 4% opacity
--color-accent:         deep amber or mahogany
--color-accent-hover:   15% lighter
--color-accent-glow:    accent at 15% opacity
--color-accent-dim:     accent at 20% opacity
--color-secondary:      warm copper or deep bronze — licensed expertise signal
--color-secondary-dim:  secondary at 15% opacity
--color-tertiary:       muted brass or warm off-white — quiet precision micro-element color
--color-tertiary-dim:   tertiary at 15% opacity
Theme mood: precise · licensed · power-controlled

─────────────────────────────────────────
CONCRETE & FLATWORK — Default: Warm Mid-Tone
─────────────────────────────────────────
Rationale: Craft trade. Warm charcoal base echoes the material itself.
--bg-base:              warm deep charcoal
--bg-surface:           one step lighter
--bg-raised:            two steps lighter
--color-text-primary:   warm cream — 12:1+ on bg-base
--color-text-body:      warm sand — 5:1+ on bg-base
--color-text-muted:     warm gray — 3:1+ on bg-base
--color-text-on-accent: white or cream
--color-border:         warm white at 10% opacity
--color-border-subtle:  warm white at 5% opacity
--color-accent:         warm rust or stone
--color-accent-hover:   15% lighter
--color-accent-glow:    accent at 15% opacity
--color-accent-dim:     accent at 20% opacity
--color-secondary:      aged iron or dry clay — permanence and material honesty signal
--color-secondary-dim:  secondary at 15% opacity
--color-tertiary:       warm limestone or pale sand — quiet grounding micro-element color
--color-tertiary-dim:   tertiary at 15% opacity
Theme mood: durable · permanent · craftsman

─────────────────────────────────────────
POOL BUILDERS — Default: Light Editorial
─────────────────────────────────────────
Rationale: Aspirational lifestyle purchase. Light editorial backgrounds project
premium possibility — the feeling of a high-end architecture magazine.
--bg-base:              warm cream or cool off-white (e.g. warm linen)
--bg-surface:           one shade cooler/darker than base
--bg-raised:            two shades cooler/darker
--color-text-primary:   deep near-black — 18:1+ on bg-base
--color-text-body:      dark warm gray — 8:1+ on bg-base
--color-text-muted:     medium warm gray — 4.5:1+ on bg-base
--color-text-on-accent: white
--color-border:         dark at 10% opacity
--color-border-subtle:  dark at 5% opacity
--color-accent:         deep cerulean or deep navy
--color-accent-hover:   15% lighter
--color-accent-glow:    accent at 15% opacity
--color-accent-dim:     accent at 20% opacity
--color-secondary:      warm terracotta or dusty sage — lifestyle warmth supporting color
--color-secondary-dim:  secondary at 15% opacity
--color-tertiary:       soft mist blue or pale linen — quiet aspirational texture color
--color-tertiary-dim:   tertiary at 15% opacity
--radius-card:          16px
--radius-button:        8px
Theme mood: aspirational · refined · worth-every-dollar

─────────────────────────────────────────
LAND CLEARING — Default: Warm Mid-Tone
─────────────────────────────────────────
Rationale: Raw outdoor work. Deep earth tones project rugged capability.
--bg-base:              deep warm rust-black or bark brown
--bg-surface:           one step lighter
--bg-raised:            two steps lighter
--color-text-primary:   warm cream — 14:1+ on bg-base
--color-text-body:      warm tan — 5:1+ on bg-base
--color-text-muted:     warm amber — 3:1+ on bg-base
--color-text-on-accent: white or cream
--color-border:         warm white at 10% opacity
--color-border-subtle:  warm white at 5% opacity
--color-accent:         deep rust or burnt amber
--color-accent-hover:   15% lighter
--color-accent-glow:    accent at 15% opacity
--color-accent-dim:     accent at 20% opacity
--color-secondary:      dark olive or bark brown — terrain authority supporting color
--color-secondary-dim:  secondary at 15% opacity
--color-tertiary:       warm bone or dusty earth — quiet raw-material texture color
--color-tertiary-dim:   tertiary at 15% opacity
Theme mood: raw · capable · terrain-command

─────────────────────────────────────────
COMMERCIAL PAINTING — Default: Light Editorial
─────────────────────────────────────────
Rationale: Professional B2B service, visual craft. Light editorial signals
polish, deadline confidence, and a business that cares about surfaces.
--bg-base:              clean warm off-white or soft cool white
--bg-surface:           one shade warmer/darker
--bg-raised:            two shades warmer/darker
--color-text-primary:   deep near-black — 18:1+ on bg-base
--color-text-body:      dark warm gray — 7:1+ on bg-base
--color-text-muted:     medium gray — 4.5:1+ on bg-base
--color-text-on-accent: white
--color-border:         dark at 8% opacity
--color-border-subtle:  dark at 4% opacity
--color-accent:         deep charcoal, slate, or muted teal
--color-accent-hover:   15% lighter
--color-accent-glow:    accent at 15% opacity
--color-accent-dim:     accent at 20% opacity
--color-secondary:      warm taupe or dusty rose — craft warmth and precision balance
--color-secondary-dim:  secondary at 15% opacity
--color-tertiary:       pale gray or cool linen — quiet editorial structure color
--color-tertiary-dim:   tertiary at 15% opacity
--radius-card:          16px
--radius-button:        8px
Theme mood: professional · precise · deadline-confident

**Step C — Override Logic for Client-Provided Colors**
If the client provides existing brand colors:
1. Use their primary color as --color-accent (becomes the button/CTA color)
2. Derive --color-accent-hover at +15% lightness/saturation shift
3. Derive --color-accent-glow as their color at 15% opacity
4. Derive --color-accent-dim as their color at 20% opacity
5. Use their color's hue family to inform the design direction:
   - Dark, cool, or neutral hues → Dark Premium
   - Warm, earthy, or brown hues → Warm Mid-Tone
   - Light, cream, or pastel hues → Light Editorial
6. Verify accent passes contrast requirements on the chosen bg-base —
   if not, shift the accent until it does and note the adjustment
7. If they have an existing website, extract its dominant background tone
   as a signal for direction — don't fight what they already present to the world

**Secondary and Tertiary Color Extraction:**
8. If the client has secondary/tertiary brand colors (from logo, vehicle wrap, uniform,
   existing website, or printed materials), assign them directly:
   - Second brand color → --color-secondary (verify 3:1+ contrast on bg-base)
   - Third brand color → --color-tertiary (verify it reads at scale — very light colors
     may need darkening to serve as secondary/tertiary tokens on light or mid-tone bases)
9. If the client has no secondary/tertiary colors, derive them from the primary:
   - --color-secondary: rotate the primary hue 30–40° toward an analogous or
     split-complementary hue. Same lightness family. Must feel like it belongs to the
     same brand — not a random second color.
   - --color-tertiary: desaturate the secondary by 40–50% and shift toward neutral.
     This is the quietest color — almost an extended neutral, not a third statement color.
   - Sanity check: all three colors should look intentional together, not like a
     3-color random palette. When in doubt, go more neutral on tertiary.
10. Always include --color-secondary-dim and --color-tertiary-dim (their respective
    colors at 15% opacity) — these are required tokens regardless of the source.

**Step D — Typography Pairing Rules**
Font pairs must be loaded from Google Fonts or similar — no system fonts.
Display font: used for H1, H2, large feature numbers, hero text only
Body font: used for everything else — H3, paragraphs, buttons, labels, nav
Never use the same font for both display and body
Suggested pairings not in the niche defaults above:
- Sora + DM Sans (technical, modern — works for any emergency niche)
- Outfit + Plus Jakarta Sans (structural, clean — works for any hybrid niche)
- Clash Display + Satoshi (premium, editorial — works for any aspiration niche)
- Barlow Condensed + Barlow (industrial, fast — works for roofing/clearing/tree)

### Step 3 — Write the Brand Profile Document

Output the complete Brand Profile as a single `.md` file using the structure below.
File name convention: `[business-name-slug]-brand-profile.md`

---

## Output Structure

The file has two sections: JSON frontmatter (for n8n/automation) and Markdown body
(for Claude Code and human review). Both must be complete.

````
```json
{
  "business_name": "",
  "owner_first_name": "",
  "niche": "",
  "primary_phone": "",
  "primary_service": "",
  "secondary_services": [],
  "cities_served": [],
  "years_in_business": "",
  "gbp_url": "",
  "existing_website": "",
  "star_rating": "",
  "review_count": "",
  "tone_preference": "",
  "primary_keyword": "",
  "secondary_keywords": [],
  "design_direction": "",
  "color_scheme": "",
  "design_tokens": {
    "bg_base": "",
    "bg_surface": "",
    "bg_elevated": "",
    "bg_glass": "",
    "blur_radius": "",
    "gradient_orb_1": "",
    "gradient_orb_2": "",
    "color_primary": "",
    "color_accent": "",
    "color_accent_hover": "",
    "color_secondary": "",
    "color_secondary_dim": "",
    "color_tertiary": "",
    "color_tertiary_dim": "",
    "color_text_primary": "",
    "color_text_body": "",
    "color_text_muted": "",
    "color_border": "",
    "color_glow": "",
    "radius_card": "",
    "radius_button": "",
    "font_display": "",
    "font_body": ""
  },
  "urgency_classification": "",
  "primary_emotion": "",
  "differentiator_oneliner": "",
  "brand_voice_adjectives": [],
  "social_proof_anchors": [],
  "map_pack_visible": false,
  "certifications": []
}
```

# [Business Name] — Brand Profile

**Generated:** [date]
**Niche:** [niche]
**Owner:** [first name]
**Primary Market:** DFW → [specific cities listed]

---

## Business Identity

| Field | Value |
|---|---|
| Business Name | |
| Owner | |
| Niche | |
| Primary Service | |
| Secondary Services | |
| Cities Served | |
| Years in Business | |
| Phone | |
| GBP URL | |
| Existing Website | |

---

## Brand Voice

**Voice Adjectives:** [adj 1] · [adj 2] · [adj 3]

**Voice in Action:**
[2 sentences describing how this brand sounds and what it never sounds like]

**Tone Preference:** [casual / professional / in between]

---

## Core Positioning

**Differentiator One-Liner:**
> [sharpened one-liner, under 15 words]

**Brand Positioning Statement:**
[3 sentences: who they are, who they serve, what they deliver — written in brand voice]

**Primary Emotion:** [emotion + 1-sentence explanation of why]

**Urgency Classification:** [Emergency / Consideration / Hybrid]

---

## Services

**Primary:** [primary service — featured in all hero sections]

**Secondary:**
- [secondary service 1]
- [secondary service 2]
- [etc.]

---

## Local Identity

**Service Area:** [list all DFW cities/neighborhoods/counties mentioned]

**Local Anchors:** [any specific references that make this business feel local — neighborhoods
served, proximity claims, local landmarks, community involvement if mentioned]

---

## Social Proof

**Star Rating:** [X.X stars] | **Review Count:** [X reviews]

**Top Review Themes:**
- [theme 1 — derived from reviews]
- [theme 2]
- [theme 3 if applicable]

**Social Proof Anchors (rewritten in brand voice):**
1. [anchor 1 — specific, credible, usable as a pull-quote or headline]
2. [anchor 2]
3. [anchor 3 if available]

**Map Pack Visibility:** [Showing / Not showing] for "[primary keyword]"

---

## Keywords

**Primary Keyword:** [primary keyword]

**Secondary Keywords:**
- [keyword 2]
- [keyword 3]
- [keyword 4]
- [keyword 5]

---

## Design System

**Design Direction:** [Dark Premium / Light Editorial / Warm Mid-Tone]
**Color Scheme:** [dark / light / mid-tone]

### Background Layers
| Token | Value | Purpose |
|---|---|---|
| --bg-base | | Page root — deepest layer |
| --bg-surface | | Cards, sections — layer 1 |
| --bg-elevated | | Modals, dropdowns — layer 2 |
| --bg-glass | | Glass card rgba() value |
| --blur-radius | | CSS backdrop-filter blur |
| --gradient-orb-1 | | Ambient orb 1 (behind glass) |
| --gradient-orb-2 | | Ambient orb 2 (creates depth) |

### Colors
| Token | Value | Contrast on bg-base | WCAG |
|---|---|---|---|
| --color-primary | | | — |
| --color-accent | | | large text min 3:1 |
| --color-accent-hover | | | — |
| --color-text-primary | | [X.X:1] | AA/AAA |
| --color-text-body | | [X.X:1] | AA required |
| --color-text-muted | | [X.X:1] | 3:1 min |
| --color-border | | | — |
| --color-glow | | | — |

### Shape & Typography
| Token | Value |
|---|---|
| --radius-card | |
| --radius-button | |
| --font-display | (Google Font name + import URL) |
| --font-body | (Google Font name + import URL) |

*Note: [Niche default / Client-provided and adapted — specify which and note any contrast adjustments made]*

---

## Trust Signals

**Certifications / Licenses / Warranties:**
- [certification 1]
- [etc. — or "None provided" if blank]

**Photo Count (GBP):** [X photos currently on profile]

---

## Notes for Downstream Skills

- **Skill 2 (Website):** Read the full Design System section before writing a single line
  of code. Check color_scheme field first — "dark", "light", or "mid-tone" — this
  determines how the CSS handles surface hierarchy and text contrast math.
  Import Playfair Display and DM Sans from Google Fonts using the exact URLs in the token
  block. Set ALL CSS custom properties on :root — values are resolved from the brand
  profile's design_tokens block. The :root block is the single source of truth; no hex
  or rgba() value appears anywhere else in the codebase.
  Gold rule (.gold-rule) is a 32px × 1px line using --color-gold — works on all three
  directions. Place below every eyebrow label. Section dividers: --color-border full-width
  with 48px --color-gold left accent via ::after. Featured cards: border-top 2px solid
  --color-gold. Review card text: Playfair Display italic (elevates testimonials).
  Hero headline: Playfair Display italic 700, clamp(38px, 5.5vw, 68px) — non-negotiable.
  No gradient orbs, no glass, no backdrop-filter anywhere.
  Motion language from theme block determines animation approach.
  Urgency class determines CTA: Emergency = "Call Now — We Answer 24/7" /
  Consideration = "Get Free Estimate".
- **Skill 3 (Voice Agent):** Use urgency classification to route between emergency and standard
  branches. Brand voice adjectives set the agent's opening tone.
- **Skill 4 (Sequences):** Primary emotion and urgency classification determine message pacing.
  Social proof anchors feed into Day 3 and Day 7 messages.
- **Skill 5 (GBP Content):** Use primary + secondary keywords throughout. Social proof anchors
  feed review response language. Local identity markers go into every post.
- **Skill 6 (Report):** Business identity block feeds the header. Metrics baseline (rating,
  review count, photo count, map pack visibility) is set here.
````

---

## Quality Checks Before Delivering

Before delivering the Brand Profile, verify every layer is complete:

**Core Brand**
- [ ] Differentiator one-liner is specific and provable — not generic
- [ ] Brand voice adjectives are distinctive — not "professional, reliable, experienced"
- [ ] Social proof anchors rewritten in brand voice — not copy-pasted from reviews
- [ ] All DFW cities listed specifically — not just "DFW area"

**Design Token System**
- [ ] JSON frontmatter complete — every token field populated, no empty strings
- [ ] color_scheme field is set: "dark" | "light" | "mid-tone"
- [ ] design_direction field matches one of the three named directions
- [ ] color_text_primary achieves 7:1+ on bg_base (WCAG AAA target)
- [ ] color_text_body achieves 4.5:1+ on bg_base (WCAG AA — non-negotiable)
- [ ] color_text_muted achieves 3:1+ on bg_base
- [ ] color_accent achieves 3:1+ on bg_base for large text (button minimum)
- [ ] color_text_on_accent achieves 4.5:1 on color_accent
- [ ] font_display is Playfair Display — no substitutions
- [ ] font_body is DM Sans — no substitutions
- [ ] No bg_glass, blur_radius, gradient_orb_1/2, color_primary, or color_glow in output
- [ ] Direction reasoning noted in the profile if the niche default was overridden

**Theme Identity**
- [ ] Theme name is a 2-word codename — evocative, not descriptive
- [ ] Mood is exactly 3 words
- [ ] Aesthetic statement is 1 sentence painting a specific visual world
- [ ] Anti-aesthetic is 1 sentence — what this brand must never look like
- [ ] Motion language assigned and matches urgency classification
- [ ] All 4 design thinking questions answered

**Hook Architecture**
- [ ] Internal trigger is niche-specific from the mapping table — not generic "stress"
- [ ] Hero resolution statement is the implied message, not literal headline copy
- [ ] Primary action is call or form — never both equally
- [ ] Variable reward moment is specific — not "we'll respond soon"
- [ ] Investment loader references Skill 4 sequence message 1

**Social Media**
- [ ] Active vs dormant platforms assigned per niche matrix
- [ ] Content pillar percentages add to 100%
- [ ] Hashtags are niche + city specific — no generic hashtags
- [ ] Grid aesthetic is one specific sentence, not a vague description
- [ ] Voice register is different for each active platform

**Tech Stack**
- [ ] Stack A or B selected with explicit rationale
- [ ] Motion language matches theme layer
- [ ] Google Fonts import URLs complete (full URL, not just font name)
- [ ] Section deviations from standard 11 noted with reason, or "Standard 11" confirmed
- [ ] Hosting subdomain specified in business-name-slug format
- [ ] Anti-AI-slop check passed: no Inter as display, no purple-on-white, no centered-everything

---

## File Handling

Save the output file to:
`/clients/[business-name-slug]/brand-profile.md`

This file is the single source of truth. Every time a downstream skill is run for this
client, the system reads this file first. Do not edit it ad hoc — if brand information
changes, re-run Skill 1 with updated inputs and regenerate the full document.

---

## LAYER A — Theme Identity (from theme-factory)

Every client gets a named theme — a single codename that encapsulates their entire visual
and emotional identity. This name is used in every downstream Claude Code session as the
shorthand reference for the brand. When Skill 2 reads "DryShield is running the
COMMAND NIGHT theme," it knows exactly what that means across every design decision.

### How to Derive the Theme Name

Read: niche + urgency classification + design direction + primary emotion + brand voice adjectives.
Combine them into a 2-word theme name that captures the feeling of the brand, not just
the industry. It should sound like a film title or a product line, not a category.

Examples of strong theme names — name should reflect the direction and niche:

Dark Premium examples:
- Water Damage, dark blue → "IRON CALM" / "STILL COMMAND"
- Plumbing, dark steel → "DEEP CURRENT" / "STILL WATER"
- Electrician, dark amber → "LIVE WIRE" / "IRON CIRCUIT"

Warm Mid-Tone examples:
- Roofing, warm charcoal → "STORM IRON" / "IRON RIDGE"
- Fence Install, forest green → "GROUND LINE" / "IRON PERIMETER"
- Tree Service, bark brown → "CANOPY COMMAND" / "DARK CANOPY"
- Concrete, warm charcoal → "POURED IRON" / "SOLID GROUND"
- Land Clearing, rust → "RAW GROUND" / "TERRAIN ZERO"

Light Editorial examples:
- Pool Builders, cream/cerulean → "STILL LUXURY" / "OPEN WATER"
- Commercial Painting, off-white/slate → "CLEAN EDGE" / "BRUSHED INK"

### Theme Spec Block

Output this block in the Brand Profile under the Design System section:

```
THEME NAME: [2-word codename]
DIRECTION: [Dark Premium / Light Editorial / Warm Mid-Tone]
MOOD: [3 words — e.g., "urgent, grounded, precise"]
AESTHETIC: [1 sentence describing the visual world — e.g., "Dark command center at 2am,
  one amber light on, everything ready to move"]
ANTI-AESTHETIC: [1 sentence describing what this brand must NEVER look like —
  e.g., "Generic contractor site with stock photos and clipart checkmarks"]
MOTION LANGUAGE: [subtle / moderate / expressive]
  - subtle: micro-interactions only, no page-level animation (Emergency niches — caller is stressed)
  - moderate: staggered reveals on scroll, hover states, one hero animation (Hybrid niches)
  - expressive: full orchestrated page load, particle effects, scroll parallax (Aspiration niches)
```

### Design Thinking Questions (answer before finalizing theme)

These come from frontend-design's design thinking process:
1. PURPOSE: What problem does this website solve in the first 3 seconds a visitor lands?
2. TONE: What is the one feeling the visitor should have when they scroll past the hero?
   (Calm relief / urgent action / aspirational desire / professional confidence)
3. DIFFERENTIATION: What is the single most memorable visual moment on this site?
   (The 60-min guarantee counter / the before/after job photo slider / the live call volume indicator)
4. ANTI-AI-SLOP CHECK: Does any element of this design look like a generic template?
   (Purple gradients on white → No. Inter font throughout → No. Centered everything → No.)

---

## LAYER B — UX Hook Architecture (from hooked-ux)

The Hook Model applies to every client website. The website is not a brochure — it is a
habit-forming trigger machine. A visitor who lands once and doesn't call is not a failed
visit; it's a first loop. The site's job is to start the loop, not close the deal alone.

Apply the Hook Model to every client's digital presence using the niche-specific internal
trigger identified in the primary emotion field.

### Internal Trigger Mapping

Each niche maps to a specific negative emotion the visitor is experiencing before they land.
The website must acknowledge that emotion in the first visible screen — hero headline, not
below the fold.

| Niche | Internal Trigger Emotion | What the Hero Must Resolve |
|---|---|---|
| Water Damage | Panic + helplessness | "Someone capable is already moving" |
| Roofing | Dread + financial anxiety | "This is manageable, we handle it" |
| Foundation Repair | Fear + home safety | "Your home is still safe, here's proof" |
| Tree Service (emergency) | Urgency + powerlessness | "We're on our way" |
| Tree Service (non-emergency) | Aesthetic desire | "This is what your yard can become" |
| Pool Builders | Aspiration + friction | "Your backyard is closer than you think" |
| Well/Septic | Disgust + urgency | "Clean resolution, fast" |
| Land Clearing | Progress anxiety | "The land is ready, let's move" |
| Commercial Painting | Professional pressure | "On time, on budget, no surprises" |

### The 4-Phase Hook Applied to the Website

**Phase 1 — Trigger (hero section)**
The internal trigger is named (not stated) in the headline. The visitor feels seen.
External trigger = phone number in the nav, prominent above fold at all times.
Emergency niches: phone number must be tap-to-call on mobile, visible without scrolling.
Consideration niches: "Get Free Estimate" CTA is the external trigger — low commitment.

**Phase 2 — Action (simplest possible step)**
From Fogg's Behavior Model (B = Motivation × Ability × Trigger):
- Emergency niches: the action is ONE tap — call. Remove every other competing action.
- Consideration niches: the action is form submission with 3 fields max (name, phone, service).
  Never ask for email + phone + service + message + address on first contact. One field, one ask.
- The action should be completable in under 60 seconds from landing.
- Note in the brand profile which action is the primary (call vs. form) and which is secondary.

**Phase 3 — Variable Reward (what they get immediately)**
After calling or submitting:
- Emergency: "A tech is being dispatched now" message (variable: they don't know how fast)
- Consideration: "You'll hear from [owner name] within 2 hours" (variable: what will he say?)
The variability is the unknown — the anticipation. Do not give them a generic "we'll be in touch."

**Phase 4 — Investment (what loads the next trigger)**
After first contact:
- SMS confirmation fires immediately (Skill 4 Message 1)
- Loads the next external trigger: "I'll send you a few things that might help while you wait"
- The follow-up sequence is the investment phase — every message deepens commitment

### Hook Architecture Output Block

Include in the brand profile:

```
HOOK ARCHITECTURE:
Primary internal trigger: [emotion]
Hero resolution statement: [the implied message — not the exact headline]
Primary action: [call / form] — completable in: [X seconds]
Primary CTA copy direction: [e.g., "Call Now — We Answer 24/7" / "Get Your Free Estimate"]
Secondary CTA: [e.g., "See Our Work" / "Learn About Our Process"]
Variable reward moment: [what happens immediately after action — be specific]
Investment loader: [what the first follow-up message says / does]
```

---

## LAYER C — Social Media Brand System

The brand profile must specify how this brand looks and sounds on every platform the client
will use. Even if the client isn't posting today, this spec exists so that when they do —
or when Kynetic AI posts on their behalf — there is zero ambiguity.

### Platform Matrix by Niche

Not every niche needs every platform. Specify which are active and which are dormant.

| Platform | Water Damage | Roofing | Foundation | Tree Service | Pool | Well/Septic | Land Clearing | Commercial Paint |
|---|---|---|---|---|---|---|---|---|
| Google Business Profile | ✅ Primary | ✅ Primary | ✅ Primary | ✅ Primary | ✅ Primary | ✅ Primary | ✅ Primary | ✅ Primary |
| Facebook | ✅ Active | ✅ Active | ✅ Active | ✅ Active | ✅ Active | ⚪ Dormant | ⚪ Dormant | ✅ Active |
| Instagram | ⚪ Dormant | ✅ Active | ⚪ Dormant | ✅ Active | ✅ Primary | ⚪ Dormant | ⚪ Dormant | ✅ Active |
| Nextdoor | ✅ Active | ✅ Active | ✅ Active | ✅ Active | ⚪ Dormant | ✅ Active | ⚪ Dormant | ⚪ Dormant |
| YouTube/Shorts | ⚪ Dormant | ⚪ Dormant | ⚪ Dormant | ✅ Active | ✅ Active | ⚪ Dormant | ⚪ Dormant | ⚪ Dormant |

Legend: ✅ Active = maintain + post, ⚪ Dormant = profile exists, no regular posting

### Per-Platform Brand Spec

For each Active platform, specify:

**GBP (Google Business Profile) — all niches:**
- Profile category: [primary GBP category]
- Cover photo direction: [what type of image — crew + truck / before-after / owner portrait]
- Post frequency: 8x/month (from monthly cadence)
- Post visual style: Brand colors from design tokens. Text overlay using --font-display
  for headline, white text, semi-transparent dark overlay on photo.
  Never use Canva default templates — always brand-colored overlays.
- Post hook formula: [niche-specific — see Skill 5]

**Facebook — where active:**
- Profile photo: Logo mark on --bg-base background
- Cover photo: Hero shot with differentiator one-liner overlaid in --font-display
- Post visual style: Same as GBP — brand color overlay on job photos
- Ad creative direction (if running ads): dark background + accent color CTA button,
  headline in --font-display, body in --font-body. Never light backgrounds.
- Audience targeting note: Homeowners 35–65, within [service cities], homeowner status

**Instagram — where active:**
- Grid aesthetic: Alternating pattern — job photo / stat graphic / job photo / quote card
- Post color system: Every graphic uses --bg-surface as background, --color-accent for
  pull-quote text, --color-text-primary for headlines
- Story template direction: Dark background + one large number (review count, years,
  response time) + differentiator one-liner
- Hashtag strategy: 5–8 niche-specific (#[NicheDFW] #[city]homeowner #[service]) — never
  generic (#contractor, #smallbusiness)
- Reel direction (if applicable): Before/after job walkthroughs, 30–45 seconds,
  no talking head — just the transformation with text overlay

**Nextdoor — where active:**
- Content tone: Hyper-local. Always mention specific neighborhoods, not just cities.
- Post type: Neighborhood alert posts ("We just finished a job on [street area] in [city] —
  if you see pooling near your foundation after last week's rain, here's what to check")
- Review request: After every job in that neighborhood, post a "thanks to [first name] in
  [neighborhood]" appreciation post — tags trigger local visibility

### Content Pillars

Every active platform uses the same 4 content pillars, proportioned by niche:

| Pillar | Emergency Niches | Consideration Niches |
|---|---|---|
| Job Spotlight (before/after) | 50% | 40% |
| Education (tips, warnings, how-to) | 25% | 20% |
| Social Proof (review highlights, stats) | 15% | 20% |
| Seasonal / Local (weather, DFW events) | 10% | 20% |

### Visual Identity Rules for Social

All social graphics must follow these rules — no exceptions:
1. Always use --bg-base or --bg-surface as the graphic background — the site's
   actual color scheme, not a generic dark overlay applied to every niche
2. Never use stock photos — only real job photos provided by client
3. All text overlays use --font-display for headlines, --font-body for descriptions
4. Logo appears in bottom-right corner at 15% of frame width — never centered
5. The accent color is used for ONE element per graphic (CTA, stat, pull-quote) — not as fill
6. Phone number appears on every graphic that isn't purely aesthetic

### Brand Voice on Social (per platform)

The brand voice adjectives from the core profile apply everywhere, but the register shifts:
- GBP posts: Professional, keyword-aware, local references always
- Facebook: Conversational but expert — write like the owner is speaking, not a marketer
- Instagram: Visual-first, copy is secondary — 1–2 lines max for captions
- Nextdoor: Neighborly, specific, low-pressure — never salesy

### Social Media Output Block for Brand Profile

```
SOCIAL MEDIA SPEC:
Active platforms: [list]
Dormant platforms: [list — profiles exist but no posting cadence]
Grid aesthetic direction: [1 sentence — e.g., "Warm cream cards with iron-red stat overlays"
or "Deep charcoal job photos with amber callouts" — match the site's actual color scheme]
Brand voice per channel:
  - GBP: [adjective] + [adjective]
  - Facebook: [adjective] + [adjective]
  - Instagram: [adjective] + [adjective]
  - Nextdoor: [adjective] + [adjective]
Content pillar split: [Job% / Education% / Social Proof% / Seasonal%]
Hashtag clusters: [list primary hashtags — 8 max]
Post visual anchor: [the one element that appears on every single graphic]
```

---

## LAYER D — Tech Stack Spec for Website Build (from web-artifacts-builder + frontend-design)

When Skill 2 generates the Claude Code prompt, it must specify a complete, unambiguous
tech stack. This layer defines that stack at brand profile time so it's locked in and
consistent across every build.

### Stack Decision Logic

The website tech stack is determined by design direction + motion language:

**Stack A — HTML/CSS/JS (Vanilla)**
Use when: motion language = subtle, site is purely informational, no interactive tools
Benefit: Fastest load, easiest to host on Netlify, zero dependencies
When to use: Emergency niches with simple 7-section sites

**Stack B — React (Vite + Tailwind)**
Use when: motion language = moderate or expressive, OR the site needs any interactive
element (calculator, quote tool, live review counter, service selector)
Benefit: Component reuse across all 8 niche sites, reusable UI library
When to use: All aspiration niches, all hybrid niches, any site with >7 sections
Stack: React 18 + TypeScript + Vite + Tailwind CSS 3 + shadcn/ui components

**Anti-AI-Slop Rules (from web-artifacts-builder + frontend-design):**
These apply regardless of stack. Violating these produces generic, unprofessional output.
- NEVER use Inter, Roboto, Arial, or system fonts as --font-display
- NEVER use purple gradients on white backgrounds
- NEVER center every section — use asymmetric layouts, grid-breaking hero elements
- NEVER use uniform rounded corners everywhere — vary radius by component type
- NEVER use stock photos or placeholder images — use real client job photos or none
- NEVER build a navbar with 6+ links — 3–4 max, phone number always rightmost
- NEVER use a generic "hero image" — the hero background is the site's --bg-base color,
  with the serif italic headline as the primary visual element and gold rule above it.
  The background is not always dark — it matches the assigned direction.

### CSS Architecture

All CSS is built on the design token system from the brand profile. The :root block
is the first thing in every stylesheet:

```css
:root {
  --bg-base: [value];
  --bg-surface: [value];
  --bg-elevated: [value];
  --bg-glass: [value];
  --blur-radius: [value];
  --gradient-orb-1: [value];
  --gradient-orb-2: [value];
  --color-primary: [value];
  --color-accent: [value];
  --color-accent-hover: [value];
  --color-text-primary: [value];
  --color-text-body: [value];
  --color-text-muted: [value];
  --color-border: [value];
  --color-glow: [value];
  --radius-card: [value];
  --radius-button: [value];
}
```

No hardcoded hex values anywhere in the component code. Every color reference goes
through a CSS variable. This is what makes re-theming (Variant 1 → Variant 3) a
single file change rather than a full rebuild.

### Motion Spec

Based on motion language assignment from the theme spec:

**Subtle (Emergency niches):**
- Page load: no animation
- Hover states: opacity 0.8 → 1.0 on buttons, 200ms ease
- Phone number: gentle pulse every 4s (draws eye without distracting stressed visitor)
- No scroll animations — every piece of content visible immediately

**Moderate (Hybrid niches):**
- Page load: hero text staggered reveal (0ms, 150ms, 300ms delays)
- Cards: fade-up on scroll enter, 400ms ease-out
- CTA button: scale(1.03) on hover, box-shadow glow pulse
- No parallax — too distracting for conversion-focused pages

**Expressive (Aspiration niches):**
- Page load: full orchestrated sequence — orbs fade in, then headline, then subheadline,
  then CTA (total 800ms)
- Scroll: staggered card reveals with slight Y translation (0 → translateY(0))
- Hero: animated gradient mesh in background (CSS @keyframes, not JS)
- Gallery/portfolio: hover scale + overlay reveal
- Never autoplay video or audio — user-initiated only

### Section Architecture for Every Client Site

Every site has exactly these sections in this order. No exceptions unless explicitly
noted in the brand profile with a reason.

1. **Nav** — Logo left, 3–4 links center, phone number right (tap-to-call on mobile)
2. **Hero** — Ambient orb bg, theme name headline, differentiator sub, primary + secondary CTA,
   trust bar (rating, years, certifications)
3. **Social Proof Bar** — Star rating large, review count, 2–3 key metrics. Full-width strip.
4. **Primary Service** — What it is, what happens when you call, what you get. No fluff.
5. **Services Grid** — All services as cards. Primary service highlighted with accent border.
6. **How It Works** — 3 steps only. "Call → We Arrive → Problem Solved." Never more than 3.
7. **Reviews** — 3 scraped reviews displayed as quote cards. Social proof anchors from brand profile.
8. **Service Area** — Listed cities. Optional map embed.
9. **About / Owner** — Photo of owner (if available), human story, years in business,
   certifications. This section is the trust closer.
10. **Final CTA** — Repeat of primary CTA. Large phone number. "24/7" or "Free Estimate" context.
11. **Footer** — Business name, address, phone, GBP link, copyright.

### Tech Stack Output Block for Brand Profile

```
TECH STACK:
Stack selection: [A — Vanilla / B — React+Vite+Tailwind]
Stack rationale: [1 sentence why]
Motion language: [subtle / moderate / expressive]
Font loading: [Google Fonts import URL for both fonts]
Sections: [list any section deviations from standard 11 — or "Standard 11-section architecture"]
Interactive elements: [list any — quote calculator, review counter, photo gallery, etc.]
Hosting: Netlify subdomain — [business-name-slug].kyneticai.com
Form webhook: n8n endpoint (configure on deploy)
Analytics: None by default — add Google Analytics tag if client requests
```

---

## LAYER E — Complete JSON Frontmatter

This is the complete JSON frontmatter block for the Brand Profile. Every field must
be populated before the file is saved. This is the machine-readable layer — n8n,
Claude Code, and all downstream skills read from this block.

The full JSON structure (paste this as the frontmatter of the Brand Profile .md file):

```json
{
  "business_name": "",
  "owner_first_name": "",
  "owner_last_name": "",
  "niche": "",
  "primary_phone": "",
  "physical_address": "",
  "primary_service": "",
  "secondary_services": [],
  "cities_served": [],
  "years_in_business": "",
  "gbp_url": "",
  "existing_website": "",
  "star_rating": "",
  "review_count": "",
  "tone_preference": "",
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
  "color_scheme": "",
  "design_tokens": {
    "bg_base": "",
    "bg_surface": "",
    "bg_elevated": "",
    "bg_glass": "",
    "blur_radius": "",
    "gradient_orb_1": "",
    "gradient_orb_2": "",
    "color_primary": "",
    "color_accent": "",
    "color_accent_hover": "",
    "color_secondary": "",
    "color_secondary_dim": "",
    "color_tertiary": "",
    "color_tertiary_dim": "",
    "color_text_primary": "",
    "color_text_body": "",
    "color_text_muted": "",
    "color_border": "",
    "color_glow": "",
    "radius_card": "",
    "radius_button": "",
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
    "agent_name": "",
    "after_hours_mode": "",
    "booking_method": "",
    "transfer_name": ""
  },

  "sequences": {
    "owner_signature": "",
    "sms_from_number": "",
    "seasonal_hooks": []
  },

  "gbp": {
    "place_id": "",
    "review_link_url": "",
    "categories": [],
    "current_description_exists": false,
    "photo_count": "",
    "seasonal_content_hooks": []
  },

  "client": {
    "email": "",
    "notion_page_url": "",
    "retainer_start_date": ""
  }
}
```

**Field completion rules:**
- All string fields: empty string `""` is not acceptable in a completed Brand Profile.
  Every field must have a real value or the note `"pending-setup"` for the 3 admin
  fields (sms_from_number, notion_page_url) that are provisioned after intake.
- Array fields: must have at least one item. An empty `[]` means the field was skipped.
- `map_pack_visible` and `current_description_exists`: boolean, no quotes.
- `retainer_start_date`: ISO format — `"YYYY-MM-DD"`.
- `seasonal_hooks` and `seasonal_content_hooks`: 2–3 DFW-specific timing triggers
  per niche. Examples:
  - Water Damage: ["post-hailstorm", "winter-freeze-pipe-burst", "spring-flooding"]
  - Roofing: ["post-hailstorm", "pre-winter-inspection", "spring-storm-season"]
  - Pool Builders: ["pre-summer-build-window", "late-winter-planning-season"]
  - Foundation: ["post-heavy-rain", "summer-drought-soil-shift"]
  - Tree Service: ["post-storm-emergency", "fall-dead-branch-season", "spring-clearance"]

