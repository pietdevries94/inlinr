import type { Email, Label } from '@/data/entities';
import type { Result } from '@/utils/result';

export interface SynchronizeOptions {
  onProgress?(progress: number, total: number): Promise<void> | void;
  onComplete?(): Promise<void> | void;
  onError?(error: Error): Promise<void> | void;
  onLabelsFetched(labels: Label[]): Promise<Result<void>> | Result<void>;
  onEmailCreated(emails: Email[]): Promise<Result<void>> | Result<void>;
  onEmailDeleted(emailIds: string[]): Promise<Result<void>> | Result<void>;
  onEmailLabelAdded(emailId: string, labelIds: string[]): Promise<Result<void>> | Result<void>;
  onEmailLabelRemoved(emailId: string, labelIds: string[]): Promise<Result<void>> | Result<void>;
  getExistingMessageIds(): Promise<Set<string>>;
}

export interface SynchronizeStatus {
  stop(): void;
}

export type FullSynchronizeFunction = (options: SynchronizeOptions) => SynchronizeStatus;

export type PartialSynchronizeFunction = (
  partialSyncMarker: unknown,
  options: SynchronizeOptions,
) => SynchronizeStatus;
