import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { adminAreas, clientAreas } from '@/config/area-nav';
import nextConfig from '../../next.config';

describe('area navigation', () => {
  it('keeps each role at four to six top-level destinations', () => {
    expect(adminAreas).toHaveLength(6);
    expect(clientAreas).toHaveLength(6);
    expect(new Set(adminAreas.map((area) => area.href)).size).toBe(adminAreas.length);
    expect(new Set(clientAreas.map((area) => area.href)).size).toBe(clientAreas.length);
  });

  it('has a page for every area and sub-tab route', () => {
    for (const area of [...adminAreas, ...clientAreas]) {
      for (const href of [area.href, ...area.tabs.map((tab) => tab.href)]) {
        expect(existsSync(resolve(process.cwd(), `src/app${href}/page.tsx`)), href).toBe(true);
      }
    }
  });

  it('moves legacy entry routes with HTTP 301', async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toBeDefined();
    for (const source of [
      '/admin/agency',
      '/admin/agency/finance',
      '/dashboard/contacts',
      '/dashboard/reviews'
    ]) {
      expect(redirects).toContainEqual(expect.objectContaining({ source, statusCode: 301 }));
    }
  });
});
