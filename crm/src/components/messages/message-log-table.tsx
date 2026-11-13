import { StatusBadge, type StatusTone } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import type { MessageLogRow, MessageStatus } from '@/server/messaging/log';

const STATUS: Record<MessageStatus, { label: string; tone: StatusTone }> = {
  queued: { label: 'Queued', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'success' },
  failed: { label: 'Failed', tone: 'error' },
  bounced: { label: 'Bounced', tone: 'error' },
  complained: { label: 'Marked as spam', tone: 'warning' },
  received: { label: 'Received', tone: 'neutral' }
};

const when = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export function MessageLogTable({ rows }: { rows: MessageLogRow[] }) {
  return (
    <Table scrollLabel='Messages'>
      <caption className='sr-only'>Messages, newest first</caption>
      <TableHeader>
        <TableRow>
          <TableHead scope='col'>When</TableHead>
          <TableHead scope='col'>Contact</TableHead>
          <TableHead scope='col'>Channel</TableHead>
          <TableHead scope='col'>Message</TableHead>
          <TableHead scope='col'>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const inbound = r.direction === 'inbound';
          const status = STATUS[r.status];
          return (
            <TableRow key={r.id}>
              <TableCell className='whitespace-nowrap'>
                <time dateTime={r.createdAt}>{when.format(new Date(r.createdAt))}</time>
              </TableCell>
              <TableCell>
                <div className='font-medium'>{r.contactName ?? 'Unknown contact'}</div>
                <div className='text-muted-foreground text-xs'>
                  {inbound ? `From ${r.fromAddress}` : `To ${r.toAddress}`}
                </div>
              </TableCell>
              <TableCell>
                {r.channel === 'sms' ? 'Text' : 'Email'}, {inbound ? 'received' : 'sent'}
              </TableCell>
              <TableCell className='max-w-md'>
                {r.subject && <div className='font-medium'>{r.subject}</div>}
                <div className='text-muted-foreground truncate'>{r.preview}</div>
              </TableCell>
              <TableCell>
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                {r.errorSummary && (
                  <div className='text-destructive mt-1 text-xs'>{r.errorSummary}</div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
