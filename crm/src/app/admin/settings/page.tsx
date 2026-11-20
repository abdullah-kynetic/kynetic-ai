import Link from 'next/link';
import { adminAreas } from '@/config/area-nav';

export default function AdminSettingsPage() {
  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      {adminAreas[5]!.tabs.slice(1).map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className='bg-card rounded-xl border p-5 hover:border-primary'
        >
          <h2 className='font-medium'>{tab.label}</h2>
          <p className='text-muted-foreground mt-1 text-sm'>
            Manage {tab.label.toLowerCase()} tools.
          </p>
        </Link>
      ))}
    </div>
  );
}
