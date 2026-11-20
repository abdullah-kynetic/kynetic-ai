import Link from 'next/link';

export function ProspectingStage({ title, description }: { title: string; description: string }) {
  return (
    <section className='bg-card space-y-3 rounded-xl border p-6'>
      <h2 className='text-lg font-semibold'>{title}</h2>
      <p className='text-muted-foreground text-sm'>{description}</p>
      <Link
        href='/admin/prospecting'
        className='inline-flex min-h-11 items-center text-sm underline'
      >
        Open prospecting overview
      </Link>
    </section>
  );
}
