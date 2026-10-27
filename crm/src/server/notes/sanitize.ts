import sanitizeHtml from 'sanitize-html';

// Note HTML allowlist (SECURITY section 5, XSS; PRD F-22): basic formatting, lists, links with
// rel="noopener noreferrer" and mention spans. Scripts, event handlers, iframes, javascript: URLs
// and CSS are stripped. It runs on save and again on render, so a row written by any other path
// is still safe to show.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MENTION = /<span[^>]*\sdata-mention="([^"]+)"/g;

const TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'a', 'span'];

/**
 * `mentionable` is the set of user ids a mention may name (the tenant's members). A mention span
 * for any other id, or with a malformed id, is kept as its plain text. Omit it to keep every
 * well-formed mention (the first pass, which collects the ids to look up).
 */
export function sanitizeNoteHtml(html: string, mentionable?: ReadonlySet<string>): string {
  return sanitizeHtml(html, {
    allowedTags: TAGS,
    allowedAttributes: {
      a: ['href', 'rel', 'target'],
      span: ['class', 'data-mention']
    },
    allowedClasses: { span: ['mention'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    // Runs before the allowlist check, so renaming a tag to one that is not allowed unwraps it.
    transformTags: {
      a: (tag, attribs) => ({
        tagName: tag,
        attribs: { ...attribs, rel: 'noopener noreferrer', target: '_blank' }
      }),
      span: (_tag, attribs) => {
        const id = attribs['data-mention']?.toLowerCase();
        const ok = id && UUID.test(id) && (!mentionable || mentionable.has(id));
        const kept: Record<string, string> = ok ? { class: 'mention', 'data-mention': id } : {};
        return { tagName: ok ? 'span' : 'x-unwrap', attribs: kept };
      }
    }
  }).trim();
}

/** Ids named by mention spans in already-sanitized HTML, deduplicated. */
export function mentionedIds(sanitized: string): string[] {
  return [...new Set([...sanitized.matchAll(MENTION)].map((m) => m[1]))];
}

/** Plain text for search and excerpts: tags removed, entities decoded, whitespace collapsed. */
export function noteText(sanitized: string): string {
  return sanitizeHtml(sanitized.replace(/<\/(p|li)>|<br\s*\/?>/g, ' '), {
    allowedTags: [],
    allowedAttributes: {},
    textFilter: (t) => t
  })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
