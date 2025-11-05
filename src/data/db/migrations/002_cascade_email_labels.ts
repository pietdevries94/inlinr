import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable('email_labels').dropConstraint('email_labels_email_id_fkey').execute();

	await db.schema
		.alterTable('email_labels')
		.addForeignKeyConstraint(
			'email_labels_email_id_fkey',
			['email_id'],
			'emails',
			['id'],
			(fkBuilder) => fkBuilder.onDelete('cascade'),
		)
		.execute();

	await db.schema.alterTable('email_labels').dropConstraint('email_labels_label_id_fkey').execute();

	await db.schema
		.alterTable('email_labels')
		.addForeignKeyConstraint(
			'email_labels_label_id_fkey',
			['label_id'],
			'labels',
			['id'],
			(fkBuilder) => fkBuilder.onDelete('cascade'),
		)
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable('email_labels').dropConstraint('email_labels_email_id_fkey').execute();

	await db.schema
		.alterTable('email_labels')
		.addForeignKeyConstraint('email_labels_email_id_fkey', ['email_id'], 'emails', ['id'])
		.execute();

	await db.schema.alterTable('email_labels').dropConstraint('email_labels_label_id_fkey').execute();

	await db.schema
		.alterTable('email_labels')
		.addForeignKeyConstraint('email_labels_label_id_fkey', ['label_id'], 'labels', ['id'])
		.execute();
}
