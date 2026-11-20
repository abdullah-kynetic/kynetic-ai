import Link from 'next/link';
export default function InvoicesPage() {
  return (
    <section className='bg-card space-y-3 rounded-xl border p-6'>
      <h2 className='text-lg font-semibold'>Invoices</h2>
      <p className='text-muted-foreground text-sm'>
        Invoice drafts are prepared alongside billing. Review the billing workspace to create or
        manage them.
      </p>
      <Link href='/admin/money/billing' className='text-primary text-sm underline'>
        Open billing
      </Link>
    </section>
  );
}
