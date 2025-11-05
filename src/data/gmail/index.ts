/// <reference types="gapi" />
/// <reference types="gapi.client" />
/// <reference types="gapi.client.gmail-v1" />
/// <reference types="google.accounts" />

import { createErrorResult, createResult, type Result } from '@/utils/result';
import { RateLimiter } from 'limiter';

function loadGapi(): Promise<void> {
	return new Promise((resolve, reject) => {
		if (typeof gapi !== 'undefined') {
			resolve();
			return;
		}

		const script = document.createElement('script');
		script.src = 'https://apis.google.com/js/api.js';
		script.onload = () => resolve();
		script.onerror = () => reject(new Error('Failed to load Google API script'));
		document.head.appendChild(script);
	});
}

function loadGsi(): Promise<void> {
	return new Promise((resolve, reject) => {
		if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
			resolve();
			return;
		}

		const script = document.createElement('script');
		script.src = 'https://accounts.google.com/gsi/client';
		script.onload = () => resolve();
		script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
		document.head.appendChild(script);
	});
}

export class GmailClient {
	private isInitialized = false;
	private accessToken: string | null = null;
	// official Gmail API limit is 15000 requests per 1 minute per user, using 3000 to be safe, due to weird batching behavior on the server side
	private limiter = new RateLimiter({ tokensPerInterval: 3000, interval: 'minute' });

	private readonly CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
	private readonly API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
	private readonly SCOPES =
		'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.profile';

	async initialize(): Promise<void> {
		if (this.isInitialized) return;

		await Promise.all([loadGapi(), loadGsi()]);

		await new Promise<void>((resolve, reject) => {
			gapi.load('client', {
				callback: () => resolve(),
				onerror: () => reject(new Error('Failed to load GAPI client')),
			});
		});

		await gapi.client.init({
			apiKey: this.API_KEY,
			discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'],
		});

		this.isInitialized = true;
	}

	async signIn(silent = true): Promise<void> {
		if (!this.isInitialized) {
			await this.initialize();
		}

		return new Promise((resolve, reject) => {
			const tokenClient = google.accounts.oauth2.initTokenClient({
				client_id: this.CLIENT_ID,
				scope: this.SCOPES,
				callback: (response) => {
					if (response.access_token) {
						this.accessToken = response.access_token;
						gapi.client.setToken({ access_token: response.access_token });

						resolve();
					} else if (response.error) {
						reject(
							new Error(`Error during sign-in: ${response.error} - ${response.error_description}`),
						);
					} else {
						reject(new Error('Failed to obtain access token'));
					}
				},
			});

			tokenClient.requestAccessToken({ prompt: silent ? '' : 'consent' });
		});
	}

	signOut(): void {
		if (this.accessToken) {
			google.accounts.oauth2.revoke(this.accessToken, () => {
				this.accessToken = null;
				gapi.client.setToken(null);
			});
		}
	}

	isSignedIn(): boolean {
		return this.accessToken !== null;
	}

	signedInOrThrow(): void {
		if (!this.isSignedIn()) {
			throw new Error('User not signed in');
		}
	}

	async listMessages(
		query?: string,
		pageToken?: string,
		maxResults: number = 100,
	): Promise<
		Result<{
			messageIds: string[];
			nextPageToken?: string;
			resultSizeEstimate?: number;
		}>
	> {
		this.signedInOrThrow();

		try {
			await this.limiter.removeTokens(5);
			const response = await gapi.client.gmail.users.messages.list({
				userId: 'me',
				maxResults: maxResults,
				pageToken: pageToken,
				q: query,
			});

			const messageIds = response.result.messages
				? response.result.messages.map((msg) => msg.id).filter((id) => id !== undefined)
				: [];

			return createResult({
				messageIds,
				nextPageToken: response.result.nextPageToken,
				resultSizeEstimate: response.result.resultSizeEstimate,
			});
		} catch (error) {
			return createErrorResult(error);
		}
	}

	async getMessages(messageIds: string[]): Promise<Result<gapi.client.gmail.Message>[]> {
		this.signedInOrThrow();

		await this.limiter.removeTokens(messageIds.length * 5);
		const batch: gapi.client.Batch<gapi.client.gmail.Message> = gapi.client.newBatch();
		messageIds.forEach((id) => {
			batch.add(
				gapi.client.gmail.users.messages.get({
					userId: 'me',
					id: id,
				}),
			);
		});
		batch.execute(() => {});

		try {
			const response = await batch;
			const messages = Object.values(response.result).map((res) =>
				res.result.id
					? createResult(res.result)
					: createErrorResult<gapi.client.gmail.Message>(res.result),
			);
			return messages;
		} catch (error) {
			console.error('Error fetching messages:', error);
			return [];
		}
	}

	async getHistory(
		historyId: string,
		pageToken?: string,
	): Promise<
		Result<{
			histories: Result<gapi.client.gmail.History>[];
			nextPageToken?: string;
			historyId?: string;
		}>
	> {
		this.signedInOrThrow();

		try {
			await this.limiter.removeTokens(2);
			const response = await gapi.client.gmail.users.history.list({
				userId: 'me',
				startHistoryId: historyId,
				historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
				pageToken,
			});

			const histories = response.result.history
				? response.result.history.map((history) => createResult(history))
				: [];

			return createResult({
				histories,
				nextPageToken: response.result.nextPageToken,
				historyId: response.result.historyId,
			});
		} catch (error) {
			return createErrorResult(error);
		}
	}

	async listLabels(): Promise<Result<gapi.client.gmail.Label[]>> {
		this.signedInOrThrow();

		try {
			await this.limiter.removeTokens(1);
			const response = await gapi.client.gmail.users.labels.list({
				userId: 'me',
			});

			return createResult(response.result.labels || []);
		} catch (error) {
			return createErrorResult(error);
		}
	}
}
