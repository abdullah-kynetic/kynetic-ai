import { headers } from 'next/headers';
import PageContainer from '@/components/layout/page-container';
import { EmptyState } from '@/components/ui/states';
import { contactsActorScope } from '@/server/contacts';
import { listTenantDocuments } from '@/server/documents';

export const dynamic = 'force-dynamic';

const kindLabel = (kind: string) => {
  const text = kind.replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export default async function DocumentsPage() {
  const scope = await contactsActorScope(await headers());
  if (!scope)
    return (
      <PageContainer pageTitle='Documents' access={false}>
        {null}
      </PageContainer>
    );
  const documents = await listTenantDocuments(scope.ctx, scope.actor);
  return (
    <PageContainer pageTitle='Documents' pageDescription='Files shared with your business.'>
      {documents.length === 0 ? (
        <EmptyState
          title='No documents yet'
          description='Agreements, proposals and reports shared with your business will show here.'
        />
      ) : (
        <ul className='grid max-w-3xl gap-3'>
          {documents.map((document) => (
            <li
              key={document.id}
              className='flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-lg border p-3'
            >
              <span className='flex min-w-0 flex-col'>
                <span className='font-medium break-words'>{document.title}</span>
                <span className='text-muted-foreground text-sm'>{kindLabel(document.kind)}</span>
              </span>
              <a
                className='inline-flex min-h-11 items-center rounded-lg border px-4 underline'
                href={`/api/documents/${document.id}/download`}
              >
                Download
              </a>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
