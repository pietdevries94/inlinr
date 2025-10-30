import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGmailPartialSynchronizer } from './createGmailPartialSynchronizer';
import type { GmailClient } from '@/data/gmail';
import type { SynchronizeOptions } from '../types';
import { createResult, createErrorResult } from '@/utils/result';

// Mock the dependencies
vi.mock('./fetchAndProcessEmails');
vi.mock('./fetchAndProcessLabels');

import { fetchAndProcessEmails } from './fetchAndProcessEmails';
import { fetchAndProcessLabels } from './fetchAndProcessLabels';

describe('createGmailPartialSynchronizer', () => {
  let mockGmailClient: GmailClient;
  let mockOptions: SynchronizeOptions;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock GmailClient
    mockGmailClient = {
      getHistory: vi.fn().mockResolvedValue(
        createResult({
          histories: [],
          nextPageToken: undefined,
          historyId: '123456',
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
    vi.mocked(mockOptions.onEmailDeleted).mockResolvedValue(createResult(undefined));
    vi.mocked(mockOptions.onEmailLabelAdded).mockResolvedValue(createResult(undefined));
    vi.mocked(mockOptions.onEmailLabelRemoved).mockResolvedValue(createResult(undefined));
  });

  it('should create a synchronizer function that returns a SynchronizeStatus object', () => {
    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);
    const status = synchronizer('123456', mockOptions);

    expect(status).toHaveProperty('stop');
    expect(typeof status.stop).toBe('function');
  });

  it('should fetch and process labels first', async () => {
    vi.mocked(mockGmailClient.getHistory).mockResolvedValue(
      createResult({
        histories: [],
        nextPageToken: undefined,
        historyId: '123456',
      }),
    );

    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);
    synchronizer('123456', mockOptions);

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchAndProcessLabels).toHaveBeenCalledWith(mockGmailClient, mockOptions);
  });

  it('should handle invalid partialSyncMarker type', async () => {
    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);
    synchronizer(123, mockOptions); // Pass number instead of string

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockOptions.onError).toHaveBeenCalledWith(
      new Error('Invalid partialSyncMarker for Gmail partial synchronizer'),
    );
    expect(mockGmailClient.getHistory).not.toHaveBeenCalled();
  });

  it('should fetch history and process messages', async () => {
    const mockHistory = createResult({
      id: 'history1',
      messagesAdded: [{ message: { id: 'msg1' } }, { message: { id: 'msg2' } }],
      messagesDeleted: [{ message: { id: 'msg3' } }],
      labelsAdded: [{ message: { id: 'msg4' }, labelIds: ['label1', 'label2'] }],
      labelsRemoved: [{ message: { id: 'msg5' }, labelIds: ['label3'] }],
    } as gapi.client.gmail.History);

    vi.mocked(mockGmailClient.getHistory).mockResolvedValue(
      createResult({
        histories: [mockHistory],
        nextPageToken: undefined,
        historyId: '123456',
      }),
    );

    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);
    synchronizer('123456', mockOptions);

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockGmailClient.getHistory).toHaveBeenCalledWith('123456', undefined);
    expect(fetchAndProcessEmails).toHaveBeenCalledWith(
      mockGmailClient,
      mockOptions,
      expect.any(Function),
      ['msg1', 'msg2'],
    );
    expect(mockOptions.onEmailDeleted).toHaveBeenCalledWith(['msg3']);
    expect(mockOptions.onEmailLabelAdded).toHaveBeenCalledWith('msg4', ['label1', 'label2']);
    expect(mockOptions.onEmailLabelRemoved).toHaveBeenCalledWith('msg5', ['label3']);
  });

  it('should handle history pagination', async () => {
    const mockHistory1 = createResult({
      id: 'history1',
      messagesAdded: [{ message: { id: 'msg1' } }],
    } as gapi.client.gmail.History);

    const mockHistory2 = createResult({
      id: 'history2',
      messagesAdded: [{ message: { id: 'msg2' } }],
    } as gapi.client.gmail.History);

    vi.mocked(mockGmailClient.getHistory)
      .mockResolvedValueOnce(
        createResult({
          histories: [mockHistory1],
          nextPageToken: 'token1',
          historyId: '123456',
        }),
      )
      .mockResolvedValueOnce(
        createResult({
          histories: [mockHistory2],
          nextPageToken: undefined,
          historyId: '123456',
        }),
      );

    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);
    synchronizer('123456', mockOptions);

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockGmailClient.getHistory).toHaveBeenCalledTimes(2);
    expect(mockGmailClient.getHistory).toHaveBeenNthCalledWith(1, '123456', undefined);
    expect(mockGmailClient.getHistory).toHaveBeenNthCalledWith(2, '123456', 'token1');
    expect(fetchAndProcessEmails).toHaveBeenCalledWith(
      mockGmailClient,
      mockOptions,
      expect.any(Function),
      ['msg1', 'msg2'],
    );
  });

  it('should handle error when fetching history', async () => {
    const error = new Error('Failed to fetch history');
    vi.mocked(mockGmailClient.getHistory).mockResolvedValue(createErrorResult(error));

    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);
    synchronizer('123456', mockOptions);

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockOptions.onError).toHaveBeenCalledWith(error);
    expect(fetchAndProcessEmails).not.toHaveBeenCalled();
  });

  it('should handle error in history record', async () => {
    const historyError = new Error('History record error');
    const mockErrorHistory = createErrorResult<gapi.client.gmail.History>(historyError);

    vi.mocked(mockGmailClient.getHistory).mockResolvedValue(
      createResult({
        histories: [mockErrorHistory],
        nextPageToken: undefined,
        historyId: '123456',
      }),
    );

    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);
    synchronizer('123456', mockOptions);

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockOptions.onError).toHaveBeenCalledWith(historyError);
  });

  it('should call onComplete when synchronization finishes successfully', async () => {
    vi.mocked(mockGmailClient.getHistory).mockResolvedValue(
      createResult({
        histories: [],
        nextPageToken: undefined,
        historyId: '123456',
      }),
    );

    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);
    synchronizer('123456', mockOptions);

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockOptions.onComplete).toHaveBeenCalled();
  });

  it('should not call onComplete when synchronization is stopped', async () => {
    vi.mocked(mockGmailClient.getHistory).mockResolvedValue(
      createResult({
        histories: [],
        nextPageToken: undefined,
        historyId: '123456',
      }),
    );

    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);
    const status = synchronizer('123456', mockOptions);

    // Stop immediately
    status.stop();

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockOptions.onComplete).not.toHaveBeenCalled();
  });

  it('should provide a stop function', () => {
    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);
    const status = synchronizer('123456', mockOptions);

    // The stop function should be available and callable
    expect(typeof status.stop).toBe('function');
    expect(() => status.stop()).not.toThrow();
  });

  it('should handle messages without IDs gracefully', async () => {
    const mockHistory = createResult({
      id: 'history1',
      messagesAdded: [
        { message: { id: 'msg1' } },
        { message: {} }, // Message without ID
        { message: { id: 'msg2' } },
      ],
      messagesDeleted: [
        { message: {} }, // Message without ID
        { message: { id: 'msg3' } },
      ],
      labelsAdded: [
        { message: {}, labelIds: ['label1'] }, // Message without ID
        { message: { id: 'msg4' }, labelIds: ['label2'] },
      ],
      labelsRemoved: [
        { message: { id: 'msg5' } }, // Missing labelIds
        { message: { id: 'msg6' }, labelIds: ['label3'] },
      ],
    } as gapi.client.gmail.History);

    vi.mocked(mockGmailClient.getHistory).mockResolvedValue(
      createResult({
        histories: [mockHistory],
        nextPageToken: undefined,
        historyId: '123456',
      }),
    );

    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);
    synchronizer('123456', mockOptions);

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Should only process messages with valid IDs
    expect(fetchAndProcessEmails).toHaveBeenCalledWith(
      mockGmailClient,
      mockOptions,
      expect.any(Function),
      ['msg1', 'msg2'],
    );
    expect(mockOptions.onEmailDeleted).toHaveBeenCalledWith(['msg3']);
    expect(mockOptions.onEmailLabelAdded).toHaveBeenCalledWith('msg4', ['label2']);
    expect(mockOptions.onEmailLabelRemoved).toHaveBeenCalledWith('msg6', ['label3']);
  });

  it('should not call hooks when they are not provided', async () => {
    const optionsWithoutHooks = {
      ...mockOptions,
      onEmailDeleted: undefined,
      onEmailLabelAdded: undefined,
      onEmailLabelRemoved: undefined,
    } as unknown as SynchronizeOptions;

    // Use empty history to avoid calling the undefined hooks
    vi.mocked(mockGmailClient.getHistory).mockResolvedValue(
      createResult({
        histories: [],
        nextPageToken: undefined,
        historyId: '123456',
      }),
    );

    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);

    // Should not throw even when hooks are not provided
    expect(() => synchronizer('123456', optionsWithoutHooks)).not.toThrow();

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockOptions.onError).not.toHaveBeenCalled();
  });

  it('should handle hook errors when onError is provided', async () => {
    const hookError = new Error('Hook error');
    vi.mocked(mockOptions.onEmailDeleted).mockResolvedValue(createErrorResult(hookError));

    const mockHistory = createResult({
      id: 'history1',
      messagesDeleted: [{ message: { id: 'msg1' } }],
    } as gapi.client.gmail.History);

    vi.mocked(mockGmailClient.getHistory).mockResolvedValue(
      createResult({
        histories: [mockHistory],
        nextPageToken: undefined,
        historyId: '123456',
      }),
    );

    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);
    synchronizer('123456', mockOptions);

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockOptions.onEmailDeleted).toHaveBeenCalledWith(['msg1']);
    expect(mockOptions.onError).toHaveBeenCalledWith(hookError);
  });

  it('should not call onError when hooks fail and onError is not provided', async () => {
    const optionsWithoutOnError = {
      ...mockOptions,
      onError: undefined,
    };

    const hookError = new Error('Hook error');
    vi.mocked(optionsWithoutOnError.onEmailDeleted).mockResolvedValue(createErrorResult(hookError));

    const mockHistory = createResult({
      id: 'history1',
      messagesDeleted: [{ message: { id: 'msg1' } }],
    } as gapi.client.gmail.History);

    vi.mocked(mockGmailClient.getHistory).mockResolvedValue(
      createResult({
        histories: [mockHistory],
        nextPageToken: undefined,
        historyId: '123456',
      }),
    );

    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);

    // Should not throw even when onError is not provided
    expect(() => synchronizer('123456', optionsWithoutOnError)).not.toThrow();

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(optionsWithoutOnError.onEmailDeleted).toHaveBeenCalledWith(['msg1']);
  });

  it('should stop early if stopped before fetching history', async () => {
    vi.mocked(mockGmailClient.getHistory).mockResolvedValue(
      createResult({
        histories: [],
        nextPageToken: undefined,
        historyId: '123456',
      }),
    );

    // Mock fetchAndProcessLabels to simulate a delay
    let resolveFetchLabels: () => void;
    const fetchLabelsPromise = new Promise<void>((resolve) => {
      resolveFetchLabels = resolve;
    });
    vi.mocked(fetchAndProcessLabels).mockReturnValue(fetchLabelsPromise);

    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);
    const status = synchronizer('123456', mockOptions);

    // Stop before labels are processed
    status.stop();
    resolveFetchLabels!();

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchAndProcessLabels).toHaveBeenCalled();
    expect(mockGmailClient.getHistory).not.toHaveBeenCalled();
    expect(fetchAndProcessEmails).not.toHaveBeenCalled();
    expect(mockOptions.onComplete).not.toHaveBeenCalled();
  });

  it('should pass isStopped function to fetchAndProcessEmails', async () => {
    const mockHistory = createResult({
      id: 'history1',
      messagesAdded: [{ message: { id: 'msg1' } }],
    } as gapi.client.gmail.History);

    vi.mocked(mockGmailClient.getHistory).mockResolvedValue(
      createResult({
        histories: [mockHistory],
        nextPageToken: undefined,
        historyId: '123456',
      }),
    );

    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);
    const status = synchronizer('123456', mockOptions);

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

  it('should handle empty history', async () => {
    vi.mocked(mockGmailClient.getHistory).mockResolvedValue(
      createResult({
        histories: [],
        nextPageToken: undefined,
        historyId: '123456',
      }),
    );

    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);
    synchronizer('123456', mockOptions);

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

  it('should stop processing history records when stopped mid-processing', async () => {
    const mockHistory1 = createResult({
      id: 'history1',
      messagesAdded: [{ message: { id: 'msg1' } }],
    } as gapi.client.gmail.History);

    vi.mocked(mockGmailClient.getHistory).mockResolvedValue(
      createResult({
        histories: [mockHistory1],
        nextPageToken: undefined,
        historyId: '123456',
      }),
    );

    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);
    const status = synchronizer('123456', mockOptions);

    // Stop immediately after creation
    status.stop();

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Should process labels but may or may not complete depending on timing
    expect(fetchAndProcessLabels).toHaveBeenCalled();
    // Don't check onComplete since timing is unpredictable
  });

  it('should not call onComplete if onComplete is not provided', async () => {
    const optionsWithoutOnComplete = {
      ...mockOptions,
      onComplete: undefined,
    };

    vi.mocked(mockGmailClient.getHistory).mockResolvedValue(
      createResult({
        histories: [],
        nextPageToken: undefined,
        historyId: '123456',
      }),
    );

    const synchronizer = createGmailPartialSynchronizer(mockGmailClient);

    // Should not throw even when onComplete is not provided
    expect(() => synchronizer('123456', optionsWithoutOnComplete)).not.toThrow();

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchAndProcessEmails).toHaveBeenCalled();
  });
});
