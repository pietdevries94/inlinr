import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGmailFullSynchronizer } from './createGmailFullSynchronizer';
import type { GmailClient } from '@/data/gmail';
import type { SynchronizeOptions } from '../types';
import { createResult, createErrorResult } from '@/utils/result';

// Mock the dependencies
vi.mock('./fetchAndProcessEmails');
vi.mock('./fetchAndProcessLabels');

import { fetchAndProcessEmails } from './fetchAndProcessEmails';
import { fetchAndProcessLabels } from './fetchAndProcessLabels';

describe('createGmailFullSynchronizer', () => {
	let mockGmailClient: GmailClient;
	let mockOptions: SynchronizeOptions;

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock GmailClient
		mockGmailClient = {
			listMessages: vi.fn().mockResolvedValue(
				createResult({
					messageIds: [],
					nextPageToken: undefined,
					resultSizeEstimate: 0,
				}),
			),
		} as unknown as GmailClient;

		// Mock SynchronizeOptions
		mockOptions = {
			onLabelsFetched: vi.fn(),
			onError: vi.fn(),
			onEmailCreated: vi.fn(),
			onEmailDeleted: vi.fn(),
			onEmailLabelAdded: vi.fn(),
			onEmailLabelRemoved: vi.fn(),
			onProgress: vi.fn(),
			onComplete: vi.fn(),
			getExistingMessageIds: vi.fn().mockResolvedValue(new Set<string>()),
		};

		// Mock the imported functions
		vi.mocked(fetchAndProcessLabels).mockResolvedValue(undefined);
		vi.mocked(fetchAndProcessEmails).mockResolvedValue(undefined);
	});

	it('should create a synchronizer function that returns a SynchronizeStatus object', () => {
		const synchronizer = createGmailFullSynchronizer(mockGmailClient);
		const status = synchronizer(mockOptions);

		expect(status).toHaveProperty('stop');
		expect(typeof status.stop).toBe('function');
	});

	it('should fetch and process labels first', async () => {
		vi.mocked(mockGmailClient.listMessages).mockResolvedValue(
			createResult({
				messageIds: ['msg1', 'msg2'],
				nextPageToken: undefined,
				resultSizeEstimate: 2,
			}),
		);

		const synchronizer = createGmailFullSynchronizer(mockGmailClient);
		synchronizer(mockOptions);

		// Wait for async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(fetchAndProcessLabels).toHaveBeenCalledWith(mockGmailClient, mockOptions);
	});

	it('should fetch all message IDs using pagination', async () => {
		vi.mocked(mockGmailClient.listMessages)
			.mockResolvedValueOnce(
				createResult({
					messageIds: ['msg1', 'msg2'],
					nextPageToken: 'token1',
					resultSizeEstimate: 4,
				}),
			)
			.mockResolvedValueOnce(
				createResult({
					messageIds: ['msg3', 'msg4'],
					nextPageToken: undefined,
					resultSizeEstimate: 4,
				}),
			);

		const synchronizer = createGmailFullSynchronizer(mockGmailClient);
		synchronizer(mockOptions);

		// Wait for async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(mockGmailClient.listMessages).toHaveBeenCalledTimes(2);
		expect(mockGmailClient.listMessages).toHaveBeenNthCalledWith(1, 'after:2025-01-01', undefined);
		expect(mockGmailClient.listMessages).toHaveBeenNthCalledWith(2, 'after:2025-01-01', 'token1');
		expect(fetchAndProcessEmails).toHaveBeenCalledWith(
			mockGmailClient,
			mockOptions,
			expect.any(Function),
			['msg1', 'msg2', 'msg3', 'msg4'],
		);
	});

	it('should handle error when fetching message IDs', async () => {
		const error = new Error('Failed to fetch messages');
		vi.mocked(mockGmailClient.listMessages).mockResolvedValue(createErrorResult(error));

		const synchronizer = createGmailFullSynchronizer(mockGmailClient);
		synchronizer(mockOptions);

		// Wait for async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(mockOptions.onError).toHaveBeenCalledWith(error);
		expect(fetchAndProcessEmails).toHaveBeenCalledWith(
			mockGmailClient,
			mockOptions,
			expect.any(Function),
			[],
		);
	});

	it('should call onComplete when synchronization finishes successfully', async () => {
		vi.mocked(mockGmailClient.listMessages).mockResolvedValue(
			createResult({
				messageIds: ['msg1'],
				nextPageToken: undefined,
				resultSizeEstimate: 1,
			}),
		);

		const synchronizer = createGmailFullSynchronizer(mockGmailClient);
		synchronizer(mockOptions);

		// Wait for async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(mockOptions.onComplete).toHaveBeenCalled();
	});

	it('should not call onComplete when synchronization is stopped', async () => {
		vi.mocked(mockGmailClient.listMessages).mockResolvedValue(
			createResult({
				messageIds: ['msg1'],
				nextPageToken: undefined,
				resultSizeEstimate: 1,
			}),
		);

		const synchronizer = createGmailFullSynchronizer(mockGmailClient);
		const status = synchronizer(mockOptions);

		// Stop immediately
		status.stop();

		// Wait for async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(mockOptions.onComplete).not.toHaveBeenCalled();
	});

	it('should provide a stop function', () => {
		const synchronizer = createGmailFullSynchronizer(mockGmailClient);
		const status = synchronizer(mockOptions);

		// The stop function should be available and callable
		expect(typeof status.stop).toBe('function');
		expect(() => status.stop()).not.toThrow();
	});

	it('should pass isStopped function to fetchAndProcessEmails', async () => {
		vi.mocked(mockGmailClient.listMessages).mockResolvedValue(
			createResult({
				messageIds: ['msg1'],
				nextPageToken: undefined,
				resultSizeEstimate: 1,
			}),
		);

		const synchronizer = createGmailFullSynchronizer(mockGmailClient);
		const status = synchronizer(mockOptions);

		// Wait for async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(fetchAndProcessEmails).toHaveBeenCalledWith(
			mockGmailClient,
			mockOptions,
			expect.any(Function),
			['msg1'],
		);

		// Test that the isStopped function works
		const isStoppedFn = vi.mocked(fetchAndProcessEmails).mock.calls[0]?.[2];
		expect(isStoppedFn?.()).toBe(false);

		status.stop();
		expect(isStoppedFn?.()).toBe(true);
	});

	it('should not call onError if onError is not provided', async () => {
		const optionsWithoutOnError = {
			...mockOptions,
			onError: undefined,
		};

		const error = new Error('Failed to fetch messages');
		vi.mocked(mockGmailClient.listMessages).mockResolvedValue(createErrorResult(error));

		const synchronizer = createGmailFullSynchronizer(mockGmailClient);

		// Should not throw even when onError is not provided
		expect(() => synchronizer(optionsWithoutOnError)).not.toThrow();

		// Wait for async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(fetchAndProcessEmails).toHaveBeenCalledWith(
			mockGmailClient,
			optionsWithoutOnError,
			expect.any(Function),
			[],
		);
	});

	it('should stop early if stopped before fetching emails', async () => {
		vi.mocked(mockGmailClient.listMessages).mockResolvedValue(
			createResult({
				messageIds: ['msg1'],
				nextPageToken: undefined,
				resultSizeEstimate: 1,
			}),
		);

		// Mock fetchAndProcessLabels to simulate a delay
		let resolveFetchLabels: () => void;
		const fetchLabelsPromise = new Promise<void>((resolve) => {
			resolveFetchLabels = resolve;
		});
		vi.mocked(fetchAndProcessLabels).mockReturnValue(fetchLabelsPromise);

		const synchronizer = createGmailFullSynchronizer(mockGmailClient);
		const status = synchronizer(mockOptions);

		// Stop before labels are processed
		status.stop();
		resolveFetchLabels!();

		// Wait for async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(fetchAndProcessLabels).toHaveBeenCalled();
		expect(mockGmailClient.listMessages).not.toHaveBeenCalled();
		expect(fetchAndProcessEmails).not.toHaveBeenCalled();
		expect(mockOptions.onComplete).not.toHaveBeenCalled();
	});

	it('should handle empty message list', async () => {
		vi.mocked(mockGmailClient.listMessages).mockResolvedValue(
			createResult({
				messageIds: [],
				nextPageToken: undefined,
				resultSizeEstimate: 0,
			}),
		);

		const synchronizer = createGmailFullSynchronizer(mockGmailClient);
		synchronizer(mockOptions);

		// Wait for async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(fetchAndProcessEmails).toHaveBeenCalledWith(
			mockGmailClient,
			mockOptions,
			expect.any(Function),
			[],
		);
		expect(mockOptions.onComplete).toHaveBeenCalled();
	});

	it('should use the correct query for fetching messages', async () => {
		vi.mocked(mockGmailClient.listMessages).mockResolvedValue(
			createResult({
				messageIds: ['msg1'],
				nextPageToken: undefined,
				resultSizeEstimate: 1,
			}),
		);

		const synchronizer = createGmailFullSynchronizer(mockGmailClient);
		synchronizer(mockOptions);

		// Wait for async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(mockGmailClient.listMessages).toHaveBeenCalledWith('after:2025-01-01', undefined);
	});

	it('should handle multiple pages with different message counts', async () => {
		vi.mocked(mockGmailClient.listMessages)
			.mockResolvedValueOnce(
				createResult({
					messageIds: ['msg1'],
					nextPageToken: 'token1',
					resultSizeEstimate: 3,
				}),
			)
			.mockResolvedValueOnce(
				createResult({
					messageIds: ['msg2', 'msg3'],
					nextPageToken: 'token2',
					resultSizeEstimate: 3,
				}),
			)
			.mockResolvedValueOnce(
				createResult({
					messageIds: [],
					nextPageToken: undefined,
					resultSizeEstimate: 3,
				}),
			);

		const synchronizer = createGmailFullSynchronizer(mockGmailClient);
		synchronizer(mockOptions);

		// Wait for async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(mockGmailClient.listMessages).toHaveBeenCalledTimes(3);
		expect(fetchAndProcessEmails).toHaveBeenCalledWith(
			mockGmailClient,
			mockOptions,
			expect.any(Function),
			['msg1', 'msg2', 'msg3'],
		);
	});

	it('should not call onComplete if onComplete is not provided', async () => {
		const optionsWithoutOnComplete = {
			...mockOptions,
			onComplete: undefined,
		};

		vi.mocked(mockGmailClient.listMessages).mockResolvedValue(
			createResult({
				messageIds: ['msg1'],
				nextPageToken: undefined,
				resultSizeEstimate: 1,
			}),
		);

		const synchronizer = createGmailFullSynchronizer(mockGmailClient);

		// Should not throw even when onComplete is not provided
		expect(() => synchronizer(optionsWithoutOnComplete)).not.toThrow();

		// Wait for async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(fetchAndProcessEmails).toHaveBeenCalled();
	});
});
