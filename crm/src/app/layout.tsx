import Providers from '@/components/layout/providers';
import { Toaster } from '@/components/ui/sonner';
import { fontVariables } from '@/components/themes/font.config';
import { THEME } from '@/components/themes/theme.config';
import ThemeProvider from '@/components/themes/theme-provider';
import type { Metadata, Viewport } from 'next';
import NextTopLoader from 'nextjs-toploader';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import '../styles/globals.css';

export const metadata: Metadata = {
  ...(process.env.NEXT_PUBLIC_APP_URL
    ? { metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL) }
    : {}),
  title: {
    default: 'Kynetic',
    template: '%s | Kynetic'
  },
  description: 'Kynetic AI client portal',
  robots: { index: false, follow: false }
};

export const viewport: Viewport = {
  themeColor: '#faf8f5'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning data-theme={THEME} className={fontVariables}>
      <body className='bg-background overflow-x-hidden overscroll-none font-sans antialiased'>
        <NextTopLoader color='var(--primary)' showSpinner={false} />
        <NuqsAdapter>
          {/* Light by default; the choice is the user's, so the system setting is never followed (DC-040). */}
          <ThemeProvider
            attribute='class'
            defaultTheme='light'
            enableSystem={false}
            disableTransitionOnChange
            enableColorScheme
          >
            <Providers>
              <Toaster />
              {children}
            </Providers>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
