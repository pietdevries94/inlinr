import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createKyselyDataStore, type KyselyDataStore } from './kyselyDataStore';
import { PGlite } from '@electric-sql/pglite';
import { createKyselyDb } from '@/data/db';
import type { Kysely } from 'kysely';
import type { Db } from '@/data/db';
import type { Email, Label } from '@/data/entities';

describe('KyselyDataStore', () => {
	let db: Kysely<Db>;
	let pglite: PGlite;
	let dataStore: KyselyDataStore;

	beforeEach(async () => {
		// Create in-memory database
		pglite = new PGlite();
		db = await createKyselyDb(pglite);
		dataStore = createKyselyDataStore(db);
	});

	afterEach(async () => {
		try {
			await pglite.close();
		} catch {
			// Ignore cleanup errors
		}
	});

	describe('getPartialSyncMarker', () => {
		it('should return "0" when no emails exist', async () => {
			const marker = await dataStore.getPartialSyncMarker();
			expect(marker).toBe('0');
		});

		it('should return history_id of most recent email', async () => {
			const oldDate = new Date('2023-01-01');
			const newDate = new Date('2023-01-02');

			await db
				.insertInto('emails')
				.values([
					{
						id: 'email1',
						subject: 'Old Email',
						body: 'Body',
						sender: 'sender@test.com',
						recipient: 'recipient@test.com',
						cc: '',
						sent_at: oldDate,
						history_id: '100',
						thread_id: 'thread1',
					},
					{
						id: 'email2',
						subject: 'New Email',
						body: 'Body',
						sender: 'sender@test.com',
						recipient: 'recipient@test.com',
						cc: '',
						sent_at: newDate,
						history_id: '200',
						thread_id: 'thread2',
					},
				])
				.execute();

			const marker = await dataStore.getPartialSyncMarker();
			expect(marker).toBe('200');
		});

		it('should return "0" on database error', async () => {
			// Close the database to simulate an error
			await pglite.close();

			const marker = await dataStore.getPartialSyncMarker();
			expect(marker).toBe('0');
		});
	});

	describe('isFullSyncCompleted', () => {
		it('should return false when no synchronization data exists', async () => {
			const isCompleted = await dataStore.isFullSyncCompleted();
			expect(isCompleted).toBe(false);
		});

		it('should return true when full sync is marked as completed', async () => {
			await db
				.insertInto('synchronization_data')
				.values({ key: 'full_sync_completed', value: 'true' })
				.execute();

			const isCompleted = await dataStore.isFullSyncCompleted();
			expect(isCompleted).toBe(true);
		});

		it('should return false when full sync is marked as not completed', async () => {
			await db
				.insertInto('synchronization_data')
				.values({ key: 'full_sync_completed', value: 'false' })
				.execute();

			const isCompleted = await dataStore.isFullSyncCompleted();
			expect(isCompleted).toBe(false);
		});
	});

	describe('setFullSyncCompleted', () => {
		it('should set full sync as completed', async () => {
			const result = await dataStore.setFullSyncCompleted();
			expect(result.hasError()).toBe(false);

			const record = await db
				.selectFrom('synchronization_data')
				.selectAll()
				.where('key', '=', 'full_sync_completed')
				.executeTakeFirst();

			expect(record).toBeDefined();
			expect(JSON.parse(record!.value)).toBe(true);
		});

		it('should update existing record if it already exists', async () => {
			// Insert initial record
			await db
				.insertInto('synchronization_data')
				.values({ key: 'full_sync_completed', value: 'false' })
				.execute();

			const result = await dataStore.setFullSyncCompleted();
			expect(result.hasError()).toBe(false);

			const record = await db
				.selectFrom('synchronization_data')
				.selectAll()
				.where('key', '=', 'full_sync_completed')
				.executeTakeFirst();

			expect(record).toBeDefined();
			expect(JSON.parse(record!.value)).toBe(true);
		});
	});

	describe('upsertLabels', () => {
		it('should insert new labels', async () => {
			const labels: Label[] = [
				{ id: 'label1', name: 'Important', type: 'user' },
				{ id: 'label2', name: 'Work', type: 'user' },
			];

			const result = await dataStore.upsertLabels(labels);
			expect(result.hasError()).toBe(false);

			const storedLabels = await db.selectFrom('labels').selectAll().execute();
			expect(storedLabels).toHaveLength(2);
			expect(storedLabels).toEqual(
				expect.arrayContaining([
					{ id: 'label1', name: 'Important', type: 'user' },
					{ id: 'label2', name: 'Work', type: 'user' },
				]),
			);
		});

		it('should update existing labels', async () => {
			// Insert initial label
			await db
				.insertInto('labels')
				.values({ id: 'label1', name: 'Old Name', type: 'user' })
				.execute();

			const updatedLabels: Label[] = [{ id: 'label1', name: 'New Name', type: 'system' }];

			const result = await dataStore.upsertLabels(updatedLabels);
			expect(result.hasError()).toBe(false);

			const storedLabel = await db
				.selectFrom('labels')
				.selectAll()
				.where('id', '=', 'label1')
				.executeTakeFirst();

			expect(storedLabel).toEqual({
				id: 'label1',
				name: 'New Name',
				type: 'system',
			});
		});
	});

	describe('insertEmails', () => {
		it('should insert emails with labels', async () => {
			// First insert labels
			await db
				.insertInto('labels')
				.values([
					{ id: 'label1', name: 'Important', type: 'user' },
					{ id: 'label2', name: 'Work', type: 'user' },
				])
				.execute();

			const emails: Email[] = [
				{
					id: 'email1',
					subject: 'Test Email',
					body: 'Test Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sentAt: new Date('2023-01-01'),
					historyId: '123',
					threadId: 'thread1',
					labelIds: ['label1', 'label2'],
				},
			];

			const result = await dataStore.insertEmails(emails);
			expect(result.hasError()).toBe(false);

			const storedEmail = await db
				.selectFrom('emails')
				.selectAll()
				.where('id', '=', 'email1')
				.executeTakeFirst();

			expect(storedEmail).toBeDefined();
			expect(storedEmail!.subject).toBe('Test Email');

			const emailLabels = await db
				.selectFrom('email_labels')
				.selectAll()
				.where('email_id', '=', 'email1')
				.execute();

			expect(emailLabels).toHaveLength(2);
			expect(emailLabels.map((el) => el.label_id)).toEqual(
				expect.arrayContaining(['label1', 'label2']),
			);
		});
	});

	describe('deleteEmails', () => {
		it('should delete emails and their label associations', async () => {
			// Setup: insert labels first
			await db
				.insertInto('labels')
				.values([
					{ id: 'label1', name: 'Important', type: 'user' },
					{ id: 'label2', name: 'Work', type: 'user' },
				])
				.execute();

			// Setup: insert email and labels
			await db
				.insertInto('emails')
				.values({
					id: 'email1',
					subject: 'Test',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sent_at: new Date(),
					history_id: '123',
					thread_id: 'thread1',
				})
				.execute();

			await db
				.insertInto('email_labels')
				.values([
					{ email_id: 'email1', label_id: 'label1' },
					{ email_id: 'email1', label_id: 'label2' },
				])
				.execute();

			const result = await dataStore.deleteEmails(['email1']);
			expect(result.hasError()).toBe(false);

			const remainingEmails = await db
				.selectFrom('emails')
				.selectAll()
				.where('id', '=', 'email1')
				.execute();

			const remainingLabels = await db
				.selectFrom('email_labels')
				.selectAll()
				.where('email_id', '=', 'email1')
				.execute();

			expect(remainingEmails).toHaveLength(0);
			expect(remainingLabels).toHaveLength(0);
		});
	});

	describe('addLabelsToEmail', () => {
		it('should add labels to an email', async () => {
			// Setup: insert labels first
			await db
				.insertInto('labels')
				.values([
					{ id: 'label1', name: 'Important', type: 'user' },
					{ id: 'label2', name: 'Work', type: 'user' },
				])
				.execute();

			// Setup: insert email
			await db
				.insertInto('emails')
				.values({
					id: 'email1',
					subject: 'Test',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sent_at: new Date(),
					history_id: '123',
					thread_id: 'thread1',
				})
				.execute();

			const result = await dataStore.addLabelsToEmail('email1', ['label1', 'label2']);
			expect(result.hasError()).toBe(false);

			const emailLabels = await db
				.selectFrom('email_labels')
				.selectAll()
				.where('email_id', '=', 'email1')
				.execute();

			expect(emailLabels).toHaveLength(2);
			expect(emailLabels.map((el) => el.label_id)).toEqual(
				expect.arrayContaining(['label1', 'label2']),
			);
		});

		it('should not create duplicate label associations', async () => {
			// Setup: insert labels first
			await db
				.insertInto('labels')
				.values([{ id: 'label1', name: 'Important', type: 'user' }])
				.execute();

			// Setup: insert email
			await db
				.insertInto('emails')
				.values({
					id: 'email1',
					subject: 'Test',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sent_at: new Date(),
					history_id: '123',
					thread_id: 'thread1',
				})
				.execute();

			// Add labels twice
			await dataStore.addLabelsToEmail('email1', ['label1']);
			const result = await dataStore.addLabelsToEmail('email1', ['label1']);

			expect(result.hasError()).toBe(false);

			const emailLabels = await db
				.selectFrom('email_labels')
				.selectAll()
				.where('email_id', '=', 'email1')
				.execute();

			expect(emailLabels).toHaveLength(1);
		});
	});

	describe('removeLabelsFromEmail', () => {
		it('should remove labels from an email', async () => {
			// Setup: insert labels first
			await db
				.insertInto('labels')
				.values([
					{ id: 'label1', name: 'Important', type: 'user' },
					{ id: 'label2', name: 'Work', type: 'user' },
					{ id: 'label3', name: 'Personal', type: 'user' },
				])
				.execute();

			// Setup: insert email and labels
			await db
				.insertInto('emails')
				.values({
					id: 'email1',
					subject: 'Test',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sent_at: new Date(),
					history_id: '123',
					thread_id: 'thread1',
				})
				.execute();

			await db
				.insertInto('email_labels')
				.values([
					{ email_id: 'email1', label_id: 'label1' },
					{ email_id: 'email1', label_id: 'label2' },
					{ email_id: 'email1', label_id: 'label3' },
				])
				.execute();

			const result = await dataStore.removeLabelsFromEmail('email1', ['label1', 'label2']);
			expect(result.hasError()).toBe(false);

			const remainingLabels = await db
				.selectFrom('email_labels')
				.selectAll()
				.where('email_id', '=', 'email1')
				.execute();

			expect(remainingLabels).toHaveLength(1);
			expect(remainingLabels[0]!.label_id).toBe('label3');
		});
	});

	describe('getExistingMessageIds', () => {
		it('should return empty set when no emails exist', async () => {
			const messageIds = await dataStore.getExistingMessageIds();
			expect(messageIds.size).toBe(0);
		});

		it('should return all email IDs', async () => {
			await db
				.insertInto('emails')
				.values([
					{
						id: 'email1',
						subject: 'Test 1',
						body: 'Body',
						sender: 'sender@test.com',
						recipient: 'recipient@test.com',
						cc: '',
						sent_at: new Date(),
						history_id: '123',
						thread_id: 'thread1',
					},
					{
						id: 'email2',
						subject: 'Test 2',
						body: 'Body',
						sender: 'sender@test.com',
						recipient: 'recipient@test.com',
						cc: '',
						sent_at: new Date(),
						history_id: '124',
						thread_id: 'thread2',
					},
				])
				.execute();

			const messageIds = await dataStore.getExistingMessageIds();
			expect(messageIds.size).toBe(2);
			expect(messageIds.has('email1')).toBe(true);
			expect(messageIds.has('email2')).toBe(true);
		});
	});
});
