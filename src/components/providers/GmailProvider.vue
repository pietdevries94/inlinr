<script setup lang="ts">
import { GmailClient } from '@/data/gmail';
import { provideGmail } from '@/composables/data/gmail';

const gmail = new GmailClient();
provideGmail(gmail);
</script>

<template>
  <slot />
</template>
