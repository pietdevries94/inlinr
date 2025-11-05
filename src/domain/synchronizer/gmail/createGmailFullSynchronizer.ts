import type { GmailClient } from '@/data/gmail';
import type { FullSynchronizeFunction } from '../types';
import { fetchAndProcessEmails } from './fetchAndProcessEmails';
import { fetchAndProcessLabels } from './fetchAndProcessLabels';

const MESSAGE_LIST_QUERY = 'after:2025-01-01';

// Really basic Gmail synchronizer implementation. In a real-world scenario, you would want to handle pagination, rate limits, and more.
export const createGmailFullSynchronizer =
	(gmailClient: GmailClient): FullSynchronizeFunction =>
	(options) => {
		let isStopped = false;

		const synchronize = async () => {
			if (isStopped) return;
			await fetchAndProcessLabels(gmailClient, options);

			if (isStopped) return;
			const messageIds = await getAllMessageIds(gmailClient, () => isStopped, options.onError);

			await fetchAndProcessEmails(gmailClient, options, () => isStopped, messageIds);

			if (!isStopped) {
				await options.onComplete?.();
			}
		};

		synchronize();
		return {
			stop() {
				isStopped = true;
			},
		};
	};

async function getAllMessageIds(
	gmailClient: GmailClient,
	isStopped: () => boolean,
	onError?: (error: Error) => Promise<void> | void,
) {
	let pageToken: string | undefined;
	let hasNextPage = true;
	const messageIds: string[] = [];

	while (hasNextPage && !isStopped()) {
		const messages = await gmailClient.listMessages(MESSAGE_LIST_QUERY, pageToken);
		if (messages.hasError()) {
			await onError?.(messages.error);
			return [];
		}
		messageIds.push(...messages.value.messageIds);
		pageToken = messages.value.nextPageToken;
		hasNextPage = !!pageToken;
	}
	return messageIds;
}
