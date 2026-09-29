# Claude SEO Skill

Universal SEO skill for Claude Code. Comprehensive website analysis across technical SEO, content quality, schema markup, Core Web Vitals, AI search optimization, and local SEO — delivered as actionable audits and PDF/HTML reports.

## When to invoke this skill

- Running a full SEO audit on a website
- Checking Core Web Vitals (LCP, INP, CLS)
- Auditing or generating schema markup / structured data
- Optimizing for AI search (ChatGPT, Perplexity, AI Overviews)
- Local SEO or Google Business Profile analysis
- Building competitor comparison or programmatic SEO pages
- Setting up Google Search Console, PageSpeed, GA4, or CrUX integrations
- Generating SEO reports with charts

## Capabilities

### Technical Analysis
- Core Web Vitals auditing (LCP, INP, CLS)
- Technical SEO across 9 categories
- Schema markup detection, validation, and generation
- Sitemap architecture analysis and generation

### Content & Authority
- E-E-A-T evaluation (per September 2025 guidelines)
- Image optimization analysis
- Content quality assessment

### AI & Emerging Search (GEO)
- AI Overviews / Generative Engine Optimization
- Optimization for ChatGPT, Perplexity, and other AI search platforms

### Local & International
- Google Business Profile audits
- Local SEO and maps intelligence
- Multi-language hreflang validation

### Strategic Tools
- Competitor page comparison generation
- Programmatic SEO planning (with quality gates)
- Semantic keyword clustering
- Google API integrations: Search Console, PageSpeed, GA4, CrUX

## Architecture

- **19+ sub-skills** for specific SEO domains
- **12+ subagents** for parallel task delegation
- **3 extensions:** DataForSEO, Firecrawl, Banana integrations
- **Schema templates:** JSON-LD for all major entity types
- Produces PDF/HTML reports with charts

## Works alongside

`marketing-skills` (`seo-audit` sub-skill), `firecrawl` (page content extraction), `website-builder` (implement fixes).

## Source

https://github.com/AgriciDaniel/claude-seo
