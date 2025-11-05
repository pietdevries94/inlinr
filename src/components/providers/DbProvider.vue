<script setup lang="ts">
import { initDB } from '@/data/db';
import { provideKyselyDb } from '@/composables/data/db';

const { rawDb, db } = await initDB();
provideKyselyDb(rawDb, db);
</script>

<template>
	<slot />
</template>
