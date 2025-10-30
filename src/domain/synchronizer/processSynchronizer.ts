import type {
  FullSynchronizeFunction,
  PartialSynchronizeFunction,
  SynchronizeOptions,
} from './types';
import type { SynchronizerDataStore } from './types';
import { createResult } from '@/utils/result';

export function processSynchronizer(
  dataStore: SynchronizerDataStore,
  fullSynchronizer: FullSynchronizeFunction,
  partialSynchronizer: PartialSynchronizeFunction,
  options?: Partial<SynchronizeOptions>,
) {
  let syncResult: ReturnType<FullSynchronizeFunction> | ReturnType<PartialSynchronizeFunction>;
  process(
    dataStore,
    fullSynchronizer,
    partialSynchronizer,
    enrichSynchronizeOptions(dataStore, options),
  ).then((result) => {
    syncResult = result;
  });
  return {
    stop() {
      syncResult?.stop();
    },
  };
}

async function process(
  dataStore: SynchronizerDataStore,
  fullSynchronizer: FullSynchronizeFunction,
  partialSynchronizer: PartialSynchronizeFunction,
  options: SynchronizeOptions,
) {
  if (await dataStore.isFullSyncCompleted()) {
    return partialSynchronizer(await dataStore.getPartialSyncMarker(), options);
  }
  return fullSynchronizer(options);
}

function enrichSynchronizeOptions(
  dataStore: SynchronizerDataStore,
  options?: Omit<Partial<SynchronizeOptions>, 'getExistingMessageIds'>,
): SynchronizeOptions {
  return {
    ...options,
    onLabelsFetched: async (labels) => {
      const res = await dataStore.upsertLabels(labels);
      if (res.hasError()) return res;
      if (!options?.onLabelsFetched) return res;
      return options?.onLabelsFetched?.(labels);
    },
    onComplete: async () => {
      await dataStore.setFullSyncCompleted();
      options?.onComplete?.();
    },
    onEmailCreated: async (emails) => {
      const res = await dataStore.insertEmails(emails);
      if (res.hasError()) return res;
      if (!options?.onEmailCreated) return res;
      return options.onEmailCreated(emails);
    },
    onEmailDeleted: async (emailIds) => {
      const res = await dataStore.deleteEmails(emailIds);
      if (res.hasError()) return res;
      if (!options?.onEmailDeleted) return createResult<void>(void 0);
      return options?.onEmailDeleted?.(emailIds);
    },
    onEmailLabelAdded: async (emailId, labelIds) => {
      const res = await dataStore.addLabelsToEmail(emailId, labelIds);
      if (res.hasError()) return res;
      if (!options?.onEmailLabelAdded) return createResult<void>(void 0);
      return options?.onEmailLabelAdded?.(emailId, labelIds);
    },
    onEmailLabelRemoved: async (emailId, labelIds) => {
      const res = await dataStore.removeLabelsFromEmail(emailId, labelIds);
      if (res.hasError()) return res;
      if (!options?.onEmailLabelRemoved) return createResult<void>(void 0);
      return options?.onEmailLabelRemoved?.(emailId, labelIds);
    },
    getExistingMessageIds: async () => {
      return await dataStore.getExistingMessageIds();
    },
  };
}
