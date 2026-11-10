import type { SupportMessage, SupportStatus } from '@/server/support';

const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' } as const;
const SIDE_LABEL = { client: 'You', kynetic: 'Kynetic' } as const;

export function statusLabel(status: SupportStatus) {
  return STATUS_LABEL[status];
}

export function SupportTranscript({
  body,
  messages,
  viewer
}: {
  body: string;
  messages: SupportMessage[];
  viewer: 'client' | 'kynetic';
}) {
  return (
    <ol className='grid gap-3'>
      <li className='rounded border p-3'>
        <p className='text-sm font-medium'>{viewer === 'client' ? 'You' : 'Client'}</p>
        <p className='mt-1 whitespace-pre-wrap text-sm'>{body}</p>
      </li>
      {messages.length === 0 ? (
        <li className='text-muted-foreground text-sm'>No replies yet.</li>
      ) : (
        messages.map((message) => (
          <li key={message.id} className='rounded border p-3'>
            <p className='text-sm font-medium'>
              {viewer === 'kynetic' && message.authorSide === 'client'
                ? 'Client'
                : viewer === 'kynetic' && message.authorSide === 'kynetic'
                  ? 'Kynetic'
                  : SIDE_LABEL[message.authorSide]}
            </p>
            <p className='mt-1 whitespace-pre-wrap text-sm'>{message.body}</p>
            <p className='text-muted-foreground mt-2 text-xs'>
              {new Date(message.createdAt).toLocaleString()}
            </p>
          </li>
        ))
      )}
    </ol>
  );
}
