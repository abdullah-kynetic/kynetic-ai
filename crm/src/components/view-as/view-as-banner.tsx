import { ExpiryRedirect } from './expiry-redirect';

export const VIEW_AS_BANNER_HEIGHT = '2.75rem';

/**
 * The view-as banner (F-57, DESIGN.md): full width, sticky, amber (attention) tokens, never
 * tenant-colored and never dismissible. The session is read-only and ends 30 minutes after it
 * starts; Exit is a plain link to `/view-as/exit`. It sits above the top bar; the layout sets
 * `--view-as-h` so the sidebar and header start below it.
 */
export function ViewAsBanner({
  tenantName,
  adminName,
  msRemaining
}: {
  tenantName: string;
  adminName: string;
  /** Milliseconds until the hard end, measured on the server when the page rendered. */
  msRemaining: number;
}) {
  const minutes = Math.max(1, Math.ceil(msRemaining / 60_000));
  return (
    <div
      role='region'
      aria-label='View as client'
      className='sticky top-0 z-50 flex h-(--view-as-h) items-center justify-between gap-3 border-attention/30 bg-attention-soft text-attention animate-in slide-in-from-top-2 fade-in-0 border-b px-4 text-sm duration-200 motion-reduce:animate-none'
    >
      <ExpiryRedirect msRemaining={msRemaining} />
      <p className='min-w-0 truncate'>
        Viewing as <strong className='font-semibold'>{tenantName}</strong> the way they see it.{' '}
        <span className='opacity-80'>
          {adminName}. Viewing only. Ends in {minutes} min.
        </span>
      </p>
      {/* A plain link on purpose: this is a route handler (a full navigation), not a Next page, and it must never be prefetched. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href='/view-as/exit'
        className='bg-secondary text-secondary-foreground hover:bg-secondary/70 focus-visible:ring-ring inline-flex min-h-8 shrink-0 items-center rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none'
      >
        Exit
      </a>
    </div>
  );
}
