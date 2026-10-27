import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { MESSAGE_STATUSES, type MessageLogQuery } from '@/server/messaging/log';

const STATUS_LABELS: Record<(typeof MESSAGE_STATUSES)[number], string> = {
  queued: 'Queued',
  sent: 'Sent',
  delivered: 'Delivered',
  failed: 'Failed',
  bounced: 'Bounced',
  complained: 'Marked as spam',
  received: 'Received'
};

// A plain GET form: the filters live in the URL, so they survive a refresh and work without scripts.
export function MessageLogFilters({
  channel,
  status
}: Pick<MessageLogQuery, 'channel' | 'status'>) {
  return (
    <form method='get' className='mb-4 flex flex-wrap items-end gap-3' aria-label='Filter messages'>
      <div className='flex flex-col gap-1 text-sm font-medium'>
        <label htmlFor='messages-channel'>Channel</label>
        <NativeSelect id='messages-channel' name='channel' defaultValue={channel ?? ''}>
          <option value=''>All</option>
          <option value='sms'>Text</option>
          <option value='email'>Email</option>
        </NativeSelect>
      </div>
      <div className='flex flex-col gap-1 text-sm font-medium'>
        <label htmlFor='messages-status'>Status</label>
        <NativeSelect id='messages-status' name='status' defaultValue={status ?? ''}>
          <option value=''>All</option>
          {MESSAGE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button type='submit' variant='outline'>
        Apply
      </Button>
    </form>
  );
}
