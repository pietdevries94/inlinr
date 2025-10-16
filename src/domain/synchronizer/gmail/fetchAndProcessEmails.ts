import type { Email } from '@/data/entities';
import type { GmailClient } from '@/data/gmail';
import type { Result } from '@/utils/result';
import type { SynchronizeOptions } from '../types';

const MESSAGE_BATCH_SIZE = 10;

export async function fetchAndProcessEmails(
  gmailClient: GmailClient,
  options: SynchronizeOptions,
  isStopped: () => boolean,
  messageIds: string[],
) {
  const process = createProcessMessageResponse(options.onEmailCreated, options.onError);

  let maxHistoryId: string | undefined;
  for (let i = 0; i < messageIds.length; i += MESSAGE_BATCH_SIZE) {
    if (isStopped()) break;
    const batchIds = messageIds.slice(i, i + MESSAGE_BATCH_SIZE);
    const batchMessages = await gmailClient.getMessages(batchIds);

    process(batchMessages);

    batchMessages.forEach((msg) => {
      if (msg.hasError()) return;
      // Update maxHistoryId
      const historyId = msg.value.historyId;
      if (historyId && (maxHistoryId === undefined || historyId > maxHistoryId))
        maxHistoryId = historyId;
    });

    const progress = Math.min(i + MESSAGE_BATCH_SIZE, messageIds.length);
    await options.onProgress?.(progress, messageIds.length);
  }
  return maxHistoryId;
}

function createProcessMessageResponse(
  onEmailCreated?: (emails: Email[]) => Promise<Result<void>> | Result<void>,
  onError?: (error: Error) => void,
) {
  return async (msgs: Result<gapi.client.gmail.Message>[]) => {
    const convertedEmails = msgs
      .map((msg) => {
        if (msg.hasError()) {
          onError?.(msg.error);
          return null;
        }
        if (!messageHasId(msg.value)) return null;
        return gmailMessageToEmail(msg.value);
      })
      .filter((msg) => !!msg);
    if (!onEmailCreated) return;
    const res = await onEmailCreated?.(convertedEmails);
    if (res.hasError()) onError?.(res.error);
  };
}

function messageHasId(
  message: gapi.client.gmail.Message,
): message is gapi.client.gmail.Message & { id: string } {
  return typeof message.id === 'string';
}

function gmailMessageToEmail(message: gapi.client.gmail.Message & { id: string }): Email {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || '';

  const bodyBase64 =
    message?.payload?.parts?.find((part) => part.mimeType === 'text/plain')?.body?.data ||
    message?.payload?.body?.data;

  let body = message.snippet || '';
  if (bodyBase64) {
    try {
      // @ts-expect-error: fromBase64 is not in the TypeScript definitions yet
      const uint8Array: Uint8Array = Uint8Array.fromBase64(bodyBase64, {
        alphabet: 'base64url',
      });
      body = new TextDecoder().decode(uint8Array);
    } catch (e) {
      console.warn('Failed to decode email body, using snippet instead.', e);
      body = bodyBase64;
    }
  }

  return {
    id: message.id,
    subject: getHeader('Subject'),
    body,
    sender: getHeader('From'),
    recipient: getHeader('To'),
    cc: getHeader('Cc'),
    sentAt: new Date(getHeader('Date')),
    historyId: message.historyId || '',
    labelIds: message.labelIds || [],
    threadId: message.threadId || '',
  };
}
