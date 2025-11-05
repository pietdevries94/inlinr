import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable('email_labels').dropConstraint('fk_email').execute();

	await db.schema
		.alterTable('email_labels')
		.addForeignKeyConstraint('fk_email', ['email_id'], 'emails', ['id'], (fkBuilder) =>
			fkBuilder.onDelete('cascade'),
		)
		.execute();

	await db.schema.alterTable('email_labels').dropConstraint('fk_label').execute();

	await db.schema
		.alterTable('email_labels')
		.addForeignKeyConstraint('fk_label', ['label_id'], 'labels', ['id'], (fkBuilder) =>
			fkBuilder.onDelete('cascade'),
		)
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable('email_labels').dropConstraint('fk_email').execute();

	await db.schema
		.alterTable('email_labels')
		.addForeignKeyConstraint('fk_email', ['email_id'], 'emails', ['id'])
		.execute();

	await db.schema.alterTable('email_labels').dropConstraint('fk_label').execute();

	await db.schema
		.alterTable('email_labels')
		.addForeignKeyConstraint('fk_label', ['label_id'], 'labels', ['id'])
		.execute();
}
