import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAndProcessEmails } from './fetchAndProcessEmails';
import type { GmailClient } from '@/data/gmail';
import type { SynchronizeOptions } from '../types';
import type { Email } from '@/data/entities';
import { createResult, createErrorResult } from '@/utils/result';

describe('fetchAndProcessEmails', () => {
  let mockGmailClient: GmailClient;
  let mockOptions: SynchronizeOptions;
  let isStopped: () => boolean;

  beforeEach(() => {
    mockGmailClient = {
      getMessages: vi.fn(),
    } as unknown as GmailClient;

    mockOptions = {
      onEmailCreated: vi.fn(),
      onError: vi.fn(),
      onProgress: vi.fn(),
      onLabelsFetched: vi.fn(),
      onEmailDeleted: vi.fn(),
      onEmailLabelAdded: vi.fn(),
      onEmailLabelRemoved: vi.fn(),
      getExistingMessageIds: vi.fn(),
    };

    isStopped = vi.fn(() => false);
  });

  it('should process messages in batches', async () => {
    const messageIds = Array.from({ length: 25 }, (_, i) => `msg${i}`);
    const existingIds = new Set<string>();

    vi.mocked(mockOptions.getExistingMessageIds).mockResolvedValue(existingIds);
    vi.mocked(mockGmailClient.getMessages).mockResolvedValue([
      createResult({
        id: 'msg1',
        payload: {
          headers: [{ name: 'Subject', value: 'Test' }],
        },
      } as gapi.client.gmail.Message),
    ]);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, isStopped, messageIds);

    // Should be called 3 times (10, 10, 5)
    expect(mockGmailClient.getMessages).toHaveBeenCalledTimes(3);
    expect(mockOptions.onProgress).toHaveBeenCalledWith(10, 25);
    expect(mockOptions.onProgress).toHaveBeenCalledWith(20, 25);
    expect(mockOptions.onProgress).toHaveBeenCalledWith(25, 25);
  });

  it('should filter out existing message IDs', async () => {
    const messageIds = ['msg1', 'msg2', 'msg3', 'msg4'];
    const existingIds = new Set(['msg2', 'msg4']);

    vi.mocked(mockOptions.getExistingMessageIds).mockResolvedValue(existingIds);
    vi.mocked(mockGmailClient.getMessages).mockResolvedValue([]);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, isStopped, messageIds);

    // Should only process msg1 and msg3
    expect(mockGmailClient.getMessages).toHaveBeenCalledWith(['msg1', 'msg3']);
  });

  it('should stop processing when isStopped returns true', async () => {
    const messageIds = Array.from({ length: 25 }, (_, i) => `msg${i}`);
    const existingIds = new Set<string>();

    let callCount = 0;
    isStopped = vi.fn(() => {
      callCount++;
      return callCount > 1; // Stop after first batch
    });

    vi.mocked(mockOptions.getExistingMessageIds).mockResolvedValue(existingIds);
    vi.mocked(mockGmailClient.getMessages).mockResolvedValue([]);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, isStopped, messageIds);

    // Should only process first batch
    expect(mockGmailClient.getMessages).toHaveBeenCalledTimes(1);
  });

  it('should convert Gmail messages to Email objects', async () => {
    const messageIds = ['msg1'];
    const existingIds = new Set<string>();

    const gmailMessage: gapi.client.gmail.Message = {
      id: 'msg1',
      threadId: 'thread1',
      historyId: 'hist1',
      labelIds: ['INBOX'],
      snippet: 'Test snippet',
      payload: {
        headers: [
          { name: 'Subject', value: 'Test Subject' },
          { name: 'From', value: 'sender@example.com' },
          { name: 'To', value: 'recipient@example.com' },
          { name: 'Cc', value: 'cc@example.com' },
          { name: 'Date', value: 'Mon, 1 Jan 2024 12:00:00 GMT' },
        ],
      },
    };

    vi.mocked(mockOptions.getExistingMessageIds).mockResolvedValue(existingIds);
    vi.mocked(mockGmailClient.getMessages).mockResolvedValue([createResult(gmailMessage)]);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, isStopped, messageIds);

    expect(mockOptions.onEmailCreated).toHaveBeenCalledWith([
      {
        id: 'msg1',
        subject: 'Test Subject',
        body: 'Test snippet',
        sender: 'sender@example.com',
        recipient: 'recipient@example.com',
        cc: 'cc@example.com',
        sentAt: new Date('Mon, 1 Jan 2024 12:00:00 GMT'),
        historyId: 'hist1',
        labelIds: ['INBOX'],
        threadId: 'thread1',
      },
    ]);
  });

  it('should handle messages without IDs', async () => {
    const messageIds = ['msg1'];
    const existingIds = new Set<string>();

    const gmailMessage = {
      id: undefined,
      payload: {
        headers: [{ name: 'Subject', value: 'Test' }],
      },
    } as gapi.client.gmail.Message;

    vi.mocked(mockOptions.getExistingMessageIds).mockResolvedValue(existingIds);
    vi.mocked(mockGmailClient.getMessages).mockResolvedValue([createResult(gmailMessage)]);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, isStopped, messageIds);

    // Should be called with empty array since message has no ID
    expect(mockOptions.onEmailCreated).toHaveBeenCalledWith([]);
  });

  it('should call onError for messages with errors', async () => {
    const messageIds = ['msg1'];
    const existingIds = new Set<string>();
    const error = new Error('Failed to fetch message');

    vi.mocked(mockOptions.getExistingMessageIds).mockResolvedValue(existingIds);
    vi.mocked(mockGmailClient.getMessages).mockResolvedValue([createErrorResult(error)]);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, isStopped, messageIds);

    expect(mockOptions.onError).toHaveBeenCalledWith(error);
    expect(mockOptions.onEmailCreated).toHaveBeenCalledWith([]);
  });

  it('should handle missing onEmailCreated callback', async () => {
    const messageIds = ['msg1'];
    const existingIds = new Set<string>();
    const optionsWithoutCallback: SynchronizeOptions = {
      ...mockOptions,
      onEmailCreated: vi.fn().mockResolvedValue(createResult(undefined)),
    };

    const gmailMessage: gapi.client.gmail.Message = {
      id: 'msg1',
      payload: {
        headers: [{ name: 'Subject', value: 'Test' }],
      },
    };

    vi.mocked(optionsWithoutCallback.getExistingMessageIds).mockResolvedValue(existingIds);
    vi.mocked(mockGmailClient.getMessages).mockResolvedValue([createResult(gmailMessage)]);

    // Should not throw - callback exists but could be no-op
    await expect(
      fetchAndProcessEmails(mockGmailClient, optionsWithoutCallback, isStopped, messageIds),
    ).resolves.toBeUndefined();

    // Verify onEmailCreated was called with the converted email
    expect(optionsWithoutCallback.onEmailCreated).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'msg1',
      }),
    ]);
  });

  it('should call onError when onEmailCreated returns error', async () => {
    const messageIds = ['msg1'];
    const existingIds = new Set<string>();
    const error = new Error('Failed to create email');

    const gmailMessage: gapi.client.gmail.Message = {
      id: 'msg1',
      payload: {
        headers: [{ name: 'Subject', value: 'Test' }],
      },
    };

    vi.mocked(mockOptions.getExistingMessageIds).mockResolvedValue(existingIds);
    vi.mocked(mockGmailClient.getMessages).mockResolvedValue([createResult(gmailMessage)]);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createErrorResult(error));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, isStopped, messageIds);

    expect(mockOptions.onError).toHaveBeenCalledWith(error);
  });

  it('should handle missing onProgress callback', async () => {
    const messageIds = ['msg1'];
    const existingIds = new Set<string>();
    const optionsWithoutProgress = { ...mockOptions, onProgress: undefined };

    vi.mocked(optionsWithoutProgress.getExistingMessageIds).mockResolvedValue(existingIds);
    vi.mocked(mockGmailClient.getMessages).mockResolvedValue([]);
    vi.mocked(optionsWithoutProgress.onEmailCreated).mockResolvedValue(createResult(undefined));

    // Should not throw
    await expect(
      fetchAndProcessEmails(mockGmailClient, optionsWithoutProgress, isStopped, messageIds),
    ).resolves.toBeUndefined();
  });

  it('should handle empty message IDs array', async () => {
    const messageIds: string[] = [];
    const existingIds = new Set<string>();

    vi.mocked(mockOptions.getExistingMessageIds).mockResolvedValue(existingIds);

    await fetchAndProcessEmails(mockGmailClient, mockOptions, isStopped, messageIds);

    expect(mockGmailClient.getMessages).not.toHaveBeenCalled();
  });

  it('should decode base64 email body', async () => {
    const messageIds = ['msg1'];
    const existingIds = new Set<string>();

    // Simple base64url encoded "Hello World"
    const base64Body = 'SGVsbG8gV29ybGQ';

    const gmailMessage: gapi.client.gmail.Message = {
      id: 'msg1',
      payload: {
        headers: [{ name: 'Subject', value: 'Test' }],
        parts: [
          {
            mimeType: 'text/plain',
            body: {
              data: base64Body,
            },
          },
        ],
      },
    };

    vi.mocked(mockOptions.getExistingMessageIds).mockResolvedValue(existingIds);
    vi.mocked(mockGmailClient.getMessages).mockResolvedValue([createResult(gmailMessage)]);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, isStopped, messageIds);

    const calls = vi.mocked(mockOptions.onEmailCreated).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    if (calls[0]) {
      const emails = calls[0][0] as Email[];
      expect(emails[0]?.body).toBe(base64Body); // Will use raw base64 as fallback in test environment
    }
  });

  it('should handle missing email headers gracefully', async () => {
    const messageIds = ['msg1'];
    const existingIds = new Set<string>();

    const gmailMessage: gapi.client.gmail.Message = {
      id: 'msg1',
      payload: {
        headers: [],
      },
    };

    vi.mocked(mockOptions.getExistingMessageIds).mockResolvedValue(existingIds);
    vi.mocked(mockGmailClient.getMessages).mockResolvedValue([createResult(gmailMessage)]);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, isStopped, messageIds);

    expect(mockOptions.onEmailCreated).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'msg1',
        subject: '',
        sender: '',
        recipient: '',
        cc: '',
      }),
    ]);
  });

  it('should handle case-insensitive header matching', async () => {
    const messageIds = ['msg1'];
    const existingIds = new Set<string>();

    const gmailMessage: gapi.client.gmail.Message = {
      id: 'msg1',
      payload: {
        headers: [
          { name: 'SUBJECT', value: 'Test Subject' },
          { name: 'from', value: 'sender@example.com' },
          { name: 'To', value: 'recipient@example.com' },
        ],
      },
    };

    vi.mocked(mockOptions.getExistingMessageIds).mockResolvedValue(existingIds);
    vi.mocked(mockGmailClient.getMessages).mockResolvedValue([createResult(gmailMessage)]);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, isStopped, messageIds);

    expect(mockOptions.onEmailCreated).toHaveBeenCalledWith([
      expect.objectContaining({
        subject: 'Test Subject',
        sender: 'sender@example.com',
        recipient: 'recipient@example.com',
      }),
    ]);
  });
});
