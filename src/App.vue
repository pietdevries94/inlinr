<script setup lang="ts">
import DbProvider from './components/providers/DbProvider.vue';
import GmailProvider from './components/providers/GmailProvider.vue';
</script>

<template>
	<main class="dark:bg-black dark:text-white min-h-dvh">
		<GmailProvider>
			<Suspense>
				<DbProvider>
					<RouterView />
				</DbProvider>
			</Suspense>
		</GmailProvider>
	</main>
</template>
