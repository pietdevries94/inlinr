import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAndProcessLabels } from './fetchAndProcessLabels';
import type { GmailClient } from '@/data/gmail';
import type { SynchronizeOptions } from '../types';
import type { Label } from '@/data/entities';
import { createResult, createErrorResult } from '@/utils/result';

describe('fetchAndProcessLabels', () => {
	let mockGmailClient: GmailClient;
	let mockOptions: SynchronizeOptions;

	beforeEach(() => {
		// Mock GmailClient
		mockGmailClient = {
			listLabels: vi.fn(),
		} as unknown as GmailClient;

		// Mock SynchronizeOptions
		mockOptions = {
			onLabelsFetched: vi.fn(),
			onError: vi.fn(),
			onEmailCreated: vi.fn(),
			onEmailDeleted: vi.fn(),
			onEmailLabelAdded: vi.fn(),
			onEmailLabelRemoved: vi.fn(),
			getExistingMessageIds: vi.fn(),
		};
	});

	it('should successfully fetch and process labels', async () => {
		const mockGmailLabels = [
			{ id: 'label1', name: 'Inbox', type: 'system' },
			{ id: 'label2', name: 'Important', type: 'user' },
			{ id: 'label3', name: 'Custom Label', type: 'user' },
		];

		const expectedLabels: Label[] = [
			{ id: 'label1', name: 'Inbox', type: 'system' },
			{ id: 'label2', name: 'Important', type: 'user' },
			{ id: 'label3', name: 'Custom Label', type: 'user' },
		];

		vi.mocked(mockGmailClient.listLabels).mockResolvedValue(createResult(mockGmailLabels));
		vi.mocked(mockOptions.onLabelsFetched).mockResolvedValue(createResult(undefined));

		await fetchAndProcessLabels(mockGmailClient, mockOptions);

		expect(mockGmailClient.listLabels).toHaveBeenCalledOnce();
		expect(mockOptions.onLabelsFetched).toHaveBeenCalledWith(expectedLabels);
		expect(mockOptions.onError).not.toHaveBeenCalled();
	});

	it('should handle labels with missing properties gracefully', async () => {
		const mockGmailLabels = [
			{ id: undefined, name: undefined, type: undefined },
			{ id: 'label2', name: null, type: 'system' },
			{ id: 'label3', name: 'Valid Label' }, // missing type
		];

		const expectedLabels: Label[] = [
			{ id: '', name: '', type: 'user' },
			{ id: 'label2', name: '', type: 'system' },
			{ id: 'label3', name: 'Valid Label', type: 'user' },
		];

		// @ts-expect-error Testing missing properties
		vi.mocked(mockGmailClient.listLabels).mockResolvedValue(createResult(mockGmailLabels));
		vi.mocked(mockOptions.onLabelsFetched).mockResolvedValue(createResult(undefined));

		await fetchAndProcessLabels(mockGmailClient, mockOptions);

		expect(mockGmailClient.listLabels).toHaveBeenCalledOnce();
		expect(mockOptions.onLabelsFetched).toHaveBeenCalledWith(expectedLabels);
		expect(mockOptions.onError).not.toHaveBeenCalled();
	});

	it('should handle empty labels array', async () => {
		vi.mocked(mockGmailClient.listLabels).mockResolvedValue(createResult([]));
		vi.mocked(mockOptions.onLabelsFetched).mockResolvedValue(createResult(undefined));

		await fetchAndProcessLabels(mockGmailClient, mockOptions);

		expect(mockGmailClient.listLabels).toHaveBeenCalledOnce();
		expect(mockOptions.onLabelsFetched).toHaveBeenCalledWith([]);
		expect(mockOptions.onError).not.toHaveBeenCalled();
	});

	it('should call onError when gmail client returns an error', async () => {
		const error = new Error('Gmail API error');
		vi.mocked(mockGmailClient.listLabels).mockResolvedValue(createErrorResult(error));

		await fetchAndProcessLabels(mockGmailClient, mockOptions);

		expect(mockGmailClient.listLabels).toHaveBeenCalledOnce();
		expect(mockOptions.onLabelsFetched).not.toHaveBeenCalled();
		expect(mockOptions.onError).toHaveBeenCalledWith(error);
	});

	it('should not call onError if onError callback is not provided when gmail client fails', async () => {
		const error = new Error('Gmail API error');
		const optionsWithoutOnError = {
			...mockOptions,
			onError: undefined,
		};

		vi.mocked(mockGmailClient.listLabels).mockResolvedValue(createErrorResult(error));

		// Should not throw even when onError is not provided
		await expect(
			fetchAndProcessLabels(mockGmailClient, optionsWithoutOnError),
		).resolves.toBeUndefined();

		expect(mockGmailClient.listLabels).toHaveBeenCalledOnce();
		expect(mockOptions.onLabelsFetched).not.toHaveBeenCalled();
	});

	it('should call onError when onLabelsFetched hook returns an error', async () => {
		const mockGmailLabels = [{ id: 'label1', name: 'Inbox', type: 'system' }];

		const hookError = new Error('Hook processing error');
		vi.mocked(mockGmailClient.listLabels).mockResolvedValue(createResult(mockGmailLabels));
		vi.mocked(mockOptions.onLabelsFetched).mockResolvedValue(createErrorResult(hookError));

		await fetchAndProcessLabels(mockGmailClient, mockOptions);

		expect(mockGmailClient.listLabels).toHaveBeenCalledOnce();
		expect(mockOptions.onLabelsFetched).toHaveBeenCalled();
		expect(mockOptions.onError).toHaveBeenCalledWith(hookError);
	});

	it('should not call onError if onError callback is not provided when hook fails', async () => {
		const mockGmailLabels = [{ id: 'label1', name: 'Inbox', type: 'system' }];

		const optionsWithoutOnError = {
			...mockOptions,
			onError: undefined,
		};

		const hookError = new Error('Hook processing error');
		vi.mocked(mockGmailClient.listLabels).mockResolvedValue(createResult(mockGmailLabels));
		vi.mocked(optionsWithoutOnError.onLabelsFetched).mockResolvedValue(
			createErrorResult(hookError),
		);

		// Should not throw even when onError is not provided
		await expect(
			fetchAndProcessLabels(mockGmailClient, optionsWithoutOnError),
		).resolves.toBeUndefined();

		expect(mockGmailClient.listLabels).toHaveBeenCalledOnce();
		expect(optionsWithoutOnError.onLabelsFetched).toHaveBeenCalled();
	});

	it('should handle complex label types correctly', async () => {
		const mockGmailLabels = [
			{ id: 'sys1', name: 'INBOX', type: 'system' },
			{ id: 'sys2', name: 'SENT', type: 'system' },
			{ id: 'user1', name: 'Work', type: 'user' },
			{ id: 'user2', name: 'Personal', type: 'user' },
			{ id: 'invalid', name: 'Invalid Type', type: 'invalid' }, // Invalid type should default to 'user'
		];

		const expectedLabels: Label[] = [
			{ id: 'sys1', name: 'INBOX', type: 'system' },
			{ id: 'sys2', name: 'SENT', type: 'system' },
			{ id: 'user1', name: 'Work', type: 'user' },
			{ id: 'user2', name: 'Personal', type: 'user' },
			{ id: 'invalid', name: 'Invalid Type', type: 'user' },
		];

		vi.mocked(mockGmailClient.listLabels).mockResolvedValue(createResult(mockGmailLabels));
		vi.mocked(mockOptions.onLabelsFetched).mockResolvedValue(createResult(undefined));

		await fetchAndProcessLabels(mockGmailClient, mockOptions);

		expect(mockGmailClient.listLabels).toHaveBeenCalledOnce();
		expect(mockOptions.onLabelsFetched).toHaveBeenCalledWith(expectedLabels);
		expect(mockOptions.onError).not.toHaveBeenCalled();
	});

	it('should handle onLabelsFetched returning a synchronous result', async () => {
		const mockGmailLabels = [{ id: 'label1', name: 'Test Label', type: 'user' }];

		vi.mocked(mockGmailClient.listLabels).mockResolvedValue(createResult(mockGmailLabels));
		// Return synchronous result instead of Promise
		vi.mocked(mockOptions.onLabelsFetched).mockReturnValue(createResult(undefined));

		await fetchAndProcessLabels(mockGmailClient, mockOptions);

		expect(mockGmailClient.listLabels).toHaveBeenCalledOnce();
		expect(mockOptions.onLabelsFetched).toHaveBeenCalled();
		expect(mockOptions.onError).not.toHaveBeenCalled();
	});

	it('should handle onLabelsFetched returning a synchronous error result', async () => {
		const mockGmailLabels = [{ id: 'label1', name: 'Test Label', type: 'user' }];

		const syncError = new Error('Synchronous error');
		vi.mocked(mockGmailClient.listLabels).mockResolvedValue(createResult(mockGmailLabels));
		// Return synchronous error result instead of Promise
		vi.mocked(mockOptions.onLabelsFetched).mockReturnValue(createErrorResult(syncError));

		await fetchAndProcessLabels(mockGmailClient, mockOptions);

		expect(mockGmailClient.listLabels).toHaveBeenCalledOnce();
		expect(mockOptions.onLabelsFetched).toHaveBeenCalled();
		expect(mockOptions.onError).toHaveBeenCalledWith(syncError);
	});
});
