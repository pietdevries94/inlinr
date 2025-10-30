import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processSynchronizer } from './processSynchronizer';
import { PGlite } from '@electric-sql/pglite';
import { createKyselyDb } from '@/data/db';
import type { Kysely } from 'kysely';
import type { Db } from '@/data/db';
import type { FullSynchronizeFunction, PartialSynchronizeFunction } from './types';

describe('processSynchronizer', () => {
  let db: Kysely<Db>;
  let pglite: PGlite;
  let mockFullSynchronizer: FullSynchronizeFunction;
  let mockPartialSynchronizer: PartialSynchronizeFunction;

  beforeEach(async () => {
    // Create in-memory database
    pglite = new PGlite();
    db = await createKyselyDb(pglite);

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

  afterEach(async () => {
    try {
      await pglite.close();
    } catch {
      // Ignore cleanup errors
    }
  });

  // Helper function to wait for synchronizer to complete
  const waitForSynchronizer = () => {
    return new Promise<void>((resolve) => {
      processSynchronizer(db, mockFullSynchronizer, mockPartialSynchronizer, {
        onComplete: () => resolve(),
      });
    });
  };

  it('should pass a string to partialSynchronizer when full sync is completed', async () => {
    // Setup: mark full sync as completed and add an email with history_id
    await db
      .insertInto('synchronization_data')
      .values({ key: 'full_sync_completed', value: 'true' })
      .execute();

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
        history_id: '12345',
        thread_id: 'thread1',
      })
      .execute();

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
    // Setup: full sync not completed (no record in synchronization_data)

    // Act
    await waitForSynchronizer();

    // Assert
    expect(mockFullSynchronizer).toHaveBeenCalled();
    expect(mockPartialSynchronizer).not.toHaveBeenCalled();
  });

  it('should use default history_id "0" when no emails exist', async () => {
    // Setup: full sync is completed but no emails exist
    await db
      .insertInto('synchronization_data')
      .values({ key: 'full_sync_completed', value: 'true' })
      .execute();

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
});
