import { IconFlask } from '@tabler/icons-react';

/** Shown on every shop page while any sample row is present. It never shows without one. */
export function DemoDataBanner() {
  return (
    <div
      role='note'
      aria-label='Demo data'
      data-testid='demo-data-banner'
      className='bg-attention-soft text-attention flex items-start gap-2.5 rounded-[var(--radius-card)] border px-4 py-3 text-sm'
    >
      <IconFlask aria-hidden className='mt-0.5 size-4 shrink-0' />
      <p>
        <strong className='font-medium'>Demo data.</strong> The cars, customers and numbers here are
        samples. They go away in one step once the shop&apos;s own records are in.
      </p>
    </div>
  );
}
