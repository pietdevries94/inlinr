import { inject } from 'vue';
import { GmailKey } from './types';

export function injectGmail() {
  const gmail = inject(GmailKey);
  if (!gmail) {
    throw new Error('Gmail service not provided');
  }

  return gmail;
}
