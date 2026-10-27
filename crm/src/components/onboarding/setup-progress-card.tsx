import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { SetupProgress } from '@/server/admin/checklist';

const STATE = {
  done: { label: 'Done', variant: 'success' },
  doing: { label: 'In progress', variant: 'info' },
  waiting: { label: 'Waiting', variant: 'neutral' }
} as const;

/** The owner's read-only "Setup progress" card until go-live (F-100). No owner, dates or notes. */
export function SetupProgressCard({ progress }: { progress: SetupProgress }) {
  return (
    <Card aria-labelledby='setup-progress-title'>
      <CardHeader>
        <CardTitle id='setup-progress-title'>Setup progress</CardTitle>
        <CardDescription>
          {progress.done} of {progress.total} steps done. We are getting your account ready.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className='grid gap-2'>
          {progress.steps.map((s) => (
            <li key={s.title} className='flex items-center justify-between gap-3 text-sm'>
              <span>{s.title}</span>
              <Badge variant={STATE[s.state].variant}>{STATE[s.state].label}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
