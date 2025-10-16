import { providePGlite } from '@electric-sql/pglite-vue';
import { provide } from 'vue';
import { KyselyDBKey } from './types';
import type { PGliteWithLive } from '@electric-sql/pglite/live';
import type { Kysely } from 'kysely';
import type { Db } from '@/data/db';

export function provideKyselyDb(rawDb: PGliteWithLive, db: Kysely<Db>) {
  providePGlite(rawDb);
  provide(KyselyDBKey, db);
}
