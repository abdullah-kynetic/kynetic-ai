import Link from 'next/link';
import { clientAreas } from '@/config/area-nav';

export default function SettingsIndexPage() {
  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      <Link
        href='/dashboard/settings/business'
        className='bg-card rounded-xl border p-5 hover:border-primary'
      >
        <h2 className='font-semibold'>Business account</h2>
        <p className='text-muted-foreground mt-1 text-sm'>
          Hours, service area and transfer number.
        </p>
      </Link>
      {clientAreas[4]!.tabs.slice(1).map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className='bg-card rounded-xl border p-5 hover:border-primary'
        >
          <h2 className='font-semibold'>{tab.label}</h2>
          <p className='text-muted-foreground mt-1 text-sm'>
            Open {tab.label.toLowerCase()} settings.
          </p>
        </Link>
      ))}
    </div>
  );
}
