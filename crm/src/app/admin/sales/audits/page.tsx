import Link from 'next/link';
export default function FreeAuditsPage() {
  return (
    <section className='bg-card space-y-3 rounded-xl border p-6'>
      <h2 className='text-lg font-medium'>Free audits</h2>
      <p className='text-muted-foreground text-sm'>
        Prepare an audit from a qualified prospect before sending a proposal.
      </p>
      <Link href='/admin/prospecting/fully-enriched' className='text-primary text-sm underline'>
        Choose a qualified prospect
      </Link>
    </section>
  );
}
