import type { Niche } from './_types';

const remodelers: Niche = {
  slug: 'remodelers',
  draft: true, // noindex + left out of the sitemap. Flip to false when the page is ready to be found
  metaTitle: 'Done-for-you AI System for Remodelers | Kynetic AI',
  metaDescription:
    'More booked appointments from the leads you already pay for, or we work free until you get them. Built and run for you by Kynetic AI.',
  hero: {
    eyebrow: 'Done-for-you AI System for remodelers',
    headline: 'We book remodelers 20% more appointments than last month in 30 days, or we work free until we do.',
    sub: 'Alex calls every new Meta and web lead back in under 60 seconds and books the estimate, so more of the ad spend you already pay for turns into appointments on your calendar. Built and run for you.',
    ctaLabel: 'Book your free lead leak audit',
    ctaNote: 'A few short questions, then pick a time. The audit call is free.',
    termsLink: 'Terms apply. See how it is measured.',
  },
  example: { title: 'What slow replies can cost a remodeler' },
  video: {
    title: 'A word from the founder',
    embedUrl: null, // e.g. 'https://www.youtube-nocookie.com/embed/VIDEO_ID' or a Loom/Vimeo embed URL
    placeholder: 'Founder video (4 to 6 minutes) goes here',
    todo: 'TODO (Abdullah): record the 4 to 6 minute founder video and give me the embed URL. Set `video.embedUrl` in src/niches/remodelers.ts.',
  },
  services: {
    eyebrow: 'Services',
    title: 'Already built and tested. We switch on only what books you more work.',
    lede: 'After a quick audit we switch on only the pieces that fit your business, so you never pay for ones you will not use.',
    core: {
      title: 'Book estimates while you\'re on the job site.',
      name: 'Alex, your speed-to-lead caller',
      badge: 'Live and ready',
      desc: 'While you are on the job, Alex calls every new Meta and web lead back in under 60 seconds, follows up by text, and books the estimate on your calendar.',
      points: [
        'Be the first to answer: every new lead gets a call within 60 seconds, day or night',
        'Leads who do not pick up get a text follow-up, so fewer slip away',
        'Estimates land booked on your calendar while you work',
      ],
      demo: {
        title: 'Alex in action',
        steps: [
          { label: 'New lead comes in', detail: 'Meta ad or website form' },
          { label: 'Alex calls back', detail: 'Within 60 seconds' },
          { label: 'Text follow-up', detail: 'If the lead does not pick up' },
          { label: 'Estimate booked', detail: 'On your calendar' },
        ],
      },
    },
    addonsTitle: 'Add-ons, chosen on your audit',
    addonsNote: 'We recommend add-ons based on what the audit finds. Nothing is switched on until you agree.',
    addons: [
      { outcome: 'Close more of the quotes you send', name: 'Estimate & Quote Follow-up', desc: 'Follows up on every quote you send until you get a yes or a clear no.', badge: 'Add-on', price: '$2,500 + $500/mo' },
      { outcome: 'Turn old leads into new jobs', name: 'Lead Recovery & Nurture', desc: 'Reaches back out to old leads and keeps in touch with people who are not ready yet.', badge: 'Add-on', price: '$3,000 one-time or $1,000/mo' },
      { outcome: 'More 5-star reviews', name: 'Reputation Engine, no review gating', desc: 'Sends a review request to every customer. Every customer is asked, with no review gating.', badge: 'Add-on', price: 'Scoped on your audit' },
      { outcome: 'Get found and trusted on Google', name: 'Online Presence Management', desc: 'Keeps your online listings and profiles accurate and up to date.', badge: 'Add-on', price: 'Scoped on your audit' },
    ],
    own: 'You own it: your systems, your data, your accounts. If you ever leave, you keep everything.',
    todo: 'TODO (Abdullah): confirm which add-ons are deployed-ready. Until then they are labelled only "Add-on". Edit `services.addons[].badge` to show a status.',
  },
  how: {
    eyebrow: 'How it works',
    title: 'Four steps from audit to live',
    steps: [
      { title: 'Free lead leak audit', desc: 'A short call to map how leads reach you today and where they slip away.' },
      { title: 'We fix your biggest leak first', desc: 'Alex first, then only the add-ons your audit shows will book you more work.' },
      { title: 'We build, test and go live', desc: 'We build it, test every call and text, and agree your go-live date on the audit.' },
      { title: 'Watch booked appointments climb in your portal.', desc: 'See every booked appointment next to last month\'s baseline, and how fast each lead got a response.' },
    ],
  },
  portal: {
    eyebrow: 'Client portal',
    title: 'See every booked appointment and how fast each lead got a call',
    lede: 'Your client portal shows the estimates booked from each system and how quickly every new lead was answered, so you are never guessing.',
    points: [
      'Booked appointments, next to last month\'s baseline',
      'How fast every new lead got a response',
      'Which systems are on, and which are not',
    ],
    mockNote: 'Illustrative layout only. No real client data.',
  },
  guarantee: {
    eyebrow: 'Our guarantee',
    title: 'How the guarantee works',
    wording: 'We book remodelers 20% more appointments than last month in 30 days, or we work free until we do.',
    termsTitle: 'How we measure it',
    terms: [
      'Your baseline is the appointments you booked last month.',
      'You keep your ads at last month\'s level.',
      'You take the appointments we set.',
      'We guarantee appointments booked, not jobs closed.',
    ],
    approved: true, // offer wording locked by Abdullah on 2026-11-05; the four terms above are plain-language and still need his read
    todo: 'TODO (Abdullah): confirm when the 30 days start (go-live or first live lead), what happens when last month was zero or very low, and whether "appointments" means the ones we book or every booked appointment that month.',
  },
  proof: {
    eyebrow: 'Results',
    title: 'Results from remodelers',
    cases: [], // add real, approved { client, contact, built, result } entries; the case cards then replace the note below
    emptyNote: 'Our first remodeler builds are underway. Most clients keep results private; we\'ll show what they let us.',
    placeholders: ['Client result placeholder', 'Client result placeholder', 'Client result placeholder'],
    todo: 'TODO (Abdullah): add real testimonials, numbers and logos once you have approval to share them. Nothing is invented here.',
  },
  finalCta: {
    title: 'Find out how many booked estimates your leads are leaving on the table',
    sub: 'We book remodelers 20% more appointments than last month in 30 days, or we work free until we do.',
    ctaLabel: 'Book your free lead leak audit',
    steps: 'A few short questions, then pick a time. The audit call is free.',
  },
};

export default remodelers;
