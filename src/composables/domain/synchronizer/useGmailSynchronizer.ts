import { injectKyselyDb } from '@/composables/data/db';
import { injectGmail } from '@/composables/data/gmail';
import { processSynchronizer } from '@/domain/synchronizer';
import { createKyselyDataStore } from '@/domain/synchronizer/dataStore';
import {
  createGmailFullSynchronizer,
  createGmailPartialSynchronizer,
} from '@/domain/synchronizer/gmail';
import { ref } from 'vue';

export function useGmailSynchronizer() {
  const gmail = injectGmail();
  const db = injectKyselyDb();

  const progress = ref<number>();
  const total = ref<number>();
  const hasError = ref(false);
  const error = ref<Error>();
  const isComplete = ref(false);
  const stopFn = ref<() => void>();

  const synchronize = async () => {
    if (!gmail.isSignedIn()) {
      await gmail.signIn();
    }

    const dataStore = createKyselyDataStore(db);

    const syncStatus = processSynchronizer(
      dataStore,
      createGmailFullSynchronizer(gmail),
      createGmailPartialSynchronizer(gmail),
      {
        onProgress(progressVal, totalVal) {
          progress.value = progressVal;
          total.value = totalVal;
        },
        onComplete() {
          isComplete.value = true;
        },
        onError(errorVal) {
          console.error('Synchronization error:', errorVal);
          hasError.value = true;
          error.value = errorVal;
        },
      },
    );
    stopFn.value = syncStatus.stop;
  };

  return {
    progress: progress as Readonly<typeof progress>,
    total: total as Readonly<typeof total>,
    hasError: hasError as Readonly<typeof hasError>,
    error: error as Readonly<typeof error>,
    isComplete: isComplete as Readonly<typeof isComplete>,
    stop: () => stopFn.value?.(),
    synchronize,
  };
}
