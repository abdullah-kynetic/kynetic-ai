import Link from 'next/link';
import { headers } from 'next/headers';
import PageContainer from '@/components/layout/page-container';
import { contactsActorScope } from '@/server/contacts';
import { listTenantDocuments } from '@/server/documents';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const scope = await contactsActorScope(await headers());
  if (!scope) return <PageContainer pageTitle='Documents' access={false}>{null}</PageContainer>;
  const documents = await listTenantDocuments(scope.ctx, scope.actor);
  return (
    <PageContainer pageTitle='Documents' pageDescription='Files shared with your business.'>
      <ul className='grid max-w-3xl gap-3'>
        {documents.length === 0 ? <li className='text-muted-foreground'>No documents yet.</li> : documents.map((document) => (
          <li key={document.id} className='flex min-h-11 items-center justify-between gap-4 rounded border p-3'>
            <span><span className='font-medium'>{document.title}</span><span className='text-muted-foreground'> · {document.kind}</span></span>
            <Link className='min-h-11 inline-flex items-center rounded border px-4 underline' href={`/api/documents/${document.id}/download`}>Download</Link>
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
