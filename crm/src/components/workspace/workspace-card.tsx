import { initials } from '@/lib/workspaces';
import { cn } from '@/lib/utils';

/** Square logo or initials tile. A client logo sits on white so any artwork stays legible. */
export function WorkspaceTile({
  name,
  logoUrl,
  className
}: {
  name: string;
  logoUrl?: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md text-xs font-semibold',
        logoUrl && 'bg-card ring-border ring-1',
        className
      )}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- tenant logo, arbitrary origin
        <img src={logoUrl} alt='' className='size-full object-contain p-0.5' />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/** Name and muted second line. Truncates; the full name is in the title. */
export function WorkspaceText({ name, detail }: { name: string; detail: string }) {
  return (
    <span className='flex min-w-0 flex-1 flex-col text-left leading-tight group-data-[collapsible=icon]:hidden'>
      <span className='truncate text-sm font-semibold' title={name}>
        {name}
      </span>
      <span className='text-muted-foreground truncate text-xs' title={detail}>
        {detail}
      </span>
    </span>
  );
}

/** The client user's card: not a button, no chevron, nothing to switch to. */
export function StaticWorkspaceCard({
  name,
  detail,
  logoUrl
}: {
  name: string;
  detail: string;
  logoUrl?: string | null;
}) {
  return (
    <div
      data-slot='workspace-card'
      className='bg-card border-border flex items-center gap-2.5 rounded-lg border p-2.5 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0'
    >
      <WorkspaceTile name={name} logoUrl={logoUrl} />
      <WorkspaceText name={name} detail={detail} />
    </div>
  );
}
