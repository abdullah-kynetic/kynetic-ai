'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import type { TenantBillingView } from '@/server/billing';
import * as React from 'react';
import { resnapshotModule, saveBillingProfile, savePlanTier, type BillingResult } from './actions';

const MODULE_LABELS: Record<string, string> = {
  alex_core: 'Alex (speed to lead)',
  quote_followup: 'Quote follow-up',
  after_hours: 'After-hours answering',
  missed_call_textback: 'Missed-call text-back',
  reactivation: 'Reactivation (one-time)',
  opm: 'Operations manager (OPM)',
  followup_bundle: 'Follow-up bundle',
  crm: 'CRM'
};

const TIERS = [
  { value: 'T1', label: 'T1: under $15K average job' },
  { value: 'T2', label: 'T2: $15K to $30K' },
  { value: 'T3', label: 'T3: $30K and up' }
];

const usd = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const net = (cents: number, pct: number) => Math.round((cents * (100 - pct)) / 100);

export function BillingPanel({ view }: { view: TenantBillingView }) {
  const { tenant, profile, lines, unpriced, totals, foundingReference } = view;
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const submit = (fn: () => Promise<BillingResult>) => {
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      setMessage(result.ok ? 'Saved.' : result.message);
    });
  };

  const onPlanTier = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const tier = String(f.get('tier') ?? '');
    submit(() =>
      savePlanTier({
        tenantId: tenant.id,
        plan: f.get('plan') === 'value' ? 'value' : 'founding',
        pricingTier: tier === 'T1' || tier === 'T2' || tier === 'T3' ? tier : null
      })
    );
  };

  const onProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    submit(() =>
      saveBillingProfile({
        tenantId: tenant.id,
        billingStartDate: String(f.get('billingStartDate') ?? ''),
        stripeCustomerId: String(f.get('stripeCustomerId') ?? ''),
        notes: String(f.get('notes') ?? '')
      })
    );
  };

  const onSnapshot = (moduleKey: string, discount?: string) => {
    const pct = discount === undefined || discount === '' ? undefined : Number(discount);
    submit(() =>
      resnapshotModule({
        tenantId: tenant.id,
        moduleKey: moduleKey as Parameters<typeof resnapshotModule>[0]['moduleKey'],
        discountPct: pct
      })
    );
  };

  return (
    <div className='space-y-8'>
      <p role='status' aria-live='polite' className='min-h-5 text-sm'>
        {message}
      </p>

      <section aria-labelledby='plan-heading'>
        <h2 id='plan-heading' className='mb-3 text-base font-semibold'>
          Plan and tier
        </h2>
        <form onSubmit={onPlanTier} className='grid max-w-xl gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='plan'>Plan</Label>
            <NativeSelect id='plan' name='plan' defaultValue={tenant.plan}>
              <NativeSelectOption value='founding'>Founding</NativeSelectOption>
              <NativeSelectOption value='value'>Value</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='tier'>Value tier</Label>
            <NativeSelect id='tier' name='tier' defaultValue={tenant.pricingTier ?? ''}>
              <NativeSelectOption value=''>Not set</NativeSelectOption>
              {TIERS.map((t) => (
                <NativeSelectOption key={t.value} value={t.value}>
                  {t.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className='sm:col-span-2'>
            <Button type='submit' disabled={pending}>
              Save plan and tier
            </Button>
            <p className='text-muted-foreground mt-2 text-sm'>
              A new tier prices modules switched on, or re-snapshotted, afterwards. Saved prices do
              not change.
            </p>
          </div>
        </form>
        {foundingReference ? (
          <p className='text-muted-foreground mt-3 text-sm'>Founding terms: {foundingReference}</p>
        ) : null}
      </section>

      <section aria-labelledby='prices-heading'>
        <h2 id='prices-heading' className='mb-3 text-base font-semibold'>
          Agreed prices by module
        </h2>
        {lines.length === 0 && unpriced.length === 0 ? (
          <p className='text-muted-foreground text-sm'>No paid modules are switched on.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead className='text-right'>Setup</TableHead>
                <TableHead className='text-right'>Monthly</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Saved</TableHead>
                <TableHead>
                  <span className='sr-only'>Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.moduleKey}>
                  <TableCell>
                    {MODULE_LABELS[l.moduleKey] ?? l.moduleKey}
                    {l.level ? ` (${l.level})` : ''}
                  </TableCell>
                  <TableCell className='text-right'>
                    {usd(net(l.setupCents, l.discountPct))}
                  </TableCell>
                  <TableCell className='text-right'>
                    {usd(net(l.monthlyCents, l.discountPct))}
                  </TableCell>
                  <TableCell>
                    <form
                      className='flex items-center gap-2'
                      onSubmit={(e) => {
                        e.preventDefault();
                        onSnapshot(
                          l.moduleKey,
                          String(new FormData(e.currentTarget).get('discount'))
                        );
                      }}
                    >
                      <Label htmlFor={`discount-${l.moduleKey}`} className='sr-only'>
                        Discount percent for {MODULE_LABELS[l.moduleKey] ?? l.moduleKey}
                      </Label>
                      <Input
                        id={`discount-${l.moduleKey}`}
                        name='discount'
                        type='number'
                        min={0}
                        max={100}
                        step={1}
                        defaultValue={l.discountPct}
                        className='w-20'
                      />
                      <span aria-hidden='true'>%</span>
                      <Button type='submit' variant='outline' size='sm' disabled={pending}>
                        Apply
                      </Button>
                    </form>
                  </TableCell>
                  <TableCell>{new Date(l.snapshotAt).toLocaleDateString('en-US')}</TableCell>
                  <TableCell />
                </TableRow>
              ))}
              {unpriced.map((k) => (
                <TableRow key={k}>
                  <TableCell>{MODULE_LABELS[k] ?? k}</TableCell>
                  <TableCell colSpan={3} className='text-muted-foreground'>
                    No price saved. Set the tier, then record it.
                  </TableCell>
                  <TableCell />
                  <TableCell>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={pending}
                      onClick={() => onSnapshot(k)}
                    >
                      Record price
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className='font-medium'>Total</TableCell>
                <TableCell className='text-right font-medium'>{usd(totals.setupCents)}</TableCell>
                <TableCell className='text-right font-medium'>{usd(totals.monthlyCents)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableBody>
          </Table>
        )}
      </section>

      <section aria-labelledby='profile-heading'>
        <h2 id='profile-heading' className='mb-3 text-base font-semibold'>
          Billing profile
        </h2>
        <form onSubmit={onProfile} className='grid max-w-xl gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='billingStartDate'>Billing start date</Label>
            <Input
              id='billingStartDate'
              name='billingStartDate'
              type='date'
              defaultValue={profile.billingStartDate ?? ''}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='stripeCustomerId'>Stripe customer id</Label>
            <Input
              id='stripeCustomerId'
              name='stripeCustomerId'
              maxLength={100}
              defaultValue={profile.stripeCustomerId ?? ''}
              placeholder='cus_...'
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='notes'>Invoice schedule notes</Label>
            <Textarea id='notes' name='notes' rows={4} defaultValue={profile.notes ?? ''} />
          </div>
          <div>
            <Button type='submit' disabled={pending}>
              Save billing profile
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
