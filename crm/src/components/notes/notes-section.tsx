import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import type { NoteView } from '@/server/notes';
import { NoteComposer } from './note-composer';
import { NoteItem, type NoteItemData } from './note-item';
import type { Teammate } from './note-editor';

type Result = { error?: string };

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC'
  });

/** Notes card for a contact, company or deal (F-22, CRM Lite). The page passes bound server actions. */
export function NotesSection({
  notes,
  teammates,
  viewer,
  actions
}: {
  notes: NoteView[];
  teammates: Teammate[];
  viewer: { id: string; role: string };
  actions: {
    add: (html: string) => Promise<Result>;
    edit: (id: string, html: string) => Promise<Result>;
    pin: (id: string, pinned: boolean) => Promise<Result>;
    remove: (id: string) => Promise<Result>;
  };
}) {
  const items: NoteItemData[] = notes.map((n) => ({
    id: n.id,
    html: n.html,
    pinned: n.pinned,
    authorName: n.author?.name ?? null,
    createdLabel: when(n.createdAt),
    edited: n.updatedAt !== n.createdAt,
    canEdit: n.author?.id === viewer.id || viewer.role === 'owner' || viewer.role === 'admin'
  }));
  return (
    <Card id='notes' aria-labelledby='section-Notes'>
      <CardHeader>
        <CardTitle id='section-Notes'>Notes</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        <NoteComposer teammates={teammates} save={actions.add} />
        {items.length ? (
          <ul className='flex flex-col gap-3'>
            {items.map((n) => (
              <NoteItem
                key={n.id}
                note={n}
                teammates={teammates}
                pin={actions.pin}
                edit={actions.edit}
                remove={actions.remove}
              />
            ))}
          </ul>
        ) : (
          <EmptyState title='No notes' description='Notes about this contact will show here.' />
        )}
      </CardContent>
    </Card>
  );
}
