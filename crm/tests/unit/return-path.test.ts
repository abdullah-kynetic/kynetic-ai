import { describe, expect, it } from 'vitest';
import { isHtmlNavigation, safeNextPath } from '@/lib/return-path';

describe('safeNextPath', () => {
  it('keeps an admin page and its query', () => {
    expect(safeNextPath('/admin/users?q=ada%40example.test')).toBe(
      '/admin/users?q=ada%40example.test'
    );
    expect(safeNextPath('/admin')).toBe('/admin');
    expect(safeNextPath('/admin/agency')).toBe('/admin/agency');
  });

  it('rejects off-site and protocol-relative targets', () => {
    expect(safeNextPath('https://evil.example/admin')).toBeNull();
    expect(safeNextPath('//evil.example/admin')).toBeNull();
    expect(safeNextPath('/\\evil.example')).toBeNull();
    expect(safeNextPath('')).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});

describe('isHtmlNavigation', () => {
  it('treats a browser document load as navigation', () => {
    expect(
      isHtmlNavigation({
        method: 'GET',
        accept: 'text/html,application/xhtml+xml',
        fetchDest: 'document'
      })
    ).toBe(true);
  });

  it('keeps API and fetch calls off the redirect path', () => {
    expect(isHtmlNavigation({ method: 'GET', accept: '*/*', fetchDest: null })).toBe(false);
    expect(
      isHtmlNavigation({
        method: 'GET',
        accept: 'application/json',
        fetchDest: 'empty'
      })
    ).toBe(false);
    expect(
      isHtmlNavigation({
        method: 'POST',
        accept: 'text/html',
        fetchDest: 'document'
      })
    ).toBe(false);
  });
});
