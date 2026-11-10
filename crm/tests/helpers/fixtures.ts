import type postgres from 'postgres';

/** Fixed ids so tests read clearly. Two synthetic tenants, a Kynetic admin and a VA. */
export const IDS = {
  tenantA: '11111111-1111-4111-8111-111111111111',
  tenantB: '22222222-2222-4222-8222-222222222222',
  ownerA: 'aaaaaaa1-0000-4000-8000-000000000001',
  staffA: 'aaaaaaa2-0000-4000-8000-000000000002',
  ownerB: 'bbbbbbb1-0000-4000-8000-000000000001',
  admin: 'cccccccc-0000-4000-8000-000000000001',
  va: 'cccccccc-0000-4000-8000-000000000002'
} as const;

export type SeededTenant = {
  tenantId: string;
  contactId: string;
  dealId: string;
  pipelineId: string;
  stageId: string;
  automationId: string;
};

type Sql = postgres.Sql;

/** Context builders for the roles in the permission matrix. */
export const ctx = {
  ownerA: () => ({ tenantId: IDS.tenantA, userId: IDS.ownerA, role: 'owner' as const }),
  staffA: () => ({ tenantId: IDS.tenantA, userId: IDS.staffA, role: 'staff' as const }),
  ownerB: () => ({ tenantId: IDS.tenantB, userId: IDS.ownerB, role: 'owner' as const }),
  /** A Kynetic admin viewing a client (view-as). */
  adminViewingA: () => ({
    tenantId: IDS.tenantA,
    userId: IDS.ownerA,
    role: 'admin' as const,
    impersonatorId: IDS.admin
  })
};

/**
 * Inserts the shared reference rows and both tenants, with one row in every tenant table, through
 * the superuser connection. Everything is synthetic: 555-01xx numbers and reserved test domains.
 */
export async function seedTwoTenants(admin: Sql): Promise<{ a: SeededTenant; b: SeededTenant }> {
  await admin`insert into module_catalog (module_key, label, always_on) values
    ('platform','Platform',true), ('alex_core','Alex',false), ('quote_followup','Quote follow-up',false),
    ('after_hours','After hours',false), ('missed_call_textback','Missed-call text-back',false),
    ('reactivation','Reactivation',false), ('opm','OPM',false), ('followup_bundle','Follow-up bundle',false),
    ('crm','CRM',false)
    on conflict do nothing`;
  await admin`insert into automation_templates (key, module_key, label) values
    ('speed_to_lead','alex_core','Speed to lead') on conflict do nothing`;
  await admin`insert into users (id, email, kynetic_role) values
    (${IDS.ownerA}, 'owner-a@example.test', null), (${IDS.staffA}, 'staff-a@example.test', null),
    (${IDS.ownerB}, 'owner-b@example.test', null), (${IDS.admin}, 'admin@example.test', 'admin'),
    (${IDS.va}, 'va@example.test', 'va')`;
  const a = await seedTenant(admin, 'a', IDS.tenantA, IDS.ownerA, IDS.staffA);
  const b = await seedTenant(admin, 'b', IDS.tenantB, IDS.ownerB, null);
  return { a, b };
}

async function seedTenant(
  admin: Sql,
  key: 'a' | 'b',
  t: string,
  owner: string,
  staff: string | null
): Promise<SeededTenant> {
  const n = key === 'a' ? 1 : 2;
  await admin`insert into tenants (id, slug, name, plan, timezone) values
    (${t}, ${'tenant-' + key}, ${'Tenant ' + key.toUpperCase()}, 'founding', 'America/Los_Angeles')`;
  await admin`insert into memberships (tenant_id, user_id, role) values (${t}, ${owner}, 'owner')`;
  if (staff)
    await admin`insert into memberships (tenant_id, user_id, role) values (${t}, ${staff}, 'staff')`;
  await admin`insert into invitations (tenant_id, email, role, token_hash, expires_at)
    values (${t}, ${`invitee-${key}@example.test`}, 'staff', ${`hash-${key}`}, now() + interval '7 days')`;
  await admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${t}, 'platform', true), (${t}, 'alex_core', true)`;
  await admin`insert into tenant_secrets (tenant_id, provider, name, ciphertext, nonce) values (${t}, 'twilio', 'token', '\\x01', '\\x02')`;
  await admin`insert into impersonation_sessions (tenant_id, impersonator_user_id, reason) values (${t}, ${IDS.admin}, 'fixture session')`;
  await admin`insert into tenant_billing (tenant_id) values (${t})`;
  await admin`insert into tenant_billing_modules (tenant_id, module_key, setup_cents, monthly_cents) values (${t}, 'alex_core', 650000, 150000)`;
  await admin`insert into onboarding_steps (tenant_id, step_key, title) values (${t}, 'kickoff', 'Kickoff')`;
  await admin`insert into tenant_documents (tenant_id, kind, title, file_key) values (${t}, 'agreement', 'Agreement', ${`${t}/agreement.pdf`})`;
  await admin`insert into audit_log (tenant_id, action, entity) values (${t}, 'fixture.seed', 'tenant')`;

  const [company] =
    await admin`insert into companies (tenant_id, name) values (${t}, ${`Company ${key}`}) returning id`;
  await admin`insert into custom_field_defs (tenant_id, entity, key, label, type) values (${t}, 'contact', 'roof_age', 'Roof age', 'number')`;
  const [contact] =
    await admin`insert into contacts (tenant_id, first_name, phones, emails, primary_phone_e164, primary_email, company_id, owner_id)
    values (${t}, ${`Contact ${key}`}, ${[`+1555555010${n}`]}, ${[`lead-${key}@example.test`]}, ${`+1555555010${n}`}, ${`lead-${key}@example.test`}, ${company.id}, ${owner}) returning id`;
  const [pipeline] =
    await admin`insert into pipelines (tenant_id, name, is_default) values (${t}, 'Sales', true) returning id`;
  const [stage] =
    await admin`insert into pipeline_stages (tenant_id, pipeline_id, name, position) values (${t}, ${pipeline.id}, 'New', 0) returning id`;
  const [deal] = await admin`insert into deals (tenant_id, pipeline_id, stage_id, title, position)
    values (${t}, ${pipeline.id}, ${stage.id}, 'Roof replacement', 'a0') returning id`;
  await admin`insert into deal_contacts (tenant_id, deal_id, contact_id, role) values (${t}, ${deal.id}, ${contact.id}, 'homeowner')`;
  await admin`insert into activities (tenant_id, contact_id, deal_id, type, summary, actor_type) values (${t}, ${contact.id}, ${deal.id}, 'system', 'Seeded', 'system')`;
  await admin`insert into tasks (tenant_id, title, contact_id) values (${t}, 'Call back', ${contact.id})`;
  const [note] =
    await admin`insert into notes (tenant_id, body_text, contact_id) values (${t}, 'Fixture note', ${contact.id}) returning id`;
  await admin`insert into note_mentions (tenant_id, note_id, user_id) values (${t}, ${note.id}, ${owner})`;

  const [call] =
    await admin`insert into calls (tenant_id, contact_id, deal_id, provider, provider_call_id, direction, started_at)
    values (${t}, ${contact.id}, ${deal.id}, 'fake', ${`call-${key}`}, 'outbound', now()) returning id`;
  await admin`insert into call_result_receipts (tenant_id, event_id, call_id, provider, provider_call_id, payload_hash)
    values (${t}, gen_random_uuid(), ${call.id}, 'elevenlabs', ${`call-${key}`}, ${'0'.repeat(64)})`;
  await admin`insert into contact_decisions (tenant_id, event_id, contact_id, payload, payload_hash)
    values (${t}, gen_random_uuid(), ${contact.id}, '{}', ${'0'.repeat(64)})`;
  await admin`insert into messages (tenant_id, contact_id, channel, direction, actor_type, from_address, to_address, status)
    values (${t}, ${contact.id}, 'sms', 'outbound', 'alex', '+15555550100', ${`+1555555010${n}`}, 'sent')`;
  await admin`insert into email_suppressions (tenant_id, address, reason) values (${t}, ${`bounced-${key}@example.test`}, 'bounced')`;
  await admin`insert into consents (tenant_id, contact_id, channel, kind, source) values (${t}, ${contact.id}, 'sms', 'express_written', 'form')`;
  await admin`insert into dnc_entries (tenant_id, e164, source) values (${t}, ${`+1555555019${n}`}, 'staff')`;
  await admin`insert into webhook_events (source, external_id, tenant_id, payload) values ('fake', ${`evt-${key}`}, ${t}, '{}')`;
  await admin`insert into integrations (tenant_id, kind) values (${t}, 'voice')`;
  await admin`insert into phone_numbers (tenant_id, e164, provider, provider_sid, purpose) values (${t}, ${`+1555555000${n}`}, 'twilio', ${`PN${n}`}, 'sms')`;
  await admin`insert into alex_configs (tenant_id, provider) values (${t}, 'fake')`;
  await admin`insert into alex_prompts (tenant_id, version, body, is_active) values (${t}, 1, 'prompt', true)`;
  await admin`insert into service_tokens (tenant_id, prefix, key_hash, label) values (${t}, ${`pfx_${key}`}, 'hash', 'n8n')`;
  await admin`insert into appointments (tenant_id, contact_id, deal_id, starts_at, ends_at, booked_by)
    values (${t}, ${contact.id}, ${deal.id}, now() + interval '1 day', now() + interval '1 day 1 hour', 'alex')`;
  await admin`insert into metrics_daily (tenant_id, day) values (${t}, current_date)`;
  await admin`insert into reports (tenant_id, kind, period_start, status) values (${t}, 'monthly_roi', date '2026-09-01', 'ready')`;
  await admin`insert into reactivation_batches (tenant_id, audience_filter, status) values (${t}, '{}', 'completed')`;
  await admin`insert into presence_items (tenant_id, kind, title, status) values (${t}, 'profile', ${`Profile ${key}`}, 'planned')`;
  await admin`insert into review_snapshots (tenant_id, source, captured_on, review_count, average_rating) values (${t}, 'Google', date '2020-01-01', 1, 4.00)`;
  const [auto] =
    await admin`insert into automations (tenant_id, kind, template_key, name) values (${t}, 'template', 'speed_to_lead', 'Speed to lead') returning id`;
  await admin`insert into automation_steps (tenant_id, automation_id, position, channel) values (${t}, ${auto.id}, 1, 'sms')`;
  await admin`insert into automation_runs (tenant_id, automation_id, contact_id, next_run_at) values (${t}, ${auto.id}, ${contact.id}, now())`;
  await admin`insert into notifications (tenant_id, kind, title) values (${t}, 'new_lead', 'New lead')`;
  await admin`insert into tags (tenant_id, name) values (${t}, 'VIP')`;
  await admin`insert into support_requests (tenant_id, subject, body, submitted_by) values (${t}, 'Fixture request', 'Synthetic support request.', ${owner})`;
  await admin`insert into system_requests (tenant_id, module_key, requested_by) values (${t}, 'quote_followup', ${owner})`;
  await admin`insert into notification_preferences (tenant_id, user_id, kind, email_enabled) values (${t}, ${owner}, 'booked', false)`;
  const [batch] =
    await admin`insert into import_batches (tenant_id, entity, imported_source, file_name, file_type) values (${t}, 'contact', 'csv_other', 'x.csv', 'csv') returning id`;
  await admin`insert into import_batch_records (tenant_id, batch_id, entity, record_id, action) values (${t}, ${batch.id}, 'contact', ${contact.id}, 'created')`;

  return {
    tenantId: t,
    contactId: contact.id,
    dealId: deal.id,
    pipelineId: pipeline.id,
    stageId: stage.id,
    automationId: auto.id
  };
}
