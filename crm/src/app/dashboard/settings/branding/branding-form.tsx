'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  checkPrimaryColor,
  deriveBranding,
  KYNETIC_ORANGE,
  normalizeHex
} from '@/lib/branding/color';
import { useState, useTransition } from 'react';
import { useTheme } from 'next-themes';
import { saveBrandingAction, type BrandingResult } from './actions';

type Initial = { name: string; primaryColor: string; logoUrl: string | null };

export function BrandingForm({ initial }: { initial: Initial }) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.primaryColor);
  const [result, setResult] = useState<BrandingResult | null>(null);
  const [pending, start] = useTransition();
  const { resolvedTheme } = useTheme();

  const hex = normalizeHex(color);
  const check = hex ? checkPrimaryColor(hex) : null;
  const branding = deriveBranding(check?.ok && hex ? hex : KYNETIC_ORANGE);
  const preview = resolvedTheme === 'dark' ? branding.dark : branding.light;
  const live =
    color && !check
      ? 'Enter the color as #rrggbb.'
      : check && !check.ok
        ? `Too ${check.ratios.light < 3 ? 'light' : 'dark'} for buttons (${Math.min(check.ratios.light, check.ratios.dark).toFixed(2)}:1, needs 3:1).`
        : null;
  const suggestion = check && !check.ok ? check.suggestion : undefined;

  return (
    <form
      className='flex max-w-xl flex-col gap-6'
      action={(fd) => start(async () => setResult(await saveBrandingAction(fd)))}
    >
      <div className='flex flex-col gap-2'>
        <Label htmlFor='name'>Business name</Label>
        <Input
          id='name'
          name='name'
          value={name}
          maxLength={80}
          required
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className='flex flex-col gap-2'>
        <Label htmlFor='primaryColor'>Primary color</Label>
        <div className='flex items-center gap-3'>
          <input
            type='color'
            aria-label='Pick a primary color'
            value={hex ?? KYNETIC_ORANGE}
            onChange={(e) => setColor(e.target.value)}
            className='h-9 w-12 cursor-pointer rounded-md border p-1'
          />
          <Input
            id='primaryColor'
            name='primaryColor'
            value={color}
            placeholder='#d9662a'
            className='w-32 font-mono'
            aria-invalid={Boolean(live)}
            aria-describedby='color-help'
            onChange={(e) => setColor(e.target.value)}
          />
        </div>
        <p
          id='color-help'
          role={live ? 'alert' : undefined}
          className={live ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'}
        >
          {live ?? 'Leave empty to use the Kynetic color.'}{' '}
          {suggestion && (
            <button type='button' className='underline' onClick={() => setColor(suggestion)}>
              Use {suggestion}?
            </button>
          )}
        </p>
        {check?.ok && check.warning && <p className='text-warning text-sm'>{check.warning}</p>}
        <div className='flex items-center gap-3 pt-1' aria-label='Preview'>
          <span
            className='rounded-md px-3 py-1.5 text-sm font-medium'
            style={{ background: preview.primary, color: preview.onPrimary }}
          >
            Sample button
          </span>
          <span className='text-sm font-medium' style={{ color: preview.text }}>
            Sample link
          </span>
        </div>
      </div>

      <div className='flex flex-col gap-2'>
        <Label htmlFor='logo'>Logo</Label>
        {initial.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- same-origin, authenticated route
          <img
            src={initial.logoUrl}
            alt='Current logo'
            className='h-10 w-auto self-start rounded-md border bg-white p-1'
          />
        )}
        <Input id='logo' name='logo' type='file' accept='image/png,image/jpeg,image/webp' />
        <p className='text-muted-foreground text-sm'>
          PNG, JPEG or WebP, up to 1 MB. Transparent PNG works best.
        </p>
        {initial.logoUrl && (
          <label className='flex items-center gap-2 text-sm'>
            <input type='checkbox' name='removeLogo' /> Remove the current logo
          </label>
        )}
      </div>

      {result && (
        <p
          role={result.ok ? 'status' : 'alert'}
          className={result.ok ? 'text-success text-sm' : 'text-destructive text-sm'}
        >
          {result.ok ? 'Branding saved.' : result.message}
        </p>
      )}
      <Button type='submit' disabled={pending || Boolean(live)} className='self-start'>
        {pending ? 'Saving…' : 'Save branding'}
      </Button>
    </form>
  );
}
