import type { Kysely } from 'kysely';
import type {
  FullSynchronizeFunction,
  PartialSynchronizeFunction,
  SynchronizeOptions,
} from './types';
import type { Db } from '@/data/db';
import type { Email, Label } from '@/data/entities';
import { createErrorResult, createResult, type Result } from '@/utils/result';

export function processSynchronizer(
  db: Kysely<Db>,
  fullSynchronizer: FullSynchronizeFunction,
  partialSynchronizer: PartialSynchronizeFunction,
  options?: Partial<SynchronizeOptions>,
) {
  let syncResult: ReturnType<FullSynchronizeFunction> | ReturnType<PartialSynchronizeFunction>;
  process(db, fullSynchronizer, partialSynchronizer, enrichSynchronizeOptions(db, options)).then(
    (result) => {
      syncResult = result;
    },
  );
  return {
    stop() {
      syncResult?.stop();
    },
  };
}

async function process(
  db: Kysely<Db>,
  fullSynchronizer: FullSynchronizeFunction,
  partialSynchronizer: PartialSynchronizeFunction,
  options: SynchronizeOptions,
) {
  const partialSyncMarker = await getPartialSyncMarker(db);
  if (partialSyncMarker) return partialSynchronizer(partialSyncMarker, options);
  return fullSynchronizer(options);
}

async function getPartialSyncMarker(db: Kysely<Db>): Promise<unknown | null> {
  const record = await db
    .selectFrom('synchronization_data')
    .selectAll()
    .where('key', '=', 'partial_sync_marker')
    .executeTakeFirst();

  if (record) {
    return JSON.parse(record.value);
  }

  return null;
}

function enrichSynchronizeOptions(
  db: Kysely<Db>,
  options?: Partial<SynchronizeOptions>,
): SynchronizeOptions {
  return {
    ...options,
    onLabelsFetched: async (labels) => {
      const res = await upsertLabels(db, labels);
      if (res.hasError()) return res;
      if (!options?.onLabelsFetched) return res;
      return options?.onLabelsFetched?.(labels);
    },
    onComplete: async (partialSyncMarker) => {
      await setPartialSyncMarker(db, partialSyncMarker);
      options?.onComplete?.(partialSyncMarker);
    },
    onEmailCreated: async (emails) => {
      const res = await insertEmail(db, emails);
      if (res.hasError()) return res;
      if (!options?.onEmailCreated) return res;
      return options.onEmailCreated(emails);
    },
    onEmailDeleted: async (emailIds) => {
      const res = await deleteEmail(db, emailIds);
      if (res.hasError()) return res;
      if (!options?.onEmailDeleted) return createResult<void>(void 0);
      return options?.onEmailDeleted?.(emailIds);
    },
    onEmailLabelAdded: async (emailId, labelIds) => {
      const res = await addLabelsToEmail(db, [{ id: emailId, labelIds }]);
      if (res.hasError()) return res;
      if (!options?.onEmailLabelAdded) return createResult<void>(void 0);
      return options?.onEmailLabelAdded?.(emailId, labelIds);
    },
    onEmailLabelRemoved: async (emailId, labelIds) => {
      const res = await removeLabelsFromEmail(db, emailId, labelIds);
      if (res.hasError()) return res;
      if (!options?.onEmailLabelRemoved) return createResult<void>(void 0);
      return options?.onEmailLabelRemoved?.(emailId, labelIds);
    },
  };
}

async function upsertLabels(db: Kysely<Db>, labels: Label[]): Promise<Result<void>> {
  try {
    await db
      .insertInto('labels')
      .values(
        labels.map((label) => ({
          id: label.id,
          name: label.name,
          type: label.type,
        })),
      )
      .onConflict((oc) =>
        oc.column('id').doUpdateSet((ed) => ({
          name: ed.ref('excluded.name'),
          type: ed.ref('excluded.type'),
        })),
      )
      .execute();
  } catch (e) {
    return createErrorResult<void>(e as Error);
  }
  return createResult<void>(void 0);
}

async function insertEmail(db: Kysely<Db>, emails: Email[]) {
  try {
    await db
      .insertInto('emails')
      .values(
        emails.map((email) => ({
          id: email.id,
          subject: email.subject,
          body: email.body,
          sender: email.sender,
          recipient: email.recipient,
          cc: email.cc,
          sent_at: email.sentAt,
          history_id: email.historyId,
          thread_id: email.threadId,
        })),
      )
      .execute();
  } catch (e) {
    return createErrorResult<void>(e as Error);
  }
  return await addLabelsToEmail(db, emails);
}

async function setPartialSyncMarker(db: Kysely<Db>, marker: unknown) {
  const key = 'partial_sync_marker';
  const value = JSON.stringify(marker);
  try {
    await db
      .insertInto('synchronization_data')
      .values({
        key,
        value,
      })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value }))
      .execute();
  } catch (e) {
    return createErrorResult<void>(e as Error);
  }
  return createResult<void>(void 0);
}

async function deleteEmail(db: Kysely<Db>, emailIds: string[]) {
  try {
    await db.deleteFrom('email_labels').where('email_id', 'in', emailIds).execute();
    await db.deleteFrom('emails').where('id', 'in', emailIds).execute();
  } catch (e) {
    return createErrorResult<void>(e as Error);
  }
  return createResult<void>(void 0);
}

async function addLabelsToEmail(db: Kysely<Db>, emails: { id: string; labelIds: string[] }[]) {
  try {
    await db
      .insertInto('email_labels')
      .values(
        emails.flatMap((email) =>
          email.labelIds.map((labelId) => ({
            email_id: email.id,
            label_id: labelId,
          })),
        ),
      )
      .onConflict((oc) => oc.columns(['email_id', 'label_id']).doNothing())
      .execute();
  } catch (e) {
    return createErrorResult<void>(e as Error);
  }
  return createResult<void>(void 0);
}

async function removeLabelsFromEmail(db: Kysely<Db>, emailId: string, labelIds: string[]) {
  try {
    await db
      .deleteFrom('email_labels')
      .where('email_id', '=', emailId)
      .where('label_id', 'in', labelIds)
      .execute();
  } catch (e) {
    return createErrorResult<void>(e as Error);
  }
  return createResult<void>(void 0);
}
