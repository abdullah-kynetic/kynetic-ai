import { cn } from '@/lib/utils';
import { NOTE_CONTENT_CLASS } from './note-styles';

/**
 * The one place note HTML is rendered with dangerouslySetInnerHTML (SECURITY section 5, XSS).
 * `html` must come from the notes service, which sanitizes on save and again on read; never pass
 * anything else here.
 */
export function NoteBody({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn(NOTE_CONTENT_CLASS, className)}
      // eslint-disable-next-line react/no-danger -- sanitized by the notes service (see above)
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
