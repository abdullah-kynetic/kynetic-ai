import { describe, expect, it } from 'vitest';
import { brandingCss, checkPrimaryColor, contrast, deriveBranding } from '@/lib/branding/color';

describe('F-39 tenant color rules', () => {
  const edge: [string, boolean][] = [
    ['#ffffff', false],
    ['#000000', false],
    ['#ffd700', false],
    ['#fff3b0', false],
    ['#d9662a', true],
    ['#b3261e', false],
    ['#1e7a46', false],
    ['#2563eb', true],
    ['#e0483e', true]
  ];
  it.each(edge)('%s ok=%s', (hex, ok) => {
    expect(checkPrimaryColor(hex)?.ok).toBe(ok);
  });

  it('suggests a passing color for a rejected one', () => {
    const c = checkPrimaryColor('#ffd700')!;
    expect(c.suggestion).toMatch(/^#[0-9a-f]{6}$/);
    expect(checkPrimaryColor(c.suggestion!)?.ok).toBe(true);
  });

  it('rejects non-hex input', () => {
    expect(checkPrimaryColor('red')).toBeNull();
  });

  it('warns near error red and success green without blocking', () => {
    expect(checkPrimaryColor('#b3261e')?.warning).toMatch(/error red/);
    expect(checkPrimaryColor('#1e7a46')?.warning).toMatch(/success green/);
    expect(checkPrimaryColor('#e0483e')?.warning).toMatch(/error red/);
    expect(checkPrimaryColor('#2563eb')?.warning).toBeUndefined();
  });

  it.each(edge.filter(([, ok]) => ok).map(([h]) => h))(
    'derived values for %s meet 4.5:1',
    (hex) => {
      const { light, dark } = deriveBranding(hex);
      expect(contrast(light.primary, light.onPrimary)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(light.hover, light.onPrimary)).toBeGreaterThanOrEqual(4.5);
      for (const bg of ['#ffffff', '#faf8f5', '#f2eee8'])
        expect(contrast(light.text, bg)).toBeGreaterThanOrEqual(4.5);
      for (const bg of ['#26211c', '#1c1916'])
        expect(contrast(dark.text, bg)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it('Kynetic orange keeps the dark label', () => {
    expect(deriveBranding('#d9662a').light.onPrimary).toBe('#0e0d0b');
  });

  it('css carries only derived hex values', () => {
    expect(brandingCss('#2563eb')).toMatch(
      /^html\[data-theme='kynetic'\]\{[^<>]*\}html\[data-theme='kynetic'\]\.dark\{[^<>]*\}$/
    );
  });
});
