import type { IndustryTemplateKey } from '../../admin/industry-templates';

export type DemoClientProfile = {
  slug: string;
  tenantId: string;
  name: string;
  niche: 'roofing' | 'pools' | 'windows_doors' | 'remodeling';
  template: IndustryTemplateKey;
  baseline: number;
  avgJobCents: number;
  leads30: number;
  calls30: number;
  reached30: number;
  booked30: number;
  won30: number;
  messages30: number;
  tasks30: number;
  automationRuns30: number;
  systems: readonly string[];
};

const roofingSystems = ['alex_core', 'quote_followup', 'missed_call_textback'] as const;
const standardSystems = ['alex_core', 'quote_followup'] as const;
const remodelingSystems = ['alex_core', 'quote_followup', 'reactivation'] as const;

export const DEMO_CLIENT_PROFILES: readonly DemoClientProfile[] = [
  [
    'super-roofer',
    '03c71abb-b1b5-4faa-9021-cd92aad0c689',
    'Super Roofer LLC',
    'roofing',
    8,
    32,
    61,
    21,
    10,
    2,
    80,
    19,
    45
  ],
  [
    'dr-roofing-construction',
    '11c22116-e50b-470c-9fe4-ddfc569f22d1',
    'DR Roofing & Construction',
    'roofing',
    15,
    60,
    114,
    40,
    19,
    4,
    150,
    36,
    84
  ],
  [
    'fairclaims-roofing',
    '53aa78d4-0da7-47ce-8226-60c2ed0cb82e',
    'FairClaims Roofing & Construction',
    'roofing',
    4,
    20,
    38,
    13,
    6,
    1,
    50,
    12,
    28
  ],
  [
    'fortbend-roofing-texas',
    '2f5f35fc-876b-436c-813e-1c1e7b0f80c9',
    'Fortbend Roofing Texas',
    'roofing',
    8,
    32,
    61,
    21,
    10,
    2,
    80,
    19,
    45
  ],
  [
    'rodriguez-roofing',
    'f519059b-7967-43a5-aed0-4a65cb3aa4ac',
    'Rodriguez Roofing',
    'roofing',
    4,
    20,
    38,
    13,
    6,
    1,
    50,
    12,
    28
  ],
  [
    'bluewater-pools',
    '55f4c981-4b24-43cf-b4b6-76ed2b92392b',
    'BlueWater Pools, LLC',
    'pools',
    4,
    32,
    61,
    21,
    6,
    1,
    80,
    19,
    45
  ],
  [
    'tidal-wave-custom-pools',
    '3dacac1a-a4ab-478c-b502-61446d3b3419',
    'Tidal Wave Custom Pools',
    'pools',
    4,
    28,
    53,
    18,
    6,
    1,
    70,
    17,
    39
  ],
  [
    'kelley-pools-outdoor',
    '33b14052-abc6-44fd-8a35-5d5bef77d8c5',
    'Kelley Pools and Outdoor',
    'pools',
    3,
    20,
    38,
    13,
    4,
    1,
    50,
    12,
    28
  ],
  [
    'clarity-windows-doors',
    '50f77131-da29-4a13-9718-e9f0f528fa4b',
    'Clarity Windows And Doors',
    'windows_doors',
    20,
    88,
    167,
    58,
    26,
    5,
    220,
    53,
    123
  ],
  [
    'bridgewood-windows-doors',
    'a707203e-e094-4832-8dc2-63106bb7e1dc',
    'Bridgewood Windows & Doors',
    'windows_doors',
    4,
    20,
    38,
    13,
    6,
    1,
    50,
    12,
    28
  ],
  [
    'kitchens-alive',
    '8c192cef-6571-40c2-9449-cbe91ac76ce9',
    'Kitchens Alive LLC',
    'remodeling',
    8,
    40,
    76,
    26,
    10,
    2,
    100,
    24,
    56
  ],
  [
    'manta-construction',
    'c2dc4982-933a-4770-a891-c1c7e2384c93',
    'Manta Construction Company',
    'remodeling',
    6,
    32,
    61,
    21,
    8,
    2,
    80,
    19,
    45
  ],
  [
    '123-remodeling',
    '15e5f8dd-894e-4cac-b7d1-ff93905e837f',
    '123 Remodeling',
    'remodeling',
    9,
    48,
    91,
    32,
    12,
    2,
    120,
    29,
    67
  ]
].map(
  ([
    slug,
    tenantId,
    name,
    niche,
    baseline,
    leads30,
    calls30,
    reached30,
    booked30,
    won30,
    messages30,
    tasks30,
    automationRuns30
  ]) => ({
    slug: slug as string,
    tenantId: tenantId as string,
    name: name as string,
    niche: niche as DemoClientProfile['niche'],
    template: (niche === 'roofing' ? 'roofing' : niche) as IndustryTemplateKey,
    baseline: baseline as number,
    avgJobCents:
      niche === 'pools'
        ? 8_200_000
        : niche === 'windows_doors'
          ? 1_600_000
          : niche === 'remodeling'
            ? 3_800_000
            : 1_450_000,
    leads30: leads30 as number,
    calls30: calls30 as number,
    reached30: reached30 as number,
    booked30: booked30 as number,
    won30: won30 as number,
    messages30: messages30 as number,
    tasks30: tasks30 as number,
    automationRuns30: automationRuns30 as number,
    systems:
      niche === 'roofing'
        ? roofingSystems
        : niche === 'remodeling'
          ? remodelingSystems
          : standardSystems
  })
);

export const DEMO_CLIENT_BY_SLUG = new Map(DEMO_CLIENT_PROFILES.map((p) => [p.slug, p]));

export const NICHE_COPY = {
  roofing: {
    services: ['Roof replacement', 'Roof repair', 'Storm damage', 'Inspection'],
    questions: [
      'What is the property address?',
      'Is this for a repair, a full replacement, or storm damage?',
      'How old is the roof?',
      'Are you working with insurance?',
      'Are you the homeowner?',
      'What time works for a free inspection?'
    ],
    booking:
      'Free roof inspection, 60 minutes, on-site; earliest next business day; maximum two per slot.'
  },
  pools: {
    services: ['Custom pool build', 'Pool remodel', 'Outdoor living'],
    questions: [
      'New pool, remodel, or outdoor living?',
      'What is the property address?',
      'Do you have an HOA?',
      'What budget range are you planning?',
      'When would you like to swim?',
      'Can we book a backyard design consult?'
    ],
    booking:
      'Backyard design consultation, 90 minutes; earliest next business day; maximum two per slot.'
  },
  windows_doors: {
    services: ['Window replacement', 'Door replacement'],
    questions: [
      'Windows, doors, or both?',
      'How many windows or doors?',
      'What is the property address?',
      'Do you own the home?',
      'When would you like this done?',
      'Can we book a free in-home measure and quote?'
    ],
    booking:
      'In-home measure and quote, 60 minutes; earliest next business day; maximum two per slot.'
  },
  remodeling: {
    services: ['Kitchen remodel', 'Bath remodel', 'Cabinetry'],
    questions: [
      'Kitchen, bath, or both?',
      'What is the property address?',
      'Do you own the home?',
      'What budget range are you planning?',
      'When would you like the project to start?',
      'Can we book an in-home design consultation?'
    ],
    booking:
      'In-home design consultation, 90 minutes; earliest next business day; maximum two per slot.'
  }
} as const;
