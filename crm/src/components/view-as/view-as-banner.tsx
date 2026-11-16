import { exitViewAsAction } from '@/app/view-as/actions';
import { Button } from '@/components/ui/button';
import { WriteModeControl } from './write-mode-control';

export const VIEW_AS_BANNER_HEIGHT = '2.75rem';

/**
 * The view-as banner (F-57, DESIGN_SYSTEM shell chrome): full width, sticky, amber (attention) tokens,
 * never tenant-colored and never dismissible. It sits above the top bar; the layout sets
 * `--view-as-h` so the sidebar and header start below it.
 */
export function ViewAsBanner({
  tenantName,
  adminName,
  readOnly,
  writeUntil,
  canWrite
}: {
  tenantName: string;
  adminName: string;
  readOnly: boolean;
  writeUntil: string | null;
  /** Only a Kynetic admin can switch to write mode (SECURITY 2.6). */
  canWrite: boolean;
}) {
  return (
    <div
      role='region'
      aria-label='View as client'
      className='sticky top-0 z-50 flex h-(--view-as-h) items-center justify-between gap-3 border-attention/30 bg-attention-soft text-attention animate-in slide-in-from-top-2 fade-in-0 border-b px-4 text-sm duration-200 motion-reduce:animate-none'
    >
      <p className='min-w-0 truncate'>
        Viewing as <strong className='font-semibold'>{tenantName}</strong> the way they see it.{' '}
        <span className='opacity-80'>
          {adminName}. {readOnly ? 'Read-only.' : 'Write mode on.'}
        </span>
      </p>
      <div className='flex shrink-0 items-center gap-3'>
        {canWrite && <WriteModeControl writeUntil={readOnly ? null : writeUntil} />}
        <form action={exitViewAsAction}>
          <Button type='submit' size='sm' variant='secondary'>
            Exit
          </Button>
        </form>
      </div>
    </div>
  );
}
