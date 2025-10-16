import type { GmailClient } from '@/data/gmail';
import type { InjectionKey } from 'vue';

export const GmailKey: InjectionKey<GmailClient> = Symbol('Gmail');
