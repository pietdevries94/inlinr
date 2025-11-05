import type { GmailClient } from '@/data/gmail';
import type { PartialSynchronizeFunction } from '../types';
import { fetchAndProcessEmails } from './fetchAndProcessEmails';
import { fetchAndProcessLabels } from './fetchAndProcessLabels';
import type { Result } from '@/utils/result';

// Really basic Gmail synchronizer implementation. In a real-world scenario, you would want to handle pagination, rate limits, and more.
export const createGmailPartialSynchronizer =
	(gmailClient: GmailClient): PartialSynchronizeFunction =>
	// oxlint-disable-next-line no-unused-vars
	(partialSyncMarker, options) => {
		let isStopped = false;
		const errorChecker = options.onError
			? async (res: Promise<Result<void>> | Result<void>) => {
					const r = await res;
					if (r.hasError()) options.onError?.(r.error);
				}
			: // eslint-disable-next-line @typescript-eslint/no-unused-vars
				(_: unknown) => {};

		const synchronize = async () => {
			if (isStopped) return;
			await fetchAndProcessLabels(gmailClient, options);

			if (isStopped) return;
			if (typeof partialSyncMarker !== 'string') {
				options.onError?.(new Error('Invalid partialSyncMarker for Gmail partial synchronizer'));
				return;
			}

			let nextPageToken: string | undefined;
			const addedIds: string[] = [];
			do {
				if (isStopped) return;

				const historyResponse = await gmailClient.getHistory(partialSyncMarker, nextPageToken);
				if (historyResponse.hasError()) {
					options.onError?.(historyResponse.error);
					return;
				}

				const history = historyResponse.value;
				nextPageToken = history.nextPageToken;

				history.histories.forEach((historyRecord) => {
					if (isStopped) return;
					if (historyRecord.hasError()) {
						options.onError?.(historyRecord.error);
						return;
					}

					const record = historyRecord.value;
					// Collect the ids of added messages to be fetched later
					record.messagesAdded?.forEach((added) => {
						if (isStopped) return;
						if (added.message?.id) addedIds.push(added.message.id);
					});
					record.messagesDeleted?.forEach((deleted) => {
						if (isStopped) return;
						if (deleted.message?.id) {
							const result = options.onEmailDeleted?.([deleted.message.id]);
							if (result) errorChecker(result);
						}
					});
					record.labelsAdded?.forEach((labelAdded) => {
						if (isStopped) return;
						if (labelAdded.message?.id && labelAdded.labelIds) {
							const result = options.onEmailLabelAdded?.(
								labelAdded.message.id,
								labelAdded.labelIds,
							);
							if (result) errorChecker(result);
						}
					});
					record.labelsRemoved?.forEach((labelRemoved) => {
						if (isStopped) return;
						if (labelRemoved.message?.id && labelRemoved.labelIds) {
							const result = options.onEmailLabelRemoved?.(
								labelRemoved.message.id,
								labelRemoved.labelIds,
							);
							if (result) errorChecker(result);
						}
					});
				});
			} while (nextPageToken && !isStopped);

			await fetchAndProcessEmails(gmailClient, options, () => isStopped, addedIds);

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
