import type { Kysely } from 'kysely';
import type { Db } from '@/data/db';
import type { InjectionKey } from 'vue';

export const KyselyDBKey: InjectionKey<Kysely<Db>> = Symbol('KyselyDB');
