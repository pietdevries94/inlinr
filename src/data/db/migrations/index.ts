import type { MigrationProvider } from 'kysely';

export const migrationProvider = {
	async getMigrations() {
		return {
			'001_create_email_table': await import('./001_create_email_table'),
			'002_cascade_email_labels': await import('./002_cascade_email_labels'),
		};
	},
} satisfies MigrationProvider;
