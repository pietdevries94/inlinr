import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAndProcessEmails } from './fetchAndProcessEmails';
import type { GmailClient } from '@/data/gmail';
import type { SynchronizeOptions } from '../types';
import type { Email } from '@/data/entities';
import { createResult, createErrorResult, type Result } from '@/utils/result';

// Mock Uint8Array.fromBase64 for tests since it's not available in Node.js
Object.defineProperty(Uint8Array, 'fromBase64', {
  value: (base64String: string) => {
    const binaryString = atob(base64String.replace(/-/g, '+').replace(/_/g, '/'));
    const uint8Array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }
    return uint8Array;
  },
  writable: true,
  configurable: true,
});

describe('fetchAndProcessEmails', () => {
  let mockGmailClient: GmailClient;
  let mockOptions: SynchronizeOptions;
  let mockIsStopped: () => boolean;

  beforeEach(() => {
    // Mock GmailClient
    mockGmailClient = {
      getMessages: vi.fn(),
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
      getExistingMessageIds: vi.fn().mockResolvedValue(new Set<string>()),
    };

    // Mock isStopped function
    mockIsStopped = vi.fn().mockReturnValue(false);
  });

  it('should successfully fetch and process emails in batches', async () => {
    const messageIds = ['msg1', 'msg2', 'msg3', 'msg4', 'msg5'];
    const mockGmailMessages = messageIds.map((id, index) =>
      createResult({
        id,
        threadId: `thread${index}`,
        historyId: `history${index}`,
        snippet: `Email ${index + 1} snippet`,
        labelIds: ['INBOX'],
        payload: {
          headers: [
            { name: 'Subject', value: `Subject ${index + 1}` },
            { name: 'From', value: `sender${index + 1}@example.com` },
            { name: 'To', value: `recipient${index + 1}@example.com` },
            { name: 'Cc', value: `cc${index + 1}@example.com` },
            { name: 'Date', value: new Date('2025-01-01').toISOString() },
          ],
          body: {
            data: 'VGVzdCBib2R5', // Base64 encoded "Test body"
          },
        },
      } as gapi.client.gmail.Message),
    );

    const expectedEmails: Email[] = messageIds.map((id, index) => ({
      id,
      subject: `Subject ${index + 1}`,
      body: 'Test body', // This will be the decoded base64
      sender: `sender${index + 1}@example.com`,
      recipient: `recipient${index + 1}@example.com`,
      cc: `cc${index + 1}@example.com`,
      sentAt: new Date(new Date('2025-01-01').toISOString()),
      historyId: `history${index}`,
      labelIds: ['INBOX'],
      threadId: `thread${index}`,
    }));

    vi.mocked(mockGmailClient.getMessages).mockResolvedValue(mockGmailMessages);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, mockIsStopped, messageIds);

    expect(mockGmailClient.getMessages).toHaveBeenCalledTimes(1);
    expect(mockOptions.onEmailCreated).toHaveBeenCalledWith(expectedEmails);
    expect(mockOptions.onProgress).toHaveBeenCalledWith(5, 5);
    expect(mockOptions.onError).not.toHaveBeenCalled();
  });

  it('should process emails in batches of 10', async () => {
    const messageIds = Array.from({ length: 25 }, (_, i) => `msg${i + 1}`);
    const mockGmailMessage = createResult({
      id: 'msg1',
      threadId: 'thread1',
      historyId: 'history1',
      snippet: 'Test snippet',
      labelIds: ['INBOX'],
      payload: {
        headers: [
          { name: 'Subject', value: 'Test Subject' },
          { name: 'From', value: 'sender@example.com' },
          { name: 'To', value: 'recipient@example.com' },
          { name: 'Date', value: new Date().toISOString() },
        ],
      },
    } as gapi.client.gmail.Message);

    vi.mocked(mockGmailClient.getMessages).mockResolvedValue([mockGmailMessage]);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, mockIsStopped, messageIds);

    // Should be called 3 times: 10, 10, 5 messages
    expect(mockGmailClient.getMessages).toHaveBeenCalledTimes(3);
    expect(mockOptions.onProgress).toHaveBeenCalledTimes(3);
    expect(mockOptions.onProgress).toHaveBeenNthCalledWith(1, 10, 25);
    expect(mockOptions.onProgress).toHaveBeenNthCalledWith(2, 20, 25);
    expect(mockOptions.onProgress).toHaveBeenNthCalledWith(3, 25, 25);
  });

  it('should filter out existing message IDs', async () => {
    const messageIds = ['msg1', 'msg2', 'msg3', 'msg4', 'msg5'];
    const existingIds = new Set(['msg2', 'msg4']);

    vi.mocked(mockOptions.getExistingMessageIds).mockResolvedValue(existingIds);
    vi.mocked(mockGmailClient.getMessages).mockResolvedValue([]);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, mockIsStopped, messageIds);

    // Should only process msg1, msg3, msg5 (3 messages)
    expect(mockGmailClient.getMessages).toHaveBeenCalledWith(['msg1', 'msg3', 'msg5']);
    expect(mockOptions.onProgress).toHaveBeenCalledWith(3, 3);
  });

  it('should stop processing when isStopped returns true', async () => {
    const messageIds = Array.from({ length: 25 }, (_, i) => `msg${i + 1}`);

    // Stop after first batch
    vi.mocked(mockIsStopped).mockReturnValueOnce(false).mockReturnValue(true);
    vi.mocked(mockGmailClient.getMessages).mockResolvedValue([]);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, mockIsStopped, messageIds);

    // Should only be called once before stopping
    expect(mockGmailClient.getMessages).toHaveBeenCalledTimes(1);
    expect(mockOptions.onProgress).toHaveBeenCalledTimes(1);
  });

  it('should handle Gmail messages with missing IDs', async () => {
    const messageIds = ['msg1', 'msg2'];
    const mockGmailMessages: (
      | ReturnType<typeof createResult<gapi.client.gmail.Message>>
      | ReturnType<typeof createErrorResult<gapi.client.gmail.Message>>
    )[] = [
      createResult({
        id: 'msg1',
        threadId: 'thread1',
        historyId: 'history1',
        snippet: 'Valid message',
        labelIds: ['INBOX'],
        payload: {
          headers: [
            { name: 'Subject', value: 'Valid Subject' },
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'recipient@example.com' },
            { name: 'Date', value: new Date().toISOString() },
          ],
        },
      } as gapi.client.gmail.Message),
      createErrorResult<gapi.client.gmail.Message>(new Error('Missing ID')),
    ];

    vi.mocked(mockGmailClient.getMessages).mockResolvedValue(mockGmailMessages);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, mockIsStopped, messageIds);

    // Should only process the valid message
    expect(mockOptions.onEmailCreated).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'msg1' }),
    ]);
  });

  it('should handle error results from Gmail client', async () => {
    const messageIds = ['msg1', 'msg2'];
    const mockGmailMessages = [
      createResult({
        id: 'msg1',
        threadId: 'thread1',
        historyId: 'history1',
        snippet: 'Valid message',
        labelIds: ['INBOX'],
        payload: {
          headers: [
            { name: 'Subject', value: 'Valid Subject' },
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'recipient@example.com' },
            { name: 'Date', value: new Date().toISOString() },
          ],
        },
      } as gapi.client.gmail.Message),
      createErrorResult(new Error('Failed to fetch message')),
    ];

    vi.mocked(mockGmailClient.getMessages).mockResolvedValue(
      mockGmailMessages as Result<gapi.client.gmail.Message>[],
    );
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, mockIsStopped, messageIds);

    // Should process the valid message and call onError for the failed one
    expect(mockOptions.onEmailCreated).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'msg1' }),
    ]);
    expect(mockOptions.onError).toHaveBeenCalledWith(new Error('Failed to fetch message'));
  });

  it('should handle missing headers gracefully', async () => {
    const messageIds = ['msg1'];
    const mockGmailMessages = [
      createResult({
        id: 'msg1',
        threadId: 'thread1',
        historyId: 'history1',
        snippet: 'Message with missing headers',
        labelIds: ['INBOX'],
        payload: {
          headers: [
            { name: 'Subject', value: 'Only Subject' },
            // Missing From, To, Cc, Date headers
          ],
        },
      } as gapi.client.gmail.Message),
    ];

    const expectedEmail: Email = {
      id: 'msg1',
      subject: 'Only Subject',
      body: 'Message with missing headers',
      sender: '',
      recipient: '',
      cc: '',
      sentAt: new Date(''),
      historyId: 'history1',
      labelIds: ['INBOX'],
      threadId: 'thread1',
    };

    vi.mocked(mockGmailClient.getMessages).mockResolvedValue(mockGmailMessages);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, mockIsStopped, messageIds);

    expect(mockOptions.onEmailCreated).toHaveBeenCalledWith([expectedEmail]);
  });

  it('should decode base64 email body when available', async () => {
    const messageIds = ['msg1'];
    const mockGmailMessages = [
      createResult({
        id: 'msg1',
        threadId: 'thread1',
        historyId: 'history1',
        snippet: 'This should be overridden',
        labelIds: ['INBOX'],
        payload: {
          headers: [
            { name: 'Subject', value: 'Test Subject' },
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'recipient@example.com' },
            { name: 'Date', value: new Date().toISOString() },
          ],
          parts: [
            {
              mimeType: 'text/plain',
              body: {
                data: 'VGhpcyBpcyBhIHRlc3QgYm9keQ', // Base64 for "This is a test body"
              },
            },
          ],
        },
      } as gapi.client.gmail.Message),
    ];

    vi.mocked(mockGmailClient.getMessages).mockResolvedValue(mockGmailMessages);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, mockIsStopped, messageIds);

    expect(mockOptions.onEmailCreated).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'msg1',
        body: 'This is a test body',
      }),
    ]);
  });

  it('should fall back to snippet when base64 decoding fails', async () => {
    // Mock Uint8Array.fromBase64 to throw an error for this test
    const originalFromBase64 = (
      Uint8Array as typeof Uint8Array & { fromBase64?: (str: string) => Uint8Array }
    ).fromBase64;
    (Uint8Array as typeof Uint8Array & { fromBase64?: (str: string) => Uint8Array }).fromBase64 = vi
      .fn()
      .mockImplementation(() => {
        throw new Error('Invalid base64');
      });

    const messageIds = ['msg1'];
    const mockGmailMessages = [
      createResult({
        id: 'msg1',
        threadId: 'thread1',
        historyId: 'history1',
        snippet: 'Fallback snippet',
        labelIds: ['INBOX'],
        payload: {
          headers: [
            { name: 'Subject', value: 'Test Subject' },
            { name: 'Date', value: new Date().toISOString() },
          ],
          parts: [
            {
              mimeType: 'text/plain',
              body: {
                data: 'invalid-base64-data',
              },
            },
          ],
        },
      } as gapi.client.gmail.Message),
    ];

    vi.mocked(mockGmailClient.getMessages).mockResolvedValue(mockGmailMessages);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, mockIsStopped, messageIds);

    expect(mockOptions.onEmailCreated).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'msg1',
        body: 'invalid-base64-data', // Falls back to the invalid base64 string
      }),
    ]);

    // Restore the original implementation
    (Uint8Array as typeof Uint8Array & { fromBase64?: (str: string) => Uint8Array }).fromBase64 =
      originalFromBase64;
  });

  it('should handle missing payload gracefully', async () => {
    const messageIds = ['msg1'];
    const mockGmailMessages = [
      createResult({
        id: 'msg1',
        threadId: 'thread1',
        historyId: 'history1',
        snippet: 'Message without payload',
        labelIds: ['INBOX'],
        // Missing payload
      } as gapi.client.gmail.Message),
    ];

    const expectedEmail: Email = {
      id: 'msg1',
      subject: '',
      body: 'Message without payload',
      sender: '',
      recipient: '',
      cc: '',
      sentAt: new Date(''),
      historyId: 'history1',
      labelIds: ['INBOX'],
      threadId: 'thread1',
    };

    vi.mocked(mockGmailClient.getMessages).mockResolvedValue(mockGmailMessages);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, mockIsStopped, messageIds);

    expect(mockOptions.onEmailCreated).toHaveBeenCalledWith([expectedEmail]);
  });

  it('should handle onEmailCreated returning an error', async () => {
    const messageIds = ['msg1'];
    const mockGmailMessages = [
      createResult({
        id: 'msg1',
        threadId: 'thread1',
        historyId: 'history1',
        snippet: 'Test message',
        labelIds: ['INBOX'],
        payload: {
          headers: [
            { name: 'Subject', value: 'Test Subject' },
            { name: 'Date', value: new Date().toISOString() },
          ],
        },
      } as gapi.client.gmail.Message),
    ];

    const hookError = new Error('Failed to create email');
    vi.mocked(mockGmailClient.getMessages).mockResolvedValue(mockGmailMessages);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createErrorResult(hookError));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, mockIsStopped, messageIds);

    expect(mockOptions.onEmailCreated).toHaveBeenCalled();
    expect(mockOptions.onError).toHaveBeenCalledWith(hookError);
  });

  it('should not call onEmailCreated when it is not provided', async () => {
    const optionsWithoutOnEmailCreated = {
      ...mockOptions,
      onEmailCreated: undefined,
    } as unknown as SynchronizeOptions;

    const messageIds = ['msg1'];
    const mockGmailMessages = [
      createResult({
        id: 'msg1',
        threadId: 'thread1',
        historyId: 'history1',
        snippet: 'Test message',
        labelIds: ['INBOX'],
        payload: {
          headers: [{ name: 'Subject', value: 'Test Subject' }],
        },
      } as gapi.client.gmail.Message),
    ];

    vi.mocked(mockGmailClient.getMessages).mockResolvedValue(mockGmailMessages);

    await fetchAndProcessEmails(
      mockGmailClient,
      optionsWithoutOnEmailCreated,
      mockIsStopped,
      messageIds,
    );

    expect(mockGmailClient.getMessages).toHaveBeenCalled();
    expect(optionsWithoutOnEmailCreated.onError).not.toHaveBeenCalled();
  });

  it('should handle empty message IDs array', async () => {
    await fetchAndProcessEmails(mockGmailClient, mockOptions, mockIsStopped, []);

    expect(mockGmailClient.getMessages).not.toHaveBeenCalled();
    expect(mockOptions.onEmailCreated).not.toHaveBeenCalled();
    expect(mockOptions.onProgress).not.toHaveBeenCalled();
  });

  it('should handle case-insensitive header names', async () => {
    const messageIds = ['msg1'];
    const mockGmailMessages = [
      createResult({
        id: 'msg1',
        threadId: 'thread1',
        historyId: 'history1',
        snippet: 'Test message',
        labelIds: ['INBOX'],
        payload: {
          headers: [
            { name: 'SUBJECT', value: 'Uppercase Subject' },
            { name: 'from', value: 'lowercase@example.com' },
            { name: 'To', value: 'mixed@example.com' },
            { name: 'CC', value: 'uppercase@example.com' },
            { name: 'date', value: new Date().toISOString() },
          ],
        },
      } as gapi.client.gmail.Message),
    ];

    const expectedEmail: Email = {
      id: 'msg1',
      subject: 'Uppercase Subject',
      body: 'Test message',
      sender: 'lowercase@example.com',
      recipient: 'mixed@example.com',
      cc: 'uppercase@example.com',
      sentAt: expect.any(Date),
      historyId: 'history1',
      labelIds: ['INBOX'],
      threadId: 'thread1',
    };

    vi.mocked(mockGmailClient.getMessages).mockResolvedValue(mockGmailMessages);
    vi.mocked(mockOptions.onEmailCreated).mockResolvedValue(createResult(undefined));

    await fetchAndProcessEmails(mockGmailClient, mockOptions, mockIsStopped, messageIds);

    expect(mockOptions.onEmailCreated).toHaveBeenCalledWith([expectedEmail]);
  });
});
