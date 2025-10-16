import { inject } from 'vue';
import { KyselyDBKey } from './types';

export function injectKyselyDb() {
  const db = inject(KyselyDBKey);
  if (!db) {
    throw new Error('KyselyDB not provided');
  }

  return db;
}
