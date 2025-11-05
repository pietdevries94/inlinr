import type { Kysely } from 'kysely';
import type { Db } from '@/data/db';
import type { Email, Label } from '@/data/entities';
import type { SynchronizerDataStore } from '../types';
import { createErrorResult, createResult, type Result } from '@/utils/result';

export type KyselyDataStore = SynchronizerDataStore;

export function createKyselyDataStore(db: Kysely<Db>): KyselyDataStore {
	async function getPartialSyncMarker(): Promise<string> {
		try {
			const record = await db
				.selectFrom('emails')
				.limit(1)
				.select('history_id')
				.orderBy('sent_at', 'desc')
				.executeTakeFirst();

			if (record) {
				return record.history_id;
			}
		} catch {
			return '0';
		}

		return '0';
	}

	async function isFullSyncCompleted(): Promise<boolean> {
		const record = await db
			.selectFrom('synchronization_data')
			.selectAll()
			.where('key', '=', 'full_sync_completed')
			.executeTakeFirst();

		if (record) {
			return JSON.parse(record.value);
		}

		return false;
	}

	async function setFullSyncCompleted(): Promise<Result<void>> {
		const key = 'full_sync_completed';
		const value = JSON.stringify(true);
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

	async function upsertLabels(labels: Label[]): Promise<Result<void>> {
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

	async function insertEmails(emails: Email[]): Promise<Result<void>> {
		return await db.transaction().execute(async (tx) => {
			try {
				await tx
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
			return await addLabelsToEmailsInternal(tx, emails);
		});
	}

	async function deleteEmails(emailIds: string[]): Promise<Result<void>> {
		try {
			await db.deleteFrom('email_labels').where('email_id', 'in', emailIds).execute();
			await db.deleteFrom('emails').where('id', 'in', emailIds).execute();
		} catch (e) {
			return createErrorResult<void>(e as Error);
		}
		return createResult<void>(void 0);
	}

	async function addLabelsToEmail(emailId: string, labelIds: string[]): Promise<Result<void>> {
		return await addLabelsToEmailsInternal(db, [{ id: emailId, labelIds }]);
	}

	async function removeLabelsFromEmail(emailId: string, labelIds: string[]): Promise<Result<void>> {
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

	async function getExistingMessageIds(): Promise<Set<string>> {
		const rows = await db.selectFrom('emails').select('id').execute();
		return new Set(rows.map((row) => row.id));
	}

	async function addLabelsToEmailsInternal(
		dbInstance: Kysely<Db>,
		emails: { id: string; labelIds: string[] }[],
	): Promise<Result<void>> {
		try {
			await dbInstance
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

	return {
		getPartialSyncMarker,
		isFullSyncCompleted,
		setFullSyncCompleted,
		upsertLabels,
		insertEmails,
		deleteEmails,
		addLabelsToEmail,
		removeLabelsFromEmail,
		getExistingMessageIds,
	};
}
