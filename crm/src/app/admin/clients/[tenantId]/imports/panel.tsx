'use client';

import { useState } from 'react';

type Batch = {
  id: string;
  fileName: string;
  importedSource: string;
  entity: ImportEntity;
  mapping: unknown;
  status: string;
  rowsTotal: number;
  rowsOk: number;
  rowsFailed: number;
  rowsDuplicate: number;
  report: unknown;
};

type ImportEntity = 'contact' | 'company' | 'deal' | 'note';
const entityFields: Record<ImportEntity, string[]> = {
  contact: [
    'firstName',
    'lastName',
    'phone',
    'email',
    'externalId',
    'consentDate',
    'consentChannel',
    'consentEvidence'
  ],
  company: ['name', 'phone', 'website', 'externalId'],
  deal: [
    'title',
    'valueCents',
    'serviceType',
    'expectedClose',
    'stage',
    'contactExternalId',
    'externalId'
  ],
  note: ['body', 'contactExternalId', 'companyExternalId', 'dealExternalId', 'externalId']
};

function savedMapping(
  batches: Batch[],
  entity: ImportEntity,
  source: string
): Record<string, string> {
  const saved = [...batches]
    .reverse()
    .find(
      (batch) =>
        batch.entity === entity &&
        batch.importedSource === source &&
        batch.mapping &&
        Object.keys(batch.mapping as object).length > 0
    );
  return saved ? (saved.mapping as Record<string, string>) : {};
}

async function requestJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = (await response.json()) as {
    ok?: boolean;
    report?: unknown;
    result?: unknown;
    error?: { message?: string };
  };
  if (!response.ok || !result.ok)
    throw new Error(result.error?.message ?? 'Import request failed.');
  return result;
}

export function ImportPanel({
  tenantId,
  batches: initial
}: {
  tenantId: string;
  batches: Batch[];
}) {
  const [batches, setBatches] = useState(initial);
  const [headers, setHeaders] = useState<string[]>([]);
  const [batchId, setBatchId] = useState('');
  const [entity, setEntity] = useState<ImportEntity>(initial.at(-1)?.entity ?? 'contact');
  const [source, setSource] = useState(initial.at(-1)?.importedSource ?? 'csv_other');
  const [mapping, setMapping] = useState<Record<string, string>>(() =>
    savedMapping(
      initial,
      initial.at(-1)?.entity ?? 'contact',
      initial.at(-1)?.importedSource ?? 'csv_other'
    )
  );
  const [duplicateRule, setDuplicateRule] = useState<'skip' | 'fill_empty'>('skip');
  const [report, setReport] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const data = new FormData();
      data.set('tenantId', tenantId);
      data.set('file', file);
      data.set('entity', entity);
      data.set('importedSource', source);
      data.set('duplicateRule', duplicateRule);
      const response = await fetch('/api/imports', { method: 'POST', body: data });
      const result = (await response.json()) as {
        ok?: boolean;
        batch?: { id: string; fileName: string };
        headers?: string[];
        error?: { message?: string };
      };
      if (!response.ok || !result.batch) throw new Error(result.error?.message ?? 'Upload failed.');
      setBatchId(result.batch.id);
      if (result.headers?.length) setHeaders(result.headers);
      else {
        const text = await file.text();
        const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
        setHeaders(firstLine.split(',').map((v) => v.replace(/^"|"$/g, '').replaceAll('""', '"')));
      }
      setBatches((old) => [
        {
          id: result.batch!.id,
          fileName: result.batch!.fileName,
          importedSource: source,
          entity,
          mapping: {},
          status: 'uploaded',
          rowsTotal: 0,
          rowsOk: 0,
          rowsFailed: 0,
          rowsDuplicate: 0,
          report: {}
        },
        ...old
      ]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function dryRun() {
    setBusy(true);
    setMessage('');
    try {
      const values = Object.fromEntries(Object.entries(mapping).filter(([, value]) => value));
      const result = await requestJson(`/api/imports/${batchId}/dry-run`, {
        tenantId,
        mapping: values
      });
      setReport(result.report);
      setMessage('Dry run complete. Review the report before committing.');
      setBatches((old) =>
        old.map((b) => (b.id === batchId ? { ...b, status: 'dry_run_ok', mapping: values } : b))
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Dry run failed.');
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    setBusy(true);
    setMessage('');
    try {
      const result = await requestJson(`/api/imports/${batchId}/commit`, { tenantId });
      setReport(result.result ?? null);
      setMessage('Import committed.');
      setBatches((old) =>
        old.map((batch) => (batch.id === batchId ? { ...batch, status: 'done' } : batch))
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Commit failed.');
    } finally {
      setBusy(false);
    }
  }
  async function undo(id: string) {
    setBusy(true);
    setMessage('');
    try {
      const result = await requestJson(`/api/imports/${id}/undo`, { tenantId });
      setReport(result.result);
      setMessage('Undo completed; edited records are listed in the result.');
      location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Undo failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className='grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-6'>
      <section className='grid gap-3 rounded border p-4'>
        <h2 className='text-lg font-semibold'>Upload CSV or Excel</h2>
        <p className='text-muted-foreground text-sm'>
          CSV or .xlsx, up to 10 MB. The first sheet is read. Formula cells use the saved value.
          Macro-enabled .xlsm files and legacy .xls files are not accepted.
        </p>
        <label>
          Record type
          <select
            className='mt-1 block min-h-11 w-full rounded border p-2'
            value={entity}
            onChange={(event) => {
              const next = event.target.value as ImportEntity;
              setEntity(next);
              setMapping(savedMapping(batches, next, source));
              setBatchId('');
              setHeaders([]);
              setReport(null);
            }}
          >
            <option value='contact'>Contacts</option>
            <option value='company'>Companies</option>
            <option value='deal'>Deals and quotes</option>
            <option value='note'>Notes and history</option>
          </select>
        </label>
        <label>
          Source system
          <input
            className='mt-1 block min-h-11 w-full rounded border px-3'
            value={source}
            onChange={(event) => {
              const next = event.target.value;
              setSource(next);
              setMapping(savedMapping(batches, entity, next));
            }}
          />
        </label>
        <label>
          CSV or Excel file
          <input
            className='mt-1 block min-h-11'
            type='file'
            accept='.csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button className='min-h-11 rounded border px-4' disabled={!file || busy} onClick={upload}>
          Upload file
        </button>
      </section>
      {batchId && headers.length > 0 && (
        <section className='grid gap-3 rounded border p-4'>
          <h2 className='text-lg font-semibold'>Map {entity} columns</h2>
          {entityFields[entity].map((key) => (
            <label key={key}>
              {key}
              <select
                className='mt-1 block min-h-11 w-full rounded border p-2'
                aria-label={key}
                value={mapping[key]}
                onChange={(event) => setMapping((old) => ({ ...old, [key]: event.target.value }))}
              >
                <option value=''>Skip</option>
                {headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Duplicate handling
            <select
              className='mt-1 block min-h-11 w-full rounded border p-2'
              value={duplicateRule}
              onChange={(event) => setDuplicateRule(event.target.value as typeof duplicateRule)}
            >
              <option value='skip'>Skip duplicates</option>
              <option value='fill_empty'>Fill empty fields</option>
            </select>
          </label>
          <button
            className='min-h-11 rounded border px-4'
            disabled={
              busy ||
              !(entity === 'contact'
                ? mapping.phone || mapping.email
                : entity === 'company'
                  ? mapping.name
                  : entity === 'deal'
                    ? mapping.title
                    : mapping.body)
            }
            onClick={dryRun}
          >
            Run dry-run
          </button>
          {report !== null && (
            <pre className='overflow-auto rounded bg-muted p-3 text-sm'>
              {JSON.stringify(report, null, 2)}
            </pre>
          )}
          {batches.find((batch) => batch.id === batchId)?.status === 'dry_run_ok' && (
            <button
              className='bg-primary text-primary-foreground min-h-11 rounded px-4'
              disabled={busy}
              onClick={commit}
            >
              Commit import
            </button>
          )}
        </section>
      )}
      {message && (
        <p role='status' aria-live='polite'>
          {message}
        </p>
      )}
      <section className='grid gap-3'>
        <h2 className='text-lg font-semibold'>Import history</h2>
        {batches.map((batch) => (
          <article className='grid gap-2 rounded border p-4 sm:grid-cols-[1fr_auto]' key={batch.id}>
            <div>
              <h3 className='font-medium'>{batch.fileName}</h3>
              <p className='text-sm text-muted-foreground'>
                {batch.importedSource} · {batch.status} · {batch.rowsTotal} rows · {batch.rowsOk}{' '}
                valid · {batch.rowsFailed} failed · {batch.rowsDuplicate} duplicates
              </p>
              {batch.report !== null && (
                <details className='mt-2'>
                  <summary>Report</summary>
                  <pre className='overflow-auto text-xs'>
                    {JSON.stringify(batch.report, null, 2)}
                  </pre>
                </details>
              )}
            </div>
            {batch.status === 'done' && (
              <button
                className='min-h-11 rounded border px-4'
                disabled={busy}
                onClick={() => undo(batch.id)}
              >
                Undo batch
              </button>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
