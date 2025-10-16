import { isRef, ref, watch, type WatchSource } from 'vue';
import { useLiveQuery } from '@electric-sql/pglite-vue';
import type { Compilable } from 'kysely';

export function useKyselyLiveQuery<O>(querybuilder: Compilable<O> | WatchSource<Compilable<O>>) {
  if (!isRef(querybuilder) && typeof querybuilder === 'object') {
    const { sql, parameters } = querybuilder.compile();
    return useLiveQuery<O>(sql, [...parameters]);
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

  return useLiveQuery<O>(sql, parameters);
}
