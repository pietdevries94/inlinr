import { live } from '@electric-sql/pglite/live';
import { Kysely, Migrator } from 'kysely';
import { PGliteDialect } from 'kysely-pglite-dialect';
import { migrationProvider } from './migrations';
import PGWorker from './worker?worker';
import { PGliteWorker } from '@electric-sql/pglite/worker';
import type { PGlite } from '@electric-sql/pglite';

export type Db = {
	emails: {
		id: string;
		subject: string;
		body: string;
		sender: string;
		recipient: string;
		cc: string;
		sent_at: Date;
		history_id: string;
		thread_id: string;
	};
	labels: {
		id: string;
		name: string;
		type: 'system' | 'user';
	};
	email_labels: {
		email_id: string;
		label_id: string;
	};
	synchronization_data: {
		key: string;
		value: string;
	};
};

export async function initDB() {
	const rawDb = await PGliteWorker.create(
		new PGWorker({
			name: 'pglite-worker',
		}),
		{
			extensions: {
				live,
			},
		},
	);

	const db = await createKyselyDb(rawDb);

	return { rawDb, db };
}

export async function createKyselyDb(rawDb: PGliteWorker | PGlite) {
	const db = new Kysely<Db>({
		dialect: new PGliteDialect(rawDb),
	});

	await migrate(db);

	return db;
}

async function migrate(db: Kysely<Db>) {
	const migrator = new Migrator({
		db,
		provider: migrationProvider,
	});

	const { error, results } = await migrator.migrateToLatest();

	results?.forEach((it) => {
		if (it.status === 'Error') {
			console.error(`failed to execute migration "${it.migrationName}"`);
		}
	});

	if (error) {
		console.error('failed to migrate');
		console.error(error);
	}
}
