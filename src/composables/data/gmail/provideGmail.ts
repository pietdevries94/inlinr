import type { GmailClient } from '@/data/gmail';
import { provide } from 'vue';
import { GmailKey } from './types';

export function provideGmail(gmailClient: GmailClient) {
	provide(GmailKey, gmailClient);
}
