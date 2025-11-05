import { isRef, ref, watch, type WatchSource } from 'vue';
import { useLiveIncrementalQuery } from '@electric-sql/pglite-vue';
import type { Compilable } from 'kysely';

export function useKyselyLiveIncrementalQuery<O, K extends keyof O>(
	querybuilder: Compilable<O> | WatchSource<Compilable<O>>,
	key: K | WatchSource<K>,
) {
	if (!isRef(querybuilder) && typeof querybuilder === 'object') {
		const { sql, parameters } = querybuilder.compile();
		return useLiveIncrementalQuery<O>(sql, [...parameters], key as string);
	}

	const sql = ref('');
	const parameters = ref<unknown[]>([]);

	watch(
		querybuilder,
		(newQuerybuilder) => {
			const compiled = newQuerybuilder.compile();
			sql.value = compiled.sql;
			parameters.value = [...compiled.parameters];
		},
		{ immediate: true, deep: false },
	);

	return useLiveIncrementalQuery<O>(sql, parameters, key as string);
}
