import { Cormorant_Garamond, Geist_Mono, Inter } from 'next/font/google';

import { cn } from '@/lib/utils';

// Self-hosted by next/font (DESIGN_SYSTEM typography): Inter for the interface, Cormorant Garamond
// for page titles and sign-in. The theme maps these onto --font-sans and --font-display.
const fontInter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const fontCormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-cormorant'
});

const fontGeistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const fontVariables = cn(fontInter.variable, fontCormorant.variable, fontGeistMono.variable);
