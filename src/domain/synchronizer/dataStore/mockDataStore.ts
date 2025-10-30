import type { Email, Label } from '@/data/entities';
import type { SynchronizerDataStore } from '../types';
import { createResult, type Result } from '@/utils/result';

export interface MockDataStore extends SynchronizerDataStore {
  getEmail(emailId: string): Email | undefined;
  getLabel(labelId: string): Label | undefined;
  getEmailLabels(emailId: string): Set<string>;
  getAllEmails(): Email[];
  getAllLabels(): Label[];
  clear(): void;
}

export function createMockDataStore(): MockDataStore {
  const emails = new Map<string, Email>();
  const labels = new Map<string, Label>();
  const emailLabels = new Map<string, Set<string>>(); // emailId -> Set of labelIds
  let fullSyncCompleted = false;

  async function getPartialSyncMarker(): Promise<string> {
    if (emails.size === 0) {
      return '0';
    }

    // Find the most recent email by sentAt date
    let latestEmail: Email | null = null;
    for (const email of emails.values()) {
      if (!latestEmail || email.sentAt > latestEmail.sentAt) {
        latestEmail = email;
      }
    }

    return latestEmail?.historyId || '0';
  }

  async function isFullSyncCompleted(): Promise<boolean> {
    return fullSyncCompleted;
  }

  async function setFullSyncCompleted(): Promise<Result<void>> {
    fullSyncCompleted = true;
    return createResult<void>(void 0);
  }

  async function upsertLabels(labelsToUpsert: Label[]): Promise<Result<void>> {
    for (const label of labelsToUpsert) {
      labels.set(label.id, { ...label });
    }
    return createResult<void>(void 0);
  }

  async function insertEmails(emailsToInsert: Email[]): Promise<Result<void>> {
    for (const email of emailsToInsert) {
      emails.set(email.id, { ...email });

      // Add labels for this email
      if (email.labelIds.length > 0) {
        const existingLabels = emailLabels.get(email.id) || new Set();
        for (const labelId of email.labelIds) {
          existingLabels.add(labelId);
        }
        emailLabels.set(email.id, existingLabels);
      }
    }
    return createResult<void>(void 0);
  }

  async function deleteEmails(emailIds: string[]): Promise<Result<void>> {
    for (const emailId of emailIds) {
      emails.delete(emailId);
      emailLabels.delete(emailId);
    }
    return createResult<void>(void 0);
  }

  async function addLabelsToEmail(emailId: string, labelIds: string[]): Promise<Result<void>> {
    const existingLabels = emailLabels.get(emailId) || new Set();
    for (const labelId of labelIds) {
      existingLabels.add(labelId);
    }
    emailLabels.set(emailId, existingLabels);
    return createResult<void>(void 0);
  }

  async function removeLabelsFromEmail(emailId: string, labelIds: string[]): Promise<Result<void>> {
    const existingLabels = emailLabels.get(emailId);
    if (existingLabels) {
      for (const labelId of labelIds) {
        existingLabels.delete(labelId);
      }
      if (existingLabels.size === 0) {
        emailLabels.delete(emailId);
      }
    }
    return createResult<void>(void 0);
  }

  async function getExistingMessageIds(): Promise<Set<string>> {
    return new Set(emails.keys());
  }

  // Helper functions for testing
  function getEmail(emailId: string): Email | undefined {
    return emails.get(emailId);
  }

  function getLabel(labelId: string): Label | undefined {
    return labels.get(labelId);
  }

  function getEmailLabels(emailId: string): Set<string> {
    return emailLabels.get(emailId) || new Set();
  }

  function getAllEmails(): Email[] {
    return Array.from(emails.values());
  }

  function getAllLabels(): Label[] {
    return Array.from(labels.values());
  }

  function clear(): void {
    emails.clear();
    labels.clear();
    emailLabels.clear();
    fullSyncCompleted = false;
  }

  return {
    getPartialSyncMarker,
    isFullSyncCompleted,
    setFullSyncCompleted,
    upsertLabels,
    insertEmails,
    deleteEmails,
    addLabelsToEmail,
    removeLabelsFromEmail,
    getExistingMessageIds,
    // Helper methods for testing
    getEmail,
    getLabel,
    getEmailLabels,
    getAllEmails,
    getAllLabels,
    clear,
  };
}
