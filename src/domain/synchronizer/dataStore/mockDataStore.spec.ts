import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDataStore, type MockDataStore } from './mockDataStore';
import type { Email, Label } from '@/data/entities';

describe('MockDataStore', () => {
	let dataStore: MockDataStore;

	beforeEach(() => {
		dataStore = createMockDataStore();
	});

	describe('getPartialSyncMarker', () => {
		it('should return "0" when no emails exist', async () => {
			const marker = await dataStore.getPartialSyncMarker();
			expect(marker).toBe('0');
		});

		it('should return history_id of most recent email', async () => {
			const oldDate = new Date('2023-01-01');
			const newDate = new Date('2023-01-02');

			const emails: Email[] = [
				{
					id: 'email1',
					subject: 'Old Email',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sentAt: oldDate,
					historyId: '100',
					threadId: 'thread1',
					labelIds: [],
				},
				{
					id: 'email2',
					subject: 'New Email',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sentAt: newDate,
					historyId: '200',
					threadId: 'thread2',
					labelIds: [],
				},
			];

			await dataStore.insertEmails(emails);

			const marker = await dataStore.getPartialSyncMarker();
			expect(marker).toBe('200');
		});
	});

	describe('isFullSyncCompleted', () => {
		it('should return false initially', async () => {
			const isCompleted = await dataStore.isFullSyncCompleted();
			expect(isCompleted).toBe(false);
		});

		it('should return true after setFullSyncCompleted is called', async () => {
			await dataStore.setFullSyncCompleted();
			const isCompleted = await dataStore.isFullSyncCompleted();
			expect(isCompleted).toBe(true);
		});
	});

	describe('setFullSyncCompleted', () => {
		it('should mark full sync as completed', async () => {
			const result = await dataStore.setFullSyncCompleted();
			expect(result.hasError()).toBe(false);

			const isCompleted = await dataStore.isFullSyncCompleted();
			expect(isCompleted).toBe(true);
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

			expect(dataStore.getLabel('label1')).toEqual({
				id: 'label1',
				name: 'Important',
				type: 'user',
			});
			expect(dataStore.getLabel('label2')).toEqual({
				id: 'label2',
				name: 'Work',
				type: 'user',
			});
		});

		it('should update existing labels', async () => {
			const initialLabels: Label[] = [{ id: 'label1', name: 'Old Name', type: 'user' }];
			await dataStore.upsertLabels(initialLabels);

			const updatedLabels: Label[] = [{ id: 'label1', name: 'New Name', type: 'system' }];
			const result = await dataStore.upsertLabels(updatedLabels);
			expect(result.hasError()).toBe(false);

			expect(dataStore.getLabel('label1')).toEqual({
				id: 'label1',
				name: 'New Name',
				type: 'system',
			});
		});
	});

	describe('insertEmails', () => {
		it('should insert emails with labels', async () => {
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

			const storedEmail = dataStore.getEmail('email1');
			expect(storedEmail).toBeDefined();
			expect(storedEmail!.subject).toBe('Test Email');

			const emailLabels = dataStore.getEmailLabels('email1');
			expect(emailLabels.size).toBe(2);
			expect(emailLabels.has('label1')).toBe(true);
			expect(emailLabels.has('label2')).toBe(true);
		});

		it('should handle emails without labels', async () => {
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
					labelIds: [],
				},
			];

			const result = await dataStore.insertEmails(emails);
			expect(result.hasError()).toBe(false);

			const storedEmail = dataStore.getEmail('email1');
			expect(storedEmail).toBeDefined();

			const emailLabels = dataStore.getEmailLabels('email1');
			expect(emailLabels.size).toBe(0);
		});
	});

	describe('deleteEmails', () => {
		it('should delete emails and their label associations', async () => {
			// Setup: insert email with labels
			const emails: Email[] = [
				{
					id: 'email1',
					subject: 'Test',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sentAt: new Date(),
					historyId: '123',
					threadId: 'thread1',
					labelIds: ['label1', 'label2'],
				},
			];
			await dataStore.insertEmails(emails);

			const result = await dataStore.deleteEmails(['email1']);
			expect(result.hasError()).toBe(false);

			expect(dataStore.getEmail('email1')).toBeUndefined();
			expect(dataStore.getEmailLabels('email1').size).toBe(0);
		});

		it('should delete multiple emails', async () => {
			const emails: Email[] = [
				{
					id: 'email1',
					subject: 'Test 1',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sentAt: new Date(),
					historyId: '123',
					threadId: 'thread1',
					labelIds: ['label1'],
				},
				{
					id: 'email2',
					subject: 'Test 2',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sentAt: new Date(),
					historyId: '124',
					threadId: 'thread2',
					labelIds: ['label2'],
				},
			];
			await dataStore.insertEmails(emails);

			const result = await dataStore.deleteEmails(['email1', 'email2']);
			expect(result.hasError()).toBe(false);

			expect(dataStore.getEmail('email1')).toBeUndefined();
			expect(dataStore.getEmail('email2')).toBeUndefined();
		});
	});

	describe('addLabelsToEmail', () => {
		it('should add labels to an email', async () => {
			// Setup: insert email
			const emails: Email[] = [
				{
					id: 'email1',
					subject: 'Test',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sentAt: new Date(),
					historyId: '123',
					threadId: 'thread1',
					labelIds: [],
				},
			];
			await dataStore.insertEmails(emails);

			const result = await dataStore.addLabelsToEmail('email1', ['label1', 'label2']);
			expect(result.hasError()).toBe(false);

			const emailLabels = dataStore.getEmailLabels('email1');
			expect(emailLabels.size).toBe(2);
			expect(emailLabels.has('label1')).toBe(true);
			expect(emailLabels.has('label2')).toBe(true);
		});

		it('should add labels to existing label set', async () => {
			// Setup: insert email with initial labels
			const emails: Email[] = [
				{
					id: 'email1',
					subject: 'Test',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sentAt: new Date(),
					historyId: '123',
					threadId: 'thread1',
					labelIds: ['label1'],
				},
			];
			await dataStore.insertEmails(emails);

			const result = await dataStore.addLabelsToEmail('email1', ['label2', 'label3']);
			expect(result.hasError()).toBe(false);

			const emailLabels = dataStore.getEmailLabels('email1');
			expect(emailLabels.size).toBe(3);
			expect(emailLabels.has('label1')).toBe(true);
			expect(emailLabels.has('label2')).toBe(true);
			expect(emailLabels.has('label3')).toBe(true);
		});

		it('should handle non-existent email gracefully', async () => {
			const result = await dataStore.addLabelsToEmail('nonexistent', ['label1']);
			expect(result.hasError()).toBe(false);

			const emailLabels = dataStore.getEmailLabels('nonexistent');
			expect(emailLabels.has('label1')).toBe(true);
		});
	});

	describe('removeLabelsFromEmail', () => {
		it('should remove labels from an email', async () => {
			// Setup: insert email with labels
			const emails: Email[] = [
				{
					id: 'email1',
					subject: 'Test',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sentAt: new Date(),
					historyId: '123',
					threadId: 'thread1',
					labelIds: ['label1', 'label2', 'label3'],
				},
			];
			await dataStore.insertEmails(emails);

			const result = await dataStore.removeLabelsFromEmail('email1', ['label1', 'label2']);
			expect(result.hasError()).toBe(false);

			const emailLabels = dataStore.getEmailLabels('email1');
			expect(emailLabels.size).toBe(1);
			expect(emailLabels.has('label3')).toBe(true);
			expect(emailLabels.has('label1')).toBe(false);
			expect(emailLabels.has('label2')).toBe(false);
		});

		it('should remove all labels if all are specified', async () => {
			// Setup: insert email with labels
			const emails: Email[] = [
				{
					id: 'email1',
					subject: 'Test',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sentAt: new Date(),
					historyId: '123',
					threadId: 'thread1',
					labelIds: ['label1', 'label2'],
				},
			];
			await dataStore.insertEmails(emails);

			const result = await dataStore.removeLabelsFromEmail('email1', ['label1', 'label2']);
			expect(result.hasError()).toBe(false);

			const emailLabels = dataStore.getEmailLabels('email1');
			expect(emailLabels.size).toBe(0);
		});

		it('should handle non-existent email gracefully', async () => {
			const result = await dataStore.removeLabelsFromEmail('nonexistent', ['label1']);
			expect(result.hasError()).toBe(false);
		});
	});

	describe('getExistingMessageIds', () => {
		it('should return empty set when no emails exist', async () => {
			const messageIds = await dataStore.getExistingMessageIds();
			expect(messageIds.size).toBe(0);
		});

		it('should return all email IDs', async () => {
			const emails: Email[] = [
				{
					id: 'email1',
					subject: 'Test 1',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sentAt: new Date(),
					historyId: '123',
					threadId: 'thread1',
					labelIds: [],
				},
				{
					id: 'email2',
					subject: 'Test 2',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sentAt: new Date(),
					historyId: '124',
					threadId: 'thread2',
					labelIds: [],
				},
			];
			await dataStore.insertEmails(emails);

			const messageIds = await dataStore.getExistingMessageIds();
			expect(messageIds.size).toBe(2);
			expect(messageIds.has('email1')).toBe(true);
			expect(messageIds.has('email2')).toBe(true);
		});
	});

	describe('clear', () => {
		it('should clear all data', async () => {
			// Setup: add data
			await dataStore.setFullSyncCompleted();
			await dataStore.upsertLabels([{ id: 'label1', name: 'Test', type: 'user' }]);
			await dataStore.insertEmails([
				{
					id: 'email1',
					subject: 'Test',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sentAt: new Date(),
					historyId: '123',
					threadId: 'thread1',
					labelIds: ['label1'],
				},
			]);

			dataStore.clear();

			expect(await dataStore.isFullSyncCompleted()).toBe(false);
			expect(dataStore.getLabel('label1')).toBeUndefined();
			expect(dataStore.getEmail('email1')).toBeUndefined();
			expect((await dataStore.getExistingMessageIds()).size).toBe(0);
		});
	});

	describe('helper methods', () => {
		it('should provide access to all stored data', async () => {
			const labels: Label[] = [
				{ id: 'label1', name: 'Important', type: 'user' },
				{ id: 'label2', name: 'Work', type: 'user' },
			];
			const emails: Email[] = [
				{
					id: 'email1',
					subject: 'Test 1',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sentAt: new Date(),
					historyId: '123',
					threadId: 'thread1',
					labelIds: ['label1'],
				},
				{
					id: 'email2',
					subject: 'Test 2',
					body: 'Body',
					sender: 'sender@test.com',
					recipient: 'recipient@test.com',
					cc: '',
					sentAt: new Date(),
					historyId: '124',
					threadId: 'thread2',
					labelIds: ['label2'],
				},
			];

			await dataStore.upsertLabels(labels);
			await dataStore.insertEmails(emails);

			expect(dataStore.getAllLabels()).toHaveLength(2);
			expect(dataStore.getAllEmails()).toHaveLength(2);
			expect(dataStore.getEmailLabels('email1').has('label1')).toBe(true);
			expect(dataStore.getEmailLabels('email2').has('label2')).toBe(true);
		});
	});
});
