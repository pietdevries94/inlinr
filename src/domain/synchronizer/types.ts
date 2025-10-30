import type { Email, Label } from '@/data/entities';
import type { Result } from '@/utils/result';

export interface SynchronizerDataStore {
  /**
   * Get the partial sync marker (history_id from the most recent email)
   * Returns '0' if no emails exist or on error
   */
  getPartialSyncMarker(): Promise<string>;
  isFullSyncCompleted(): Promise<boolean>;
  setFullSyncCompleted(): Promise<Result<void>>;
  upsertLabels(labels: Label[]): Promise<Result<void>>;
  insertEmails(emails: Email[]): Promise<Result<void>>;
  deleteEmails(emailIds: string[]): Promise<Result<void>>;
  addLabelsToEmail(emailId: string, labelIds: string[]): Promise<Result<void>>;
  removeLabelsFromEmail(emailId: string, labelIds: string[]): Promise<Result<void>>;
  getExistingMessageIds(): Promise<Set<string>>;
}

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
