import { formatCustomValue, type CustomFieldDef } from '@/server/custom-fields/types';

/**
 * Custom field values for a detail page (F-12): the tenant's own labels, in definition order, with
 * values formatted by type. Fields without a value show a dash. Renders nothing when there are no
 * definitions, so the contact page (M1-03) can place it unconditionally; pass an empty list for a
 * tenant without CRM Full.
 */
export function CustomFieldsSection({
  defs,
  values,
  heading = 'Custom fields'
}: {
  defs: readonly CustomFieldDef[];
  values: Record<string, unknown>;
  heading?: string;
}) {
  if (defs.length === 0) return null;
  return (
    <section aria-labelledby='custom-fields-heading' className='flex flex-col gap-2'>
      <h2 id='custom-fields-heading' className='text-base font-medium'>
        {heading}
      </h2>
      <dl className='grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2'>
        {defs.map((d) => {
          const text = formatCustomValue(d, values[d.key]);
          const numeric = d.type === 'number' || d.type === 'money';
          return (
            <div key={d.id} className='flex flex-col'>
              <dt className='text-muted-foreground text-sm'>{d.label}</dt>
              <dd className={numeric ? 'tabular-nums' : undefined}>
                {text || <span className='text-muted-foreground'>-</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
