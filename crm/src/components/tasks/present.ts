import { instantToLocal, type TaskRow } from '@/server/tasks';

// Server-side formatting for task rows, in the tenant's zone so the server render and the browser
// agree and the form's datetime-local value round-trips.

export function presentTasks(rows: TaskRow[], timeZone: string, at: Date, overdue = false) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
  const dueLocal: Record<string, string> = {};
  const dueText: Record<string, string> = {};
  for (const t of rows) {
    if (!t.dueAt) {
      dueText[t.id] = 'No due date';
      continue;
    }
    dueLocal[t.id] = instantToLocal(t.dueAt, timeZone);
    const when = fmt.format(new Date(t.dueAt));
    dueText[t.id] = overdue || new Date(t.dueAt) < at ? `Overdue: ${when}` : `Due ${when}`;
  }
  return { dueLocal, dueText };
}
