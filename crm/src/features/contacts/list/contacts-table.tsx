'use client';

import { type ColumnDef, Subscribe } from '@tanstack/react-table';
import Link from 'next/link';
import { parseAsString, useQueryState, useQueryStates } from 'nuqs';
import * as React from 'react';
import { IconPencil, IconPlus, IconSearch, IconUsers } from '@tabler/icons-react';

import type { ContactFacets, ContactListRow } from '@/server/contacts';
import { formatCustomValue, type CustomFieldDef } from '@/server/custom-fields/types';
import { CONTACT_STATUSES, NO_OWNER } from '@/server/contacts/constants';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/states';
import { useDataTable } from '@/hooks/use-data-table';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import type { DataTableFeatures } from '@/lib/data-table-features';
import { ContactPanel, type PanelTarget } from '../panel/contact-panel';
import {
  customColumnId,
  customFilterVariant,
  DEFAULT_SORT,
  HIDEABLE_COLUMNS,
  type ListColumn
} from './search-params';
import {
  formatDay,
  formatPhone,
  fullName,
  sourceLabel,
  STATUS_LABELS,
  STATUS_TONES
} from './format';

type Props = {
  rows: ContactListRow[];
  total: number;
  pageCount: number;
  perPage: number;
  facets: ContactFacets;
  /** CRM Full only; empty otherwise, so a Lite tenant sees no custom columns or filters. */
  customFields: CustomFieldDef[];
  hidden: string[];
  filtered: boolean;
  /** The actor has `tenant_data.write`: shows Add and Edit. */
  canWrite: boolean;
};

const contactHref = (id: string) => `/dashboard/contacts/${id}`;

/** One column per custom field shown in the table or used as a filter (F-12). Sorting is not offered. */
function customColumn(def: CustomFieldDef): ColumnDef<DataTableFeatures, ContactListRow> {
  const variant = def.filterable ? customFilterVariant(def.type) : undefined;
  const options =
    def.type === 'checkbox'
      ? [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' }
        ]
      : def.options.map((o) => ({ label: o, value: o }));
  return {
    id: customColumnId(def.key),
    accessorFn: (r) => r.custom[def.key],
    header: () => def.label,
    cell: ({ row }) => {
      const text = formatCustomValue(def, row.original.custom[def.key]);
      const numeric = def.type === 'number' || def.type === 'money';
      return (
        <span
          className={numeric ? 'tabular-nums' : 'block max-w-56 truncate'}
          title={numeric ? undefined : text}
        >
          {text}
        </span>
      );
    },
    meta: {
      label: def.label,
      variant,
      options: variant === 'multiSelect' ? options : undefined,
      unit: def.type === 'money' ? '$' : undefined
    },
    enableColumnFilter: Boolean(variant),
    enableSorting: false
  };
}

function buildColumns(
  facets: ContactFacets,
  customFields: CustomFieldDef[],
  onEdit: ((id: string) => void) | null
): ColumnDef<DataTableFeatures, ContactListRow>[] {
  const tz = facets.timezone;
  const edit: ColumnDef<DataTableFeatures, ContactListRow>[] = onEdit
    ? [
        {
          id: 'actions',
          header: () => <span className='sr-only'>Actions</span>,
          cell: ({ row }) => (
            <Button
              variant='ghost'
              size='icon'
              aria-label={`Edit ${fullName(row.original)}`}
              onClick={() => onEdit(row.original.id)}
            >
              <IconPencil aria-hidden='true' />
            </Button>
          ),
          meta: { label: 'Actions' },
          enableSorting: false,
          enableHiding: false
        }
      ]
    : [];
  return [
    {
      id: 'name',
      accessorFn: (r) => fullName(r),
      header: ({ column }) => <DataTableColumnHeader column={column} label='Name' />,
      cell: ({ row }) => (
        <Link
          href={contactHref(row.original.id)}
          className='text-foreground font-medium underline-offset-4 hover:underline'
        >
          {fullName(row.original)}
        </Link>
      ),
      meta: { label: 'Name' },
      enableHiding: false
    },
    {
      id: 'phone',
      accessorFn: (r) => r.primaryPhoneE164,
      header: () => 'Phone',
      cell: ({ row }) => (
        <span className='tabular-nums'>{formatPhone(row.original.primaryPhoneE164)}</span>
      ),
      meta: { label: 'Phone' },
      enableSorting: false
    },
    {
      id: 'email',
      accessorFn: (r) => r.primaryEmail,
      header: () => 'Email',
      cell: ({ row }) => (
        <span className='block max-w-56 truncate' title={row.original.primaryEmail ?? undefined}>
          {row.original.primaryEmail}
        </span>
      ),
      meta: { label: 'Email' },
      enableSorting: false
    },
    {
      id: 'status',
      accessorFn: (r) => r.status,
      header: ({ column }) => <DataTableColumnHeader column={column} label='Status' />,
      cell: ({ row }) => {
        const s = row.original.status as keyof typeof STATUS_LABELS;
        return (
          <StatusBadge tone={STATUS_TONES[s] ?? 'neutral'}>{STATUS_LABELS[s] ?? s}</StatusBadge>
        );
      },
      meta: {
        label: 'Status',
        variant: 'multiSelect',
        options: CONTACT_STATUSES.map((s) => ({ label: STATUS_LABELS[s], value: s }))
      },
      enableColumnFilter: true
    },
    {
      id: 'source',
      accessorFn: (r) => r.source,
      header: ({ column }) => <DataTableColumnHeader column={column} label='Source' />,
      cell: ({ row }) => sourceLabel(row.original.source),
      meta: {
        label: 'Source',
        variant: 'multiSelect',
        options: facets.sources.map((s) => ({ label: sourceLabel(s), value: s }))
      },
      enableColumnFilter: true
    },
    {
      id: 'tags',
      accessorFn: (r) => r.tags,
      header: () => 'Tags',
      cell: ({ row }) => (
        <div className='flex flex-wrap gap-1'>
          {row.original.tags.slice(0, 3).map((t) => (
            <Badge key={t} variant='outline'>
              {t}
            </Badge>
          ))}
          {row.original.tags.length > 3 ? (
            <span className='text-muted-foreground text-xs'>+{row.original.tags.length - 3}</span>
          ) : null}
        </div>
      ),
      meta: {
        label: 'Tags',
        variant: 'multiSelect',
        options: facets.tags.map((t) => ({ label: t, value: t }))
      },
      enableColumnFilter: true,
      enableSorting: false
    },
    {
      id: 'owner',
      accessorFn: (r) => r.ownerName,
      header: () => 'Owner',
      cell: ({ row }) =>
        row.original.ownerName ?? <span className='text-muted-foreground'>Unassigned</span>,
      meta: {
        label: 'Owner',
        variant: 'multiSelect',
        options: [
          { label: 'Unassigned', value: NO_OWNER },
          ...facets.owners.map((o) => ({ label: o.name, value: o.id }))
        ]
      },
      enableColumnFilter: true,
      enableSorting: false
    },
    {
      id: 'createdAt',
      accessorFn: (r) => r.createdAt,
      header: ({ column }) => <DataTableColumnHeader column={column} label='Created' />,
      cell: ({ row }) => (
        <span className='tabular-nums'>{formatDay(row.original.createdAt, tz)}</span>
      ),
      meta: { label: 'Created', variant: 'dateRange' },
      enableColumnFilter: true
    },
    {
      id: 'updatedAt',
      accessorFn: (r) => r.updatedAt,
      header: ({ column }) => <DataTableColumnHeader column={column} label='Updated' />,
      cell: ({ row }) => (
        <span className='tabular-nums'>{formatDay(row.original.updatedAt, tz)}</span>
      ),
      meta: { label: 'Updated' }
    },
    ...customFields.filter((d) => d.showInTable || d.filterable).map(customColumn),
    ...edit
  ];
}

/** Search box bound to `?q=`; typing resets to page 1 and the server re-renders the list. */
function ContactSearch() {
  const [{ q }, setParams] = useQueryStates(
    { q: parseAsString.withDefault(''), page: parseAsString },
    { shallow: false, history: 'replace' }
  );
  const [value, setValue] = React.useState(q);
  // Follow the URL when it changes from outside (Clear filters, back button), not while typing.
  const [seenQ, setSeenQ] = React.useState(q);
  if (q !== seenQ) {
    setSeenQ(q);
    if (q !== value.trim()) setValue(q);
  }
  const write = useDebouncedCallback((next: string) => {
    void setParams({ q: next.trim() || null, page: null });
  }, 300);
  return (
    <div className='relative w-full sm:w-64'>
      <IconSearch
        aria-hidden='true'
        className='text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2'
      />
      <Input
        type='search'
        aria-label='Search contacts by name, phone or email'
        placeholder='Search name, phone, email'
        className='ps-8'
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          write(e.target.value);
        }}
      />
    </div>
  );
}

/** Mirrors column show/hide into `?hide=`, so a copied link opens with the same columns. */
function useHiddenColumnsParam() {
  return useQueryState('hide', parseAsString.withOptions({ history: 'replace', shallow: true }));
}

function SyncHidden({ hidden }: { hidden: string }) {
  const [, setHide] = useHiddenColumnsParam();
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void setHide(hidden || null);
  }, [hidden, setHide]);
  return null;
}

function MobileCards({ rows, tz }: { rows: ContactListRow[]; tz: string }) {
  return (
    <ul className='flex flex-col gap-2 md:hidden' aria-label='Contacts'>
      {rows.map((r) => {
        const s = r.status as keyof typeof STATUS_LABELS;
        return (
          <li key={r.id}>
            <Link
              href={contactHref(r.id)}
              className='bg-card hover:bg-muted focus-visible:ring-ring flex min-h-11 flex-col gap-1 rounded-lg border p-3 focus-visible:ring-2 focus-visible:outline-none'
            >
              <span className='font-medium'>{fullName(r)}</span>
              <span className='flex flex-wrap items-center gap-2 text-sm'>
                <StatusBadge tone={STATUS_TONES[s] ?? 'neutral'}>
                  {STATUS_LABELS[s] ?? s}
                </StatusBadge>
                <span className='text-muted-foreground tabular-nums'>
                  {formatPhone(r.primaryPhoneE164) || r.primaryEmail || formatDay(r.createdAt, tz)}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Phones get previous and next instead of the desktop pagination bar (tables become cards < md). */
function MobilePager({
  table,
  pageCount
}: {
  table: ReturnType<typeof useDataTable<ContactListRow>>['table'];
  pageCount: number;
}) {
  return (
    <Subscribe source={table.atoms.pagination} selector={(p) => p.pageIndex}>
      {(pageIndex) => (
        <nav aria-label='Pages' className='flex items-center justify-between gap-2'>
          <Button
            variant='outline'
            className='min-h-11'
            disabled={pageIndex === 0}
            onClick={() => table.previousPage()}
          >
            Previous
          </Button>
          <span className='text-muted-foreground text-sm tabular-nums'>
            Page {pageIndex + 1} of {pageCount}
          </span>
          <Button
            variant='outline'
            className='min-h-11'
            disabled={pageIndex + 1 >= pageCount}
            onClick={() => table.nextPage()}
          >
            Next
          </Button>
        </nav>
      )}
    </Subscribe>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <Button className='min-h-11 sm:min-h-0' onClick={onClick}>
      <IconPlus aria-hidden='true' />
      Add contact
    </Button>
  );
}

export function ContactsTable({
  rows,
  total,
  pageCount,
  perPage,
  facets,
  customFields,
  hidden,
  filtered,
  canWrite
}: Props) {
  const [panel, setPanel] = React.useState<PanelTarget>(null);
  const columns = React.useMemo(
    () =>
      buildColumns(
        facets,
        customFields,
        canWrite ? (id) => setPanel({ mode: 'edit', id }) : null
      ),
    [facets, customFields, canWrite]
  );
  // Fields used only as a filter have no column of their own: they start hidden and stay out of `hide`.
  const hideable = React.useMemo(
    () => [
      ...HIDEABLE_COLUMNS,
      ...customFields.filter((d) => d.showInTable).map((d) => customColumnId(d.key))
    ],
    [customFields]
  );
  const filterOnly = React.useMemo(
    () =>
      customFields
        .filter((d) => d.filterable && !d.showInTable)
        .map((d) => [customColumnId(d.key), false] as const),
    [customFields]
  );
  const [, startTransition] = React.useTransition();

  const { table } = useDataTable({
    data: rows,
    columns,
    pageCount,
    shallow: false,
    startTransition,
    getRowId: (r) => r.id,
    initialState: {
      sorting: [DEFAULT_SORT],
      pagination: { pageIndex: 0, pageSize: perPage },
      columnVisibility: Object.fromEntries([
        ...filterOnly,
        ...hidden.map((c) => [c, false] as const)
      ])
    }
  });

  const [, setSearch] = useQueryStates(
    { q: parseAsString, page: parseAsString },
    { shallow: false, history: 'replace' }
  );
  function clearFilters() {
    table.resetColumnFilters(true);
    void setSearch({ q: null, page: null });
  }

  const toolbar = (
    <DataTableToolbar table={table} className='flex-col gap-2 sm:flex-row'>
      <ContactSearch />
      {canWrite ? <AddButton onClick={() => setPanel({ mode: 'create' })} /> : null}
    </DataTableToolbar>
  );
  const panelEl = canWrite ? (
    <ContactPanel target={panel} onClose={() => setPanel(null)} owners={facets.owners} />
  ) : null;

  if (total === 0 && !filtered) {
    return (
      <>
        <EmptyState
          icon={<IconUsers aria-hidden='true' />}
          title='No contacts yet'
          description='No contacts yet. Add one, import a CSV, or wait for your first lead.'
          action={canWrite ? <AddButton onClick={() => setPanel({ mode: 'create' })} /> : undefined}
        />
        {panelEl}
      </>
    );
  }

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <Subscribe
        source={table.atoms.columnVisibility}
        selector={(v) => hideable.filter((c) => v[c] === false).join(',')}
      >
        {(h) => <SyncHidden hidden={h} />}
      </Subscribe>
      {toolbar}
      {panelEl}
      <p className='sr-only' role='status' aria-live='polite'>
        {total === 1 ? '1 contact' : `${total.toLocaleString('en-US')} contacts`}
      </p>
      {total === 0 ? (
        <>
          <EmptyState
            icon={<IconSearch aria-hidden='true' />}
            title='No contacts match'
            description='No contacts match. Clear filters.'
            action={
              <Button variant='outline' onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        </>
      ) : (
        <>
          <div className='flex flex-col gap-3 md:hidden'>
            <MobileCards rows={rows} tz={facets.timezone} />
            <MobilePager table={table} pageCount={pageCount} />
          </div>
          <DataTable table={table} aria-label='Contacts' className='hidden min-h-[60vh] md:flex' />
        </>
      )}
    </div>
  );
}
