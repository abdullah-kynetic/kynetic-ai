import { describe, expect, it } from 'vitest';
import { mentionedIds, noteText, sanitizeNoteHtml } from '@/server/notes/sanitize';

const ID = 'aaaaaaa2-0000-4000-8000-000000000002';

describe('sanitizeNoteHtml (F-22: note HTML is sanitized on save)', () => {
  it('strips script tags, event handlers, iframes and style', () => {
    const dirty =
      '<p onclick="x()">Hi<script>alert(1)</script><iframe src="https://evil.test"></iframe>' +
      '<img src=x onerror=alert(1)><style>p{display:none}</style></p>';
    const clean = sanitizeNoteHtml(dirty);
    expect(clean).toBe('<p>Hi</p>');
  });

  it('keeps basic formatting and lists', () => {
    const html =
      '<p><strong>a</strong> <em>b</em> <u>c</u> <s>d</s></p><ul><li>x</li></ul><ol><li>y</li></ol>';
    expect(sanitizeNoteHtml(html)).toBe(html);
  });

  it('drops javascript: and data: links, keeps https with a safe rel', () => {
    const bad = sanitizeNoteHtml(
      '<a href="javascript:alert(1)">x</a><a href="data:text/html,hi">y</a>'
    );
    expect(bad).not.toContain('javascript:');
    expect(bad).not.toContain('data:');
    const good = sanitizeNoteHtml(
      '<a href="https://example.test/a" onmouseover="x()" rel="opener">ok</a>'
    );
    expect(good).toBe(
      '<a href="https://example.test/a" rel="noopener noreferrer" target="_blank">ok</a>'
    );
  });

  it('removes inline style and unknown classes', () => {
    expect(sanitizeNoteHtml('<p style="color:red" class="x">hi</p>')).toBe('<p>hi</p>');
  });

  it('keeps a well-formed mention span and rewrites it to a fixed shape', () => {
    const out = sanitizeNoteHtml(
      `<span data-mention="${ID}" class="mention evil" style="x:y">@Sam</span>`
    );
    expect(out).toBe(`<span class="mention" data-mention="${ID}">@Sam</span>`);
    expect(mentionedIds(out)).toEqual([ID]);
  });

  it('unwraps a malformed mention id and one outside the allowed set', () => {
    expect(sanitizeNoteHtml('<span data-mention="not-a-uuid">@X</span>')).toBe('@X');
    expect(sanitizeNoteHtml(`<span data-mention="${ID}">@Sam</span>`, new Set())).toBe('@Sam');
    expect(sanitizeNoteHtml(`<span data-mention="${ID}">@Sam</span>`, new Set([ID]))).toContain(
      'data-mention'
    );
  });

  it('survives nested and unbalanced mention spans without leaving stray tags', () => {
    const out = sanitizeNoteHtml(
      `<span data-mention="${ID}"><span data-mention="x">a</span></span></span>`
    );
    expect(out).toBe(`<span class="mention" data-mention="${ID}">a</span>`);
  });
});

describe('noteText', () => {
  it('returns plain text with entities decoded and blocks separated', () => {
    expect(noteText('<p>Tom &amp; Jerry</p><ul><li>one</li><li>two</li></ul>')).toBe(
      'Tom & Jerry one two'
    );
  });
});
