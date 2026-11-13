import PageContainer from '@/components/layout/page-container';
import type { Metadata } from 'next';
import { listFieldDefs } from '@/server/custom-fields';
import { companiesContext } from '../_lib/context';
import { createCompanyAction } from '../actions';
import { CompanyForm } from '../company-form';

export const metadata: Metadata = { title: 'Add company' };
export const dynamic = 'force-dynamic';

export default async function NewCompanyPage() {
  const ctx = await companiesContext();
  const customDefs = await listFieldDefs(ctx, 'company');
  return (
    <PageContainer pageTitle='Add company' pageDescription='Name is the only required field.'>
      <div className='max-w-2xl'>
        <CompanyForm
          action={createCompanyAction}
          customDefs={customDefs}
          submitLabel='Add company'
        />
      </div>
    </PageContainer>
  );
}
