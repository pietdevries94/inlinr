<script setup lang="ts">
import GmailSynchronizer from '@/components/synchronizer/GmailSynchronizer.vue';
import '@electric-sql/pglite-repl/webcomponent';
import { injectPGlite } from '@electric-sql/pglite-vue';

const pg = injectPGlite();
</script>

<template>
	<GmailSynchronizer />
	<pglite-repl :pg="pg" />
</template>
