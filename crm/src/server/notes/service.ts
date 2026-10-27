import { and, asc, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { recordActivity } from '../activity';
import { audit } from '../audit';
import type { Db, Tx } from '../db/client';
import { companies, contacts, deals, memberships, noteMentions, notes, users } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { requireModule } from '../modules';
import { notify, type EnqueueEmail } from '../notifications';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput, uuidSchema } from '../validation';
import {
  createNoteSchema,
  listNotesSchema,
  updateNoteSchema,
  type CreateNoteInput,
  type ListNotesInput,
  type UpdateNoteInput
} from './schemas';
import { mentionedIds, noteText, sanitizeNoteHtml } from './sanitize';

// Notes service (M3-03; PRD F-22; DATABASE notes, note_mentions). Rich-text notes on a contact,
// company or deal, with @mentions and a pin. CRM Lite surface, so every function starts with
// requireModule('crm'). Every function runs through withTenant (RLS is the last line of tenant
// isolation and a read-only view-as session cannot write); pass `tx` to join a caller's transaction.
// The editor sends HTML, which is sanitized on save and again on read (SECURITY section 5).

export type NoteOpts = { db?: Db; tx?: Tx; enqueueEmail?: EnqueueEmail };

export type NoteView = {
  id: string;
  /** Sanitized HTML, safe for the one audited rich-text component. */
  html: string;
  text: string;
  pinned: boolean;
  author: { id: string; name: string | null } | null;
  contactId: string | null;
  companyId: string | null;
  dealId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Teammate = { id: string; name: string };

const EXCERPT = 140;

function run<T>(ctx: TenantContextInput, opts: NoteOpts, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return opts.tx ? fn(opts.tx) : withTenant(ctx, fn, { db: opts.db });
}

const notFound = () => new AppError('NOT_FOUND');
const noteSelect = {
  id: notes.id,
  bodyJson: notes.bodyJson,
  bodyText: notes.bodyText,
  pinned: notes.pinned,
  authorId: notes.authorId,
  authorName: users.name,
  contactId: notes.contactId,
  companyId: notes.companyId,
  dealId: notes.dealId,
  createdAt: notes.createdAt,
  updatedAt: notes.updatedAt
};

function toView(r: {
  id: string;
  bodyJson: unknown;
  bodyText: string;
  pinned: boolean;
  authorId: string | null;
  authorName: string | null;
  contactId: string | null;
  companyId: string | null;
  dealId: string | null;
  createdAt: string;
  updatedAt: string;
}): NoteView {
  const stored = (r.bodyJson as { html?: unknown } | null)?.html;
  // Sanitized again on read: a row written by any other path must not reach the page unclean.
  const html = sanitizeNoteHtml(typeof stored === 'string' ? stored : '');
  return {
    id: r.id,
    html,
    text: r.bodyText,
    pinned: r.pinned,
    author: r.authorId ? { id: r.authorId, name: r.authorName } : null,
    contactId: r.contactId,
    companyId: r.companyId,
    dealId: r.dealId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  };
}

/** The tenant's members, who are the only people a note can mention. */
async function members(tx: Tx, ids?: string[]): Promise<Teammate[]> {
  const rows = await tx
    .select({ id: memberships.userId, name: users.name, email: users.email })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(ids ? inArray(memberships.userId, ids) : undefined)
    .orderBy(asc(users.name), asc(users.email));
  return rows.map((r) => ({ id: r.id, name: r.name ?? r.email }));
}

/** Teammates for the @mention menu. Tenant members only (SECURITY section 2). */
export async function listTeammates(ctx: TenantContextInput, opts: NoteOpts = {}) {
  await requireModule(ctx, 'crm', { db: opts.db });
  return run(ctx, opts, (tx) => members(tx));
}

/** Sanitizes the editor HTML and resolves its mentions to members of this tenant. */
async function prepare(tx: Tx, rawHtml: string) {
  const candidates = mentionedIds(sanitizeNoteHtml(rawHtml));
  const valid = new Set(candidates.length ? (await members(tx, candidates)).map((m) => m.id) : []);
  const html = sanitizeNoteHtml(rawHtml, valid);
  const text = noteText(html);
  if (!text) throw new ValidationError({ html: ['required'] });
  return { html, text, mentions: mentionedIds(html) };
}

async function assertParent(
  tx: Tx,
  v: { contactId?: string; companyId?: string; dealId?: string }
) {
  const find = async (
    table: typeof contacts | typeof companies | typeof deals,
    id: string,
    field: string
  ) => {
    const [row] = await tx
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.id, id), isNull(table.deletedAt)))
      .limit(1);
    if (!row) throw new ValidationError({ [field]: ['not_found'] });
  };
  if (v.contactId) await find(contacts, v.contactId, 'contactId');
  else if (v.companyId) await find(companies, v.companyId, 'companyId');
  else if (v.dealId) await find(deals, v.dealId, 'dealId');
}

function parentLink(n: {
  contactId?: string | null;
  companyId?: string | null;
  dealId?: string | null;
}) {
  if (n.contactId) return `/dashboard/contacts/${n.contactId}#notes`;
  if (n.companyId) return `/dashboard/companies/${n.companyId}#notes`;
  return `/dashboard/deals/${n.dealId}#notes`;
}

async function authorName(tx: Tx, userId: string | undefined): Promise<string> {
  if (!userId) return 'A teammate';
  const [u] = await tx
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u?.name ?? u?.email ?? 'A teammate';
}

/** One notification per newly mentioned teammate. Mentioning yourself does not notify you. */
async function notifyMentions(
  tx: Tx,
  ctx: TenantContextInput,
  note: { id: string; contactId: string | null; companyId: string | null; dealId: string | null },
  userIds: string[],
  text: string,
  enqueueEmail?: EnqueueEmail
) {
  const targets = userIds.filter((id) => id !== ctx.userId);
  if (!targets.length) return;
  const who = await authorName(tx, ctx.userId);
  for (const userId of targets) {
    await notify(
      tx,
      {
        userId,
        type: 'mention',
        title: `${who} mentioned you in a note`,
        body: text.length > EXCERPT ? `${text.slice(0, EXCERPT - 1)}…` : text,
        link: parentLink(note)
      },
      { enqueueEmail }
    );
  }
}

export async function createNote(
  ctx: TenantContextInput,
  input: CreateNoteInput,
  opts: NoteOpts = {}
): Promise<NoteView> {
  const v = parseInput(createNoteSchema, input);
  await requireModule(ctx, 'crm', { db: opts.db });
  return run(ctx, opts, async (tx) => {
    await assertParent(tx, v);
    const p = await prepare(tx, v.html);
    const [row] = await tx
      .insert(notes)
      .values({
        tenantId: sql`app_tenant_id()` as unknown as string,
        bodyText: p.text,
        bodyJson: { html: p.html },
        pinned: v.pinned,
        authorId: ctx.userId ?? null,
        contactId: v.contactId ?? null,
        companyId: v.companyId ?? null,
        dealId: v.dealId ?? null
      })
      .returning();
    if (p.mentions.length) {
      await tx
        .insert(noteMentions)
        .values(p.mentions.map((userId) => ({ tenantId: row.tenantId, noteId: row.id, userId })));
    }
    await recordActivity(tx, {
      contactId: row.contactId,
      companyId: row.companyId,
      dealId: row.dealId,
      type: 'note',
      refTable: 'notes',
      refId: row.id,
      summary: 'Note added',
      actor: { type: ctx.userId ? 'user' : 'system', id: ctx.userId }
    });
    await notifyMentions(tx, ctx, row, p.mentions, p.text, opts.enqueueEmail);
    await audit(tx, {
      action: 'note.create',
      entity: 'note',
      entityId: row.id,
      after: { pinned: row.pinned, mentions: p.mentions.length }
    });
    return getView(tx, row.id);
  });
}

async function getView(tx: Tx, id: string): Promise<NoteView> {
  const [row] = await tx
    .select(noteSelect)
    .from(notes)
    .leftJoin(users, eq(users.id, notes.authorId))
    .where(and(eq(notes.id, id), isNull(notes.deletedAt)))
    .limit(1);
  if (!row) throw notFound();
  return toView(row);
}

/** Locks the live note; the author or an owner (or Kynetic admin in a write session) may change it. */
async function loadForWrite(tx: Tx, ctx: TenantContextInput, id: string, contentChange: boolean) {
  parseInput(uuidSchema, id);
  const [row] = await tx
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), isNull(notes.deletedAt)))
    .for('update')
    .limit(1);
  if (!row) throw notFound();
  const isAuthor = Boolean(ctx.userId) && row.authorId === ctx.userId;
  const privileged = ctx.role === 'owner' || ctx.role === 'admin';
  // Pinning is shared housekeeping any member may do; changing or removing the text is not.
  if (contentChange && !isAuthor && !privileged) throw new AppError('FORBIDDEN');
  return row;
}

export async function updateNote(
  ctx: TenantContextInput,
  id: string,
  patch: UpdateNoteInput,
  opts: NoteOpts = {}
): Promise<NoteView> {
  const v = parseInput(updateNoteSchema, patch);
  await requireModule(ctx, 'crm', { db: opts.db });
  return run(ctx, opts, async (tx) => {
    const before = await loadForWrite(tx, ctx, id, v.html !== undefined);
    const set: Partial<typeof notes.$inferInsert> = { updatedAt: sql`now()` as unknown as string };
    if (v.pinned !== undefined) set.pinned = v.pinned;
    if (v.html !== undefined) {
      const p = await prepare(tx, v.html);
      set.bodyText = p.text;
      set.bodyJson = { html: p.html };
      // Only people added by this edit are notified; those already mentioned are not pinged again.
      const existing = await tx
        .select({ userId: noteMentions.userId })
        .from(noteMentions)
        .where(eq(noteMentions.noteId, id));
      const had = new Set(existing.map((e) => e.userId));
      const gone = [...had].filter((u) => !p.mentions.includes(u));
      if (gone.length) {
        await tx
          .delete(noteMentions)
          .where(and(eq(noteMentions.noteId, id), inArray(noteMentions.userId, gone)));
      }
      const added = p.mentions.filter((u) => !had.has(u));
      if (added.length) {
        await tx
          .insert(noteMentions)
          .values(added.map((userId) => ({ tenantId: before.tenantId, noteId: id, userId })));
        await notifyMentions(tx, ctx, before, added, p.text, opts.enqueueEmail);
      }
    }
    await tx.update(notes).set(set).where(eq(notes.id, id));
    await audit(tx, {
      action: 'note.update',
      entity: 'note',
      entityId: id,
      before: { pinned: before.pinned },
      after: { pinned: v.pinned ?? before.pinned, edited: v.html !== undefined }
    });
    return getView(tx, id);
  });
}

export const setNotePinned = (
  ctx: TenantContextInput,
  id: string,
  pinned: boolean,
  opts: NoteOpts = {}
) => updateNote(ctx, id, { pinned }, opts);

/** Soft delete (DATABASE: notes are kept until deleted, then hidden). */
export async function deleteNote(
  ctx: TenantContextInput,
  id: string,
  opts: NoteOpts = {}
): Promise<void> {
  await requireModule(ctx, 'crm', { db: opts.db });
  await run(ctx, opts, async (tx) => {
    await loadForWrite(tx, ctx, id, true);
    await tx
      .update(notes)
      .set({ deletedAt: sql`now()` as unknown as string })
      .where(eq(notes.id, id));
    await audit(tx, { action: 'note.delete', entity: 'note', entityId: id });
  });
}

/** Pinned notes first, then newest first. */
export async function listNotes(
  ctx: TenantContextInput,
  input: ListNotesInput,
  opts: NoteOpts = {}
): Promise<NoteView[]> {
  const v = parseInput(listNotesSchema, input);
  await requireModule(ctx, 'crm', { db: opts.db });
  const parent: SQL = v.contactId
    ? eq(notes.contactId, v.contactId)
    : v.companyId
      ? eq(notes.companyId, v.companyId)
      : eq(notes.dealId, v.dealId!);
  return run(ctx, opts, async (tx) => {
    const rows = await tx
      .select(noteSelect)
      .from(notes)
      .leftJoin(users, eq(users.id, notes.authorId))
      .where(and(parent, isNull(notes.deletedAt)))
      .orderBy(desc(notes.pinned), desc(notes.createdAt), desc(notes.id))
      .limit(v.limit);
    return rows.map(toView);
  });
}
