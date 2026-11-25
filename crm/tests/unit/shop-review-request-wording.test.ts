import { describe, expect, it } from 'vitest';
import { reviewMessage } from '@/server/reviews';

// E-3: every customer gets the Google link. The request function takes only a name, the business and
// the link, so nothing about a rating or mood can change who is asked or what they are sent.
describe('E-3 review request wording', () => {
  it('takes no rating or sentiment input', () => {
    expect(reviewMessage.length).toBe(3);
  });
  it('always carries the link, for any customer', () => {
    for (const name of ['Ana', 'Zed', 'Mary-Jane']) {
      const text = reviewMessage(name, 'AA Auto Body', 'https://g.page/r/example');
      expect(text).toContain('https://g.page/r/example');
      expect(text).toContain(`Hi ${name},`);
    }
  });
  it('does not mention stars or ratings', () => {
    const text = reviewMessage('Ana', 'AA Auto Body', 'https://g.page/r/example').toLowerCase();
    expect(text).not.toMatch(/star|rating|rate us|happy|satisf/);
  });
});
