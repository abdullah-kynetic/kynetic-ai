import type { Niche } from './_types';

const remodelers: Niche = {
  slug: 'remodelers',
  draft: true, // flip to false once every TODO on the page is resolved
  metaTitle: 'Done-for-you AI System for Remodelers | Kynetic AI',
  metaDescription:
    'We call every Meta and web lead back in under 60 seconds, follow up on every quote, and book the estimate. Built and run for you by Kynetic AI.',
  hero: {
    eyebrow: 'For remodelers',
    headline: 'Done-for-you AI System for remodelers',
    sub: 'We call every Meta and web lead back in under 60 seconds, follow up on every quote, and book the estimate. Built and run for you.',
    ctaLabel: 'Book your free lead leak audit',
    ctaNote: 'A short call. We show you where leads are slipping away.',
  },
  video: {
    title: 'A word from the founder',
    embedUrl: null, // e.g. 'https://www.youtube-nocookie.com/embed/VIDEO_ID' or a Loom/Vimeo embed URL
    placeholder: 'Founder video (4 to 6 minutes) goes here',
    todo: 'TODO (Abdullah): record the 4 to 6 minute founder video and give me the embed URL. Set `video.embedUrl` in src/niches/remodelers.ts.',
  },
  services: {
    eyebrow: 'Services',
    title: 'Already built and tested. We switch on what you need.',
    lede: 'Our systems are already built and tested. After a quick audit we switch on only what your business actually needs, so you never pay for pieces you will not use.',
    core: {
      name: 'Alex, your speed-to-lead caller',
      badge: 'Live and ready',
      desc: 'The core of the system. Alex calls every new Meta and web lead back in under 60 seconds, then follows up by text, and books the estimate on your calendar.',
      points: [
        'Calls new leads within 60 seconds, day or night',
        'Text follow-up when a lead does not pick up',
        'Books the estimate straight onto your calendar',
      ],
    },
    addonsTitle: 'Add-ons, chosen on your audit',
    addonsNote: 'We recommend add-ons based on what the audit finds. Nothing is switched on until you agree.',
    addons: [
      { name: 'Estimate & Quote Follow-up', desc: 'Follows up on every quote you send until you get a yes or a clear no.', badge: 'Add-on' },
      { name: 'Lead Recovery & Nurture', desc: 'Reaches back out to old leads and keeps in touch with people who are not ready yet.', badge: 'Add-on' },
      { name: 'Reputation Engine', desc: 'Sends a review request to every customer. Every customer is asked, with no review gating.', badge: 'Add-on' },
      { name: 'Online Presence Management', desc: 'Keeps your online listings and profiles accurate and up to date.', badge: 'Add-on' },
    ],
    todo: 'TODO (Abdullah): confirm which add-ons are deployed-ready. Until then they are labelled only "Add-on". Edit `services.addons[].badge` to show a status.',
  },
  how: {
    eyebrow: 'How it works',
    title: 'Four steps from audit to live',
    steps: [
      { title: 'Free lead leak audit', desc: 'A short call to map how leads reach you today and where they slip away.' },
      { title: 'We switch on what fits', desc: 'Alex first, then only the add-ons your audit shows you need.' },
      { title: 'Live in 14 days', desc: 'We build, test every call and text, and go live.' },
      { title: 'Track it in your client portal', desc: 'See what is switched on and what each system produces.' },
    ],
  },
  portal: {
    eyebrow: 'Client portal',
    title: 'See exactly what is running and what it delivers',
    lede: 'Your client portal shows which systems are switched on for your business and the results each one produces, so you are never guessing.',
    points: [
      'Which systems are on, and which are not',
      'Booked estimates from each system',
      'How fast every new lead got a response',
    ],
    mockNote: 'Illustrative layout only. No real client data.',
  },
  guarantee: {
    eyebrow: 'Our guarantee',
    title: 'Live in 14 days, with a booked-appointment guarantee',
    draftWording: '[DRAFT WORDING] You are live in 14 days, and we guarantee booked appointments from your leads.',
    condition: 'This depends on you answering the leads we book and completing onboarding.',
    todo: 'TODO (Abdullah): approve the exact guarantee wording (what is guaranteed, how many appointments, the remedy, and the conditions). The text above is a draft.',
  },
  proof: {
    eyebrow: 'Results',
    title: 'Results from remodelers',
    placeholders: ['Client result placeholder', 'Client result placeholder', 'Client result placeholder'],
    todo: 'TODO (Abdullah): add real testimonials, numbers and logos once you have approval to share them. Nothing is invented here.',
  },
  finalCta: {
    title: 'Find out where your leads are leaking',
    sub: 'Book a free lead leak audit and we will show you.',
    ctaLabel: 'Book your free lead leak audit',
  },
};

export default remodelers;
