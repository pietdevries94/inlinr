import type { GmailClient } from '@/data/gmail';
import type { SynchronizeOptions } from '../types';
import type { Label } from '@/data/entities';

export async function fetchAndProcessLabels(gmailClient: GmailClient, options: SynchronizeOptions) {
  if (!options.onLabelsFetched) return;

  const res = await gmailClient.listLabels();
  if (res.hasError()) {
    await options.onError?.(res.error);
    return;
  }

  const labels = res.value.map(
    (label) =>
      ({
        id: label.id || '',
        name: label.name || '',
        type: (label.type as 'user' | 'system') || 'user',
      }) satisfies Label,
  );

  const hookRes = await options.onLabelsFetched(labels);
  if (hookRes.hasError()) options.onError?.(hookRes.error);
}
