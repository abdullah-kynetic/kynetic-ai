'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  canDryRun,
  CONSENT_FIELDS,
  guessMapping,
  importErrorMessage,
  issueText,
  MAPPING_FIELDS,
  mappingPayload,
  type Mapping,
  type MappingKey
} from './mapping';

export type ImportHistoryRow = {
  id: string;
  fileName: string;
  status: string;
  rowsTotal: number;
  rowsOk: number;
  rowsFailed: number;
  rowsDuplicate: number;
  committedAt: string | null;
};

type DryRun = {
  total: number;
  ok: number;
  failed: number;
  duplicates: number;
  issues: { row: number; reason: string }[];
};
type Commit = {
  imported: number;
  filled: number;
  skipped: number;
  failed: number;
  consents: number;
  consentsRefused?: number;
};

const STATUS_LABEL: Record<string, string> = {
  uploaded: 'Uploaded',
  mapped: 'Mapped',
  dry_run_ok: 'Checked, not imported',
  dry_run_failed: 'Checked, not imported',
  done: 'Imported',
  undone: 'Undone',
  failed: 'Failed'
};

async function post<T>(path: string, body?: BodyInit | object) {
  const isForm = body instanceof FormData;
  const res = await fetch(path, {
    method: 'POST',
    headers: body && !isForm ? { 'content-type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined
  });
  const json = (await res.json()) as T & {
    ok?: boolean;
    error?: { message?: string; fieldErrors?: Record<string, string[]> };
  };
  if (!res.ok || json.ok === false) throw new Error(importErrorMessage(json));
  return json;
}

/**
 * The client's own lead import (P1-5, F-95): upload a CSV or Excel file, match its columns, check it
 * with a dry run that writes nothing, then import. Consent follows the staff import: it is recorded
 * only when the file carries a date, a channel and proof for the row.
 */
export function ImportLeads({ history }: { history: ImportHistoryRow[] }) {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [duplicateRule, setDuplicateRule] = React.useState<'skip' | 'fill_empty'>('skip');
  const [batchId, setBatchId] = React.useState<string | null>(null);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [mapping, setMapping] = React.useState<Mapping>({});
  const [report, setReport] = React.useState<DryRun | null>(null);
  const [committed, setCommitted] = React.useState<Commit | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<'upload' | 'check' | 'import' | 'undo' | null>(null);
  const id = React.useId();

  async function run(kind: NonNullable<typeof busy>, work: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The import request failed.');
    } finally {
      setBusy(null);
    }
  }

  const upload = () =>
    run('upload', async () => {
      if (!file) return;
      const form = new FormData();
      form.set('file', file);
      form.set('duplicateRule', duplicateRule);
      const res = await post<{ batch: { id: string }; headers: string[] }>('/api/my-imports', form);
      setBatchId(res.batch.id);
      setHeaders(res.headers);
      setMapping(guessMapping(res.headers));
      setReport(null);
      setCommitted(null);
    });

  const check = () =>
    run('check', async () => {
      const res = await post<{ report: DryRun }>(`/api/my-imports/${batchId}/dry-run`, {
        mapping: mappingPayload(mapping)
      });
      setReport(res.report);
    });

  const commit = () =>
    run('import', async () => {
      const res = await post<{ result: Commit }>(`/api/my-imports/${batchId}/commit`);
      setCommitted(res.result);
      setBatchId(null);
      setHeaders([]);
      setReport(null);
      setFile(null);
      router.refresh();
    });

  const undo = (batch: string) =>
    run('undo', async () => {
      await post(`/api/my-imports/${batch}/undo`);
      router.refresh();
    });

  const setField = (key: MappingKey) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setMapping((m) => ({ ...m, [key]: e.target.value || undefined }));

  const select = (key: MappingKey, label: string) => (
    <div key={key} className='flex flex-col gap-1.5'>
      <label htmlFor={`${id}-${key}`} className='text-sm'>
        {label}
      </label>
      <NativeSelect
        className='w-full'
        id={`${id}-${key}`}
        value={mapping[key] ?? ''}
        onChange={(e) => {
          setField(key)(e);
          setReport(null);
        }}
      >
        <NativeSelectOption value=''>Skip this one</NativeSelectOption>
        {headers.map((h) => (
          <NativeSelectOption key={h} value={h}>
            {h}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <div className='flex max-w-3xl flex-col gap-6'>
      {error ? (
        <Alert variant='destructive' role='alert'>
          <AlertTitle>That did not work</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {committed ? (
        <Alert role='status' data-testid='import-result'>
          <AlertTitle>Import finished</AlertTitle>
          <AlertDescription className='flex flex-col gap-2'>
            <span>
              {committed.imported} new {committed.imported === 1 ? 'lead' : 'leads'} added,{' '}
              {committed.skipped} already in your list, {committed.failed} could not be read
              {committed.filled ? `, ${committed.filled} existing leads filled in` : ''}
              {committed.consents
                ? `, ${committed.consents} consent ${committed.consents === 1 ? 'record' : 'records'} saved`
                : ''}
              {committed.consentsRefused
                ? `, ${committed.consentsRefused} consent ${committed.consentsRefused === 1 ? 'date' : 'dates'} not saved because the person opted out or is on the do-not-call list`
                : ''}
              .
            </span>
            <span>
              <Link href='/dashboard/contacts' className='font-medium underline underline-offset-4'>
                See your leads
              </Link>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>1. Choose your file</CardTitle>
          <CardDescription>
            A CSV or Excel (.xlsx) file, up to 10 MB. The first sheet is read and its first row must
            be the column names.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>
          <div className='flex flex-col gap-1.5'>
            <label htmlFor={`${id}-file`} className='text-sm'>
              CSV or Excel file
            </label>
            <Input
              id={`${id}-file`}
              type='file'
              accept='.csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <label htmlFor={`${id}-dupes`} className='text-sm'>
              When a lead is already in your list
            </label>
            <NativeSelect
              className='w-full'
              id={`${id}-dupes`}
              value={duplicateRule}
              onChange={(e) => setDuplicateRule(e.target.value as 'skip' | 'fill_empty')}
            >
              <NativeSelectOption value='skip'>Leave it as it is</NativeSelectOption>
              <NativeSelectOption value='fill_empty'>Fill in what is missing</NativeSelectOption>
            </NativeSelect>
          </div>
          <div>
            <LoadingButton
              type='button'
              disabled={!file}
              loading={busy === 'upload'}
              onClick={() => void upload()}
            >
              Upload file
            </LoadingButton>
          </div>
        </CardContent>
      </Card>

      {batchId && headers.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>2. Match your columns</CardTitle>
            <CardDescription>
              Pick the column in your file for each detail. A phone or an email is needed so each
              lead can be reached and checked for duplicates.
            </CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col gap-4'>
            <div className='grid gap-4 sm:grid-cols-2'>
              {MAPPING_FIELDS.map((f) => select(f.key, f.label))}
            </div>
            <fieldset className='flex flex-col gap-3 rounded-lg border p-4'>
              <legend className='px-1 text-sm font-medium'>Consent (optional)</legend>
              <p className='text-muted-foreground text-sm'>
                A phone number alone is not consent. Only fill these in if your file records that
                the person agreed to be contacted, when, and where. A row is saved with consent only
                when it has all three.
              </p>
              <div className='grid gap-4 sm:grid-cols-2'>
                {CONSENT_FIELDS.map((f) => select(f.key, f.label))}
              </div>
            </fieldset>
            <div>
              <LoadingButton
                type='button'
                disabled={!canDryRun(mapping)}
                loading={busy === 'check'}
                onClick={() => void check()}
              >
                Check the file
              </LoadingButton>
              <p className='text-muted-foreground mt-2 text-sm'>
                This only checks the file. Nothing is added until you import.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {report && batchId ? (
        <Card data-testid='dry-run-report'>
          <CardHeader>
            <CardTitle>3. Review, then import</CardTitle>
          </CardHeader>
          <CardContent className='flex flex-col gap-4'>
            <dl className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
              {[
                ['Rows in file', report.total],
                ['Ready to add', report.ok],
                ['Already in your list', report.duplicates],
                ['Cannot be imported', report.failed]
              ].map(([label, value]) => (
                <div key={label} className='flex flex-col'>
                  <dt className='text-muted-foreground text-sm'>{label}</dt>
                  <dd className='font-display text-2xl font-semibold tabular-nums'>{value}</dd>
                </div>
              ))}
            </dl>
            {report.issues.length > 0 ? (
              <div className='flex flex-col gap-2'>
                <h3 className='text-sm font-medium'>
                  Rows that cannot be imported
                  {report.failed > report.issues.length
                    ? ` (first ${report.issues.length} of ${report.failed})`
                    : ''}
                </h3>
                <Table scrollLabel='Rows that cannot be imported'>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Why</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.issues.map((i) => (
                      <TableRow key={`${i.row}-${i.reason}`}>
                        <TableCell className='tabular-nums'>{i.row}</TableCell>
                        <TableCell>{issueText(i.reason)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
            <div className='flex flex-wrap gap-2'>
              <LoadingButton
                type='button'
                disabled={report.ok === 0 && !(duplicateRule === 'fill_empty' && report.duplicates)}
                loading={busy === 'import'}
                onClick={() => void commit()}
              >
                {report.ok === 1 ? 'Import 1 lead' : `Import ${report.ok} leads`}
              </LoadingButton>
              <Button
                type='button'
                variant='outline'
                disabled={busy !== null}
                onClick={() => setReport(null)}
              >
                Change the columns
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby={`${id}-history`} className='flex flex-col gap-3'>
        <h2 id={`${id}-history`} className='text-lg font-semibold'>
          Your past imports
        </h2>
        {history.length === 0 ? (
          <p className='text-muted-foreground text-sm'>No imports yet.</p>
        ) : (
          <ul className='flex flex-col gap-2'>
            {history.map((b) => (
              <li
                key={b.id}
                className='flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3'
              >
                <div className='flex flex-col'>
                  <span className='font-medium'>{b.fileName}</span>
                  <span className='text-muted-foreground text-sm'>
                    {STATUS_LABEL[b.status] ?? b.status} · {b.rowsTotal} rows · {b.rowsOk} ready ·{' '}
                    {b.rowsDuplicate} already listed · {b.rowsFailed} not importable
                  </span>
                </div>
                {b.status === 'done' ? (
                  <Button
                    type='button'
                    variant='outline'
                    disabled={busy !== null}
                    onClick={() => void undo(b.id)}
                  >
                    Undo this import
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <Link href='/dashboard/contacts' className={buttonVariants({ variant: 'link' })}>
          Back to your leads
        </Link>
      </section>
    </div>
  );
}
