'use client';

import { startViewAsAction, type ViewAsActionResult } from '@/app/view-as/actions';
import { Icons } from '@/components/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { filterWorkspaces, moveActive, type Workspace } from '@/lib/workspaces';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { WorkspaceText, WorkspaceTile } from './workspace-card';

const AGENCY_ID = 'agency';
const ROW = 'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none rounded-md';
const ACTION =
  'focus-visible:ring-ring bg-secondary text-secondary-foreground hover:bg-secondary/70 inline-flex min-h-8 items-center rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Admin workspace switcher. The agency workspace is first, then every client. Enter opens the
 * highlighted workspace, Cmd or Ctrl+Enter views it as the client, Escape closes. "View as client"
 * posts to the existing view-as action: the server starts the session, so hiding a button is never
 * the protection (SECURITY 2.6).
 */
export function WorkspaceSwitcher({
  workspaces,
  agencyName = 'Kynetic AI',
  agencyDetail = 'Agency admin'
}: {
  workspaces: Workspace[];
  agencyName?: string;
  agencyDetail?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const listId = React.useId();
  const formRef = React.useRef<HTMLFormElement>(null);
  const viewRefs = React.useRef(new Map<string, HTMLButtonElement>());

  const matches = React.useMemo(() => filterWorkspaces(workspaces, query), [workspaces, query]);
  const showAgency =
    !query.trim() ||
    `${agencyName} ${agencyDetail}`.toLowerCase().includes(query.trim().toLowerCase());
  const rows = React.useMemo(
    () => [
      ...(showAgency
        ? [{ id: AGENCY_ID, name: agencyName, detail: agencyDetail, canView: false }]
        : []),
      ...matches
    ],
    [showAgency, matches, agencyName, agencyDetail]
  );

  const changeQuery = (value: string) => {
    setQuery(value);
    setActive(0);
  };
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery('');
      setActive(0);
      setError(null);
    }
  };
  React.useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, listId]);

  const go = (row: Workspace | undefined) => {
    if (!row) return;
    changeOpen(false);
    router.push(row.id === AGENCY_ID ? '/admin' : `/admin/clients/${row.id}`);
  };
  const view = (row: Workspace | undefined) => {
    if (row && row.id !== AGENCY_ID && row.canView) viewRefs.current.get(row.id)?.click();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => moveActive(a, rows.length, e.key as 'ArrowDown' | 'ArrowUp'));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) view(rows[active]);
      else go(rows[active]);
    }
    // Escape is handled by the popover, which also returns focus to the card.
  };

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = (await startViewAsAction(formData)) as ViewAsActionResult;
      if (result && 'error' in result) setError(result.error);
    });
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger
        data-slot='workspace-card'
        className='bg-card border-border hover:bg-card/70 focus-visible:ring-ring flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0'
      >
        <WorkspaceTile name={agencyName} />
        <WorkspaceText name={agencyName} detail={agencyDetail} />
        <span className='sr-only'>Switch workspace</span>
        <Icons.chevronsUpDown
          aria-hidden
          className='text-muted-foreground size-4 shrink-0 group-data-[collapsible=icon]:hidden'
        />
      </PopoverTrigger>
      <PopoverContent
        align='start'
        sideOffset={6}
        className='w-[28rem] max-w-[calc(100vw-2rem)] gap-0 rounded-xl p-0 shadow-(--shadow-popover) ring-0 duration-150'
      >
        <div className='border-b p-2'>
          <label htmlFor={`${listId}-search`} className='sr-only'>
            Search workspaces
          </label>
          <div className='bg-secondary flex items-center gap-2 rounded-md px-2.5'>
            <Icons.search aria-hidden className='text-muted-foreground size-4 shrink-0' />
            <input
              id={`${listId}-search`}
              role='combobox'
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
              ref={(el) => el?.focus()}
              autoComplete='off'
              placeholder='Search workspaces'
              value={query}
              onChange={(e) => changeQuery(e.target.value)}
              onKeyDown={onKeyDown}
              className='focus-visible:ring-ring placeholder:text-muted-foreground h-9 w-full rounded-md bg-transparent text-sm outline-none focus-visible:ring-2'
            />
          </div>
        </div>
        <form ref={formRef} action={submit}>
          <input type='hidden' name='returnTo' value={pathname} />
          <div
            id={listId}
            role='listbox'
            aria-label='Workspaces'
            className='max-h-80 overflow-y-auto overscroll-contain p-1.5'
          >
            {rows.map((row, i) => {
              const isAgency = row.id === AGENCY_ID;
              return (
                <div key={row.id} role='none' className='flex items-center gap-1'>
                  <div
                    id={`${listId}-${i}`}
                    role='option'
                    aria-selected={i === active}
                    tabIndex={-1}
                    onKeyDown={onKeyDown}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(row)}
                    className={cn(
                      ROW,
                      'flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 p-2',
                      i === active && 'bg-accent ring-ring ring-1'
                    )}
                  >
                    <WorkspaceTile name={row.name} className='size-8' />
                    <span className='flex min-w-0 flex-1 flex-col leading-tight'>
                      <span className='truncate text-sm font-medium'>{row.name}</span>
                      <span className='text-muted-foreground truncate text-xs'>{row.detail}</span>
                    </span>
                  </div>
                  <div className='flex shrink-0 gap-1 pe-1'>
                    {isAgency ? null : (
                      <>
                        <Link
                          href={`/admin/clients/${row.id}`}
                          onClick={() => changeOpen(false)}
                          aria-label={`Open ${row.name}`}
                          className={ACTION}
                        >
                          Open
                        </Link>
                        <button
                          type='submit'
                          name='tenantId'
                          value={row.id}
                          disabled={!row.canView || pending}
                          title={row.canView ? undefined : 'This portal is still being built'}
                          aria-label={`View as client: ${row.name}`}
                          ref={(el) => {
                            if (el) viewRefs.current.set(row.id, el);
                            else viewRefs.current.delete(row.id);
                          }}
                          className={ACTION}
                        >
                          View as client
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </form>
        {rows.length === 0 && (
          <p role='status' className='text-muted-foreground px-4 py-6 text-center text-sm'>
            No workspace matches “{query}”.
          </p>
        )}
        {error && (
          <p role='alert' className='text-destructive border-t px-4 py-2 text-sm'>
            {error}
          </p>
        )}
        <p className='text-muted-foreground border-t px-4 py-2 text-xs'>
          Enter opens. Ctrl or Cmd+Enter views as the client, read-only.
        </p>
      </PopoverContent>
    </Popover>
  );
}
