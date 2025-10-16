import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('emails')
    .addColumn('id', 'varchar', (col) => col.primaryKey())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('body', 'text', (col) => col.notNull())
    .addColumn('sender', 'varchar', (col) => col.notNull())
    .addColumn('recipient', 'varchar', (col) => col.notNull())
    .addColumn('cc', 'varchar', (col) => col.notNull())
    .addColumn('sent_at', 'timestamp', (col) => col.notNull())
    .addColumn('thread_id', 'varchar', (col) => col.notNull())
    .addColumn('history_id', 'varchar', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('labels')
    .addColumn('id', 'varchar', (col) => col.primaryKey())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addCheckConstraint('type_check', sql`type IN ('system', 'user')`)
    .execute();

  await db.schema
    .createTable('email_labels')
    .addColumn('email_id', 'varchar', (col) => col.notNull())
    .addColumn('label_id', 'varchar', (col) => col.notNull())
    .addForeignKeyConstraint('fk_email', ['email_id'], 'emails', ['id'])
    .addForeignKeyConstraint('fk_label', ['label_id'], 'labels', ['id'])
    .addUniqueConstraint('uq_email_label', ['email_id', 'label_id'])
    .execute();

  await db.schema
    .createTable('synchronization_data')
    .addColumn('key', 'varchar', (col) => col.primaryKey())
    .addColumn('value', 'text', (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('synchronization_data').execute();
  await db.schema.dropTable('email_labels').execute();
  await db.schema.dropTable('labels').execute();
  await db.schema.dropTable('emails').execute();
}
