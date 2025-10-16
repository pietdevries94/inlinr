import type { MigrationProvider } from 'kysely';

export const migrationProvider = {
  async getMigrations() {
    return {
      '001_create_email_table': await import('./0001_create_email_table'),
    };
  },
} satisfies MigrationProvider;
