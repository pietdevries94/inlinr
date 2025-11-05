import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processSynchronizer } from './processSynchronizer';
import { createMockDataStore, type MockDataStore } from './dataStore';
import type { FullSynchronizeFunction, PartialSynchronizeFunction } from './types';

describe('processSynchronizer', () => {
	let dataStore: MockDataStore;
	let mockFullSynchronizer: FullSynchronizeFunction;
	let mockPartialSynchronizer: PartialSynchronizeFunction;

	beforeEach(() => {
		dataStore = createMockDataStore();

		// Mock synchronizers that call onComplete immediately
		mockFullSynchronizer = vi.fn((options) => {
			setTimeout(() => options.onComplete?.(), 0);
			return { stop: vi.fn() };
		}) as unknown as FullSynchronizeFunction;

		mockPartialSynchronizer = vi.fn((marker, options) => {
			setTimeout(() => options.onComplete?.(), 0);
			return { stop: vi.fn() };
		}) as unknown as PartialSynchronizeFunction;
	});

	// Helper function to wait for synchronizer to complete
	const waitForSynchronizer = () => {
		return new Promise<void>((resolve) => {
			processSynchronizer(dataStore, mockFullSynchronizer, mockPartialSynchronizer, {
				onComplete: () => resolve(),
			});
		});
	};

	it('should pass a string to partialSynchronizer when full sync is completed', async () => {
		// Setup: mark full sync as completed and add an email with history_id
		await dataStore.setFullSyncCompleted();
		await dataStore.insertEmails([
			{
				id: 'email1',
				subject: 'Test',
				body: 'Body',
				sender: 'sender@test.com',
				recipient: 'recipient@test.com',
				cc: '',
				sentAt: new Date(),
				historyId: '12345',
				threadId: 'thread1',
				labelIds: [],
			},
		]);

		// Act
		await waitForSynchronizer();

		// Assert: partialSynchronizer should be called with a string
		expect(mockPartialSynchronizer).toHaveBeenCalled();
		const calls = vi.mocked(mockPartialSynchronizer).mock.calls;
		expect(calls.length).toBeGreaterThan(0);
		const firstArg = calls[0]?.[0];
		expect(typeof firstArg).toBe('string');
		expect(firstArg).toBe('12345');
		expect(mockFullSynchronizer).not.toHaveBeenCalled();
	});

	it('should call fullSynchronizer when full sync is not completed', async () => {
		// Setup: full sync not completed (default state)

		// Act
		await waitForSynchronizer();

		// Assert
		expect(mockFullSynchronizer).toHaveBeenCalled();
		expect(mockPartialSynchronizer).not.toHaveBeenCalled();
	});

	it('should use default history_id "0" when no emails exist', async () => {
		// Setup: full sync is completed but no emails exist
		await dataStore.setFullSyncCompleted();

		// Act
		await waitForSynchronizer();

		// Assert: partialSynchronizer should be called with "0" as default
		expect(mockPartialSynchronizer).toHaveBeenCalled();
		const calls = vi.mocked(mockPartialSynchronizer).mock.calls;
		expect(calls.length).toBeGreaterThan(0);
		const firstArg = calls[0]?.[0];
		expect(typeof firstArg).toBe('string');
		expect(firstArg).toBe('0');
	});

	it('should return latest email history_id when multiple emails exist', async () => {
		// Setup: mark full sync as completed and add multiple emails
		await dataStore.setFullSyncCompleted();
		const oldDate = new Date('2023-01-01');
		const newDate = new Date('2023-01-02');

		await dataStore.insertEmails([
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
		]);

		// Act
		await waitForSynchronizer();

		// Assert: should use history_id from the most recent email
		expect(mockPartialSynchronizer).toHaveBeenCalled();
		const calls = vi.mocked(mockPartialSynchronizer).mock.calls;
		const firstArg = calls[0]?.[0];
		expect(firstArg).toBe('200');
	});

	it('should call dataStore methods when synchronizer hooks are triggered', async () => {
		const spyUpsertLabels = vi.spyOn(dataStore, 'upsertLabels');
		const spyInsertEmails = vi.spyOn(dataStore, 'insertEmails');
		const spySetFullSyncCompleted = vi.spyOn(dataStore, 'setFullSyncCompleted');

		// Mock synchronizer that calls various hooks
		const mockSynchronizerWithHooks: FullSynchronizeFunction = vi.fn((options) => {
			setTimeout(async () => {
				await options.onLabelsFetched?.([{ id: 'label1', name: 'Important', type: 'user' }]);
				await options.onEmailCreated?.([
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
				options.onComplete?.();
			}, 0);
			return { stop: vi.fn() };
		}) as unknown as FullSynchronizeFunction;

		// Act
		await new Promise<void>((resolve) => {
			processSynchronizer(dataStore, mockSynchronizerWithHooks, mockPartialSynchronizer, {
				onComplete: () => resolve(),
			});
		});

		// Assert
		expect(spyUpsertLabels).toHaveBeenCalledWith([
			{ id: 'label1', name: 'Important', type: 'user' },
		]);
		expect(spyInsertEmails).toHaveBeenCalledWith([
			{
				id: 'email1',
				subject: 'Test',
				body: 'Body',
				sender: 'sender@test.com',
				recipient: 'recipient@test.com',
				cc: '',
				sentAt: expect.any(Date),
				historyId: '123',
				threadId: 'thread1',
				labelIds: ['label1'],
			},
		]);
		expect(spySetFullSyncCompleted).toHaveBeenCalled();
	});
});
