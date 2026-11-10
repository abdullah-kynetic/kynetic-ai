import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { contactsActorScope } from '@/server/contacts';
import { SYSTEM_CATALOG } from '@/server/modules/catalog';
import { loadEnabledModules } from '@/server/modules';
import { MODULE_KEYS, moduleSatisfied } from '@/server/modules/keys';
import { listOwnSystemRequests } from '@/server/systems/requests';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { requestSystemAction } from './actions';

export const metadata: Metadata = { title: 'My systems' };
export const dynamic = 'force-dynamic';

export default async function MySystemsPage({
  searchParams
}: {
  searchParams: Promise<{ requested?: string; error?: string }>;
}) {
  const scope = await contactsActorScope(await headers());
  if (!scope)
    return (
      <PageContainer pageTitle='My systems' access={false}>
        {null}
      </PageContainer>
    );
  const query = await searchParams;
  const [enabled, requests] = await Promise.all([
    loadEnabledModules(scope.ctx),
    listOwnSystemRequests(scope.ctx, scope.actor)
  ]);
  const requested = new Set(requests.map((row) => row.moduleKey));
  const cards = MODULE_KEYS.map((key) => {
    const included =
      key === 'missed_call_textback' &&
      !enabled.keys.has('missed_call_textback') &&
      moduleSatisfied(enabled, { module: key });
    const on = key === 'platform' || (!included && moduleSatisfied(enabled, { module: key }));
    return { key, included, on, asked: requested.has(key) };
  });

  return (
    <PageContainer
      pageTitle='My systems'
      pageDescription='What is running for your business, and what you can ask Kynetic to turn on.'
    >
      {query.requested && (
        <p role='status' className='mb-4 rounded border p-3 text-sm'>
          Request sent. Kynetic can see it. There is nothing to pay here.
        </p>
      )}
      {query.error && (
        <p role='alert' className='text-destructive mb-4 text-sm'>
          {query.error === 'on' ? 'That system is already on.' : 'That request could not be saved.'}
        </p>
      )}
      <ul className='grid gap-4 lg:grid-cols-2'>
        {cards.map((card) => {
          const catalog = SYSTEM_CATALOG[card.key];
          const status = card.on ? 'On' : card.included ? 'Included' : 'Available';
          return (
            <li key={card.key} className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
              <div className='flex items-start justify-between gap-3'>
                <h2 className='font-medium'>{catalog.label}</h2>
                <span className='text-muted-foreground text-sm'>{status}</span>
              </div>
              <p className='mt-2 text-sm'>{catalog.outcome}</p>
              {card.included && (
                <p className='text-muted-foreground mt-2 text-sm'>
                  Included with after-hours answering.
                </p>
              )}
              {!card.on && !card.included && card.key !== 'platform' && (
                <div className='mt-4'>
                  {card.asked ? (
                    <Button type='button' disabled className='min-h-11'>
                      Requested
                    </Button>
                  ) : (
                    <form action={requestSystemAction}>
                      <input type='hidden' name='moduleKey' value={card.key} />
                      <Button type='submit' className='min-h-11'>
                        Request this
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </PageContainer>
  );
}
