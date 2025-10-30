import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processSynchronizer } from './processSynchronizer';
import type { Kysely } from 'kysely';
import type { Db } from '@/data/db';
import type { FullSynchronizeFunction, PartialSynchronizeFunction } from './types';

describe('processSynchronizer', () => {
  let mockDb: Kysely<Db>;
  let mockFullSynchronizer: FullSynchronizeFunction;
  let mockPartialSynchronizer: PartialSynchronizeFunction;
  let mockExecuteTakeFirst: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock database
    mockExecuteTakeFirst = vi.fn();
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: mockExecuteTakeFirst,
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
    } as unknown as Kysely<Db>;

    // Mock synchronizers
    mockFullSynchronizer = vi.fn().mockReturnValue({ stop: vi.fn() }) as unknown as FullSynchronizeFunction;
    mockPartialSynchronizer = vi.fn().mockReturnValue({ stop: vi.fn() }) as unknown as PartialSynchronizeFunction;
  });

  it('should pass a string (not a Promise) to partialSynchronizer when full sync is completed', async () => {
    // Setup: full sync is completed
    const mockSyncData = { key: 'full_sync_completed', value: 'true' };
    const mockEmailData = { history_id: '12345' };

    mockExecuteTakeFirst
      .mockResolvedValueOnce(mockSyncData) // For fullSyncCompleted check
      .mockResolvedValueOnce(mockEmailData); // For partialSyncMarker

    // Act
    processSynchronizer(mockDb, mockFullSynchronizer, mockPartialSynchronizer, {
      onLabelsFetched: vi.fn(),
      onEmailCreated: vi.fn(),
      onEmailDeleted: vi.fn(),
      onEmailLabelAdded: vi.fn(),
      onEmailLabelRemoved: vi.fn(),
      getExistingMessageIds: vi.fn(),
    });

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Assert: partialSynchronizer should be called with a string, not a Promise
    expect(mockPartialSynchronizer).toHaveBeenCalled();
    const calls = vi.mocked(mockPartialSynchronizer).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const firstArg = calls[0]?.[0];
    expect(typeof firstArg).toBe('string');
    expect(firstArg).toBe('12345');
    expect(mockFullSynchronizer).not.toHaveBeenCalled();
  });

  it('should call fullSynchronizer when full sync is not completed', async () => {
    // Setup: full sync is not completed
    const mockSyncData = { key: 'full_sync_completed', value: 'false' };

    mockExecuteTakeFirst.mockResolvedValueOnce(mockSyncData);

    // Act
    processSynchronizer(mockDb, mockFullSynchronizer, mockPartialSynchronizer, {
      onLabelsFetched: vi.fn(),
      onEmailCreated: vi.fn(),
      onEmailDeleted: vi.fn(),
      onEmailLabelAdded: vi.fn(),
      onEmailLabelRemoved: vi.fn(),
      getExistingMessageIds: vi.fn(),
    });

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Assert
    expect(mockFullSynchronizer).toHaveBeenCalled();
    expect(mockPartialSynchronizer).not.toHaveBeenCalled();
  });

  it('should use default history_id "0" when no emails exist', async () => {
    // Setup: full sync is completed but no emails exist
    const mockSyncData = { key: 'full_sync_completed', value: 'true' };

    mockExecuteTakeFirst
      .mockResolvedValueOnce(mockSyncData) // For fullSyncCompleted check
      .mockResolvedValueOnce(undefined); // For partialSyncMarker - no emails

    // Act
    processSynchronizer(mockDb, mockFullSynchronizer, mockPartialSynchronizer, {
      onLabelsFetched: vi.fn(),
      onEmailCreated: vi.fn(),
      onEmailDeleted: vi.fn(),
      onEmailLabelAdded: vi.fn(),
      onEmailLabelRemoved: vi.fn(),
      getExistingMessageIds: vi.fn(),
    });

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Assert: partialSynchronizer should be called with "0" as default
    expect(mockPartialSynchronizer).toHaveBeenCalled();
    const calls = vi.mocked(mockPartialSynchronizer).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const firstArg = calls[0]?.[0];
    expect(typeof firstArg).toBe('string');
    expect(firstArg).toBe('0');
  });

  it('should handle database errors gracefully and use default history_id', async () => {
    // Setup: full sync is completed but database query fails
    const mockSyncData = { key: 'full_sync_completed', value: 'true' };

    mockExecuteTakeFirst
      .mockResolvedValueOnce(mockSyncData) // For fullSyncCompleted check
      .mockRejectedValueOnce(new Error('Database error')); // For partialSyncMarker - error

    // Act
    processSynchronizer(mockDb, mockFullSynchronizer, mockPartialSynchronizer, {
      onLabelsFetched: vi.fn(),
      onEmailCreated: vi.fn(),
      onEmailDeleted: vi.fn(),
      onEmailLabelAdded: vi.fn(),
      onEmailLabelRemoved: vi.fn(),
      getExistingMessageIds: vi.fn(),
    });

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Assert: partialSynchronizer should be called with "0" as default on error
    expect(mockPartialSynchronizer).toHaveBeenCalled();
    const calls = vi.mocked(mockPartialSynchronizer).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const firstArg = calls[0]?.[0];
    expect(typeof firstArg).toBe('string');
    expect(firstArg).toBe('0');
  });
});

