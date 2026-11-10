import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { decideAdminAccess } from '@/server/admin';
import { INDUSTRY_TEMPLATES, INDUSTRY_TEMPLATE_KEYS } from '@/server/admin/industry-templates';
import {
  AUTOMATION_TEMPLATE_CATALOG,
  COMING_SOON_SYSTEMS,
  SYSTEM_CATALOG
} from '@/server/modules/catalog';
import { MODULE_KEYS } from '@/server/modules/keys';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { ApplyTemplateForm } from './apply-form';
import { loadTemplateTenants } from './actions';

export const metadata: Metadata = { title: 'Template library' };
export const dynamic = 'force-dynamic';

const BUNDLE_MEMBERS = ['quote_followup', 'reactivation', 'missed_call_textback'] as const;

export default async function TemplateLibraryPage() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  const tenants = await loadTemplateTenants();
  const systems = MODULE_KEYS.filter((key) => key !== 'platform');

  return (
    <PageContainer
      pageTitle='Template library'
      pageDescription='Reusable industry and system templates. Applying a template twice does not duplicate anything.'
    >
      <section aria-labelledby='industry-heading' className='space-y-4'>
        <h2 id='industry-heading' className='text-base font-semibold'>
          Industry templates
        </h2>
        <div className='grid gap-4 lg:grid-cols-2'>
          {INDUSTRY_TEMPLATE_KEYS.map((key) => {
            const template = INDUSTRY_TEMPLATES[key];
            return (
              <article key={key} className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
                <h3 className='font-medium'>{template.label}</h3>
                <dl className='mt-3 space-y-2 text-sm'>
                  <div>
                    <dt className='text-muted-foreground'>Services</dt>
                    <dd>
                      {template.services.length
                        ? template.services.join(', ')
                        : 'This template does not set a service list.'}
                    </dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Pipeline stages</dt>
                    <dd>
                      {template.stages?.length ? (
                        <>
                          {template.stages.map((stage) => stage.name).join(', ')}
                          {template.stagesAreEditableDefaults && (
                            <span className='mt-1 block text-xs'>
                              Stage names are editable defaults.
                            </span>
                          )}
                        </>
                      ) : (
                        'This template does not change pipeline stages. A new client still gets the standard sales stages.'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Systems and automations</dt>
                    <dd>This template does not switch systems or automations on.</dd>
                  </div>
                </dl>
                <ApplyTemplateForm kind='industry' templateKey={key} tenants={tenants} />
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby='systems-heading' className='mt-8 space-y-4'>
        <h2 id='systems-heading' className='text-base font-semibold'>
          System templates
        </h2>
        <div className='grid gap-4 lg:grid-cols-2'>
          {systems.map((key) => {
            const catalog = SYSTEM_CATALOG[key];
            const automations = AUTOMATION_TEMPLATE_CATALOG.filter((row) => row.moduleKey === key);
            return (
              <article key={key} className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
                <h3 className='font-medium'>{catalog.label}</h3>
                <p className='text-muted-foreground mt-1 text-sm'>{catalog.outcome}</p>
                <dl className='mt-3 space-y-2 text-sm'>
                  <div>
                    <dt className='text-muted-foreground'>Turns on</dt>
                    <dd>
                      {catalog.label}
                      {key === 'followup_bundle' &&
                        ` and ${BUNDLE_MEMBERS.map((member) => SYSTEM_CATALOG[member].label).join(', ')}`}
                      {key === 'after_hours' &&
                        '. Missed-call text-back is included while this is on.'}
                    </dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Default automations</dt>
                    <dd>
                      {automations.length
                        ? automations.map((row) => row.label).join(', ')
                        : 'No default automation is specified for this system.'}
                    </dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Pipeline stages</dt>
                    <dd>This system template does not change pipeline stages.</dd>
                  </div>
                </dl>
                <ApplyTemplateForm
                  kind='system'
                  templateKey={key}
                  tenants={tenants}
                  needsLevel={key === 'crm'}
                />
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby='soon-heading' className='mt-8 space-y-4'>
        <h2 id='soon-heading' className='text-base font-semibold'>
          Coming soon
        </h2>
        <div className='grid gap-4 lg:grid-cols-3'>
          {COMING_SOON_SYSTEMS.map((system) => (
            <article key={system.key} className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
              <div className='flex items-center justify-between gap-3'>
                <h3 className='font-medium'>{system.name}</h3>
                <Badge variant='secondary'>Coming soon</Badge>
              </div>
              <p className='text-muted-foreground mt-3 text-sm'>{system.note}</p>
            </article>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
