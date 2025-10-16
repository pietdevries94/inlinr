<script setup lang="ts">
import { useGmailSynchronizer } from '@/composables/domain/synchronizer/useGmailSynchronizer';

const { progress, total, hasError, error, isComplete, stop, synchronize } = useGmailSynchronizer();
</script>
<template>
  <div class="p-6 max-w-md mx-auto">
    <h2 class="text-2xl font-bold mb-4">Gmail Synchronizer</h2>
    <div class="space-x-2 mb-4">
      <button
        :disabled="!!progress && !isComplete"
        class="bg-blue-500 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded"
        @click="synchronize"
      >
        Start Synchronization
      </button>
      <button
        :disabled="progress === 0 || isComplete"
        class="bg-red-500 hover:bg-red-700 disabled:bg-gray-300 text-white px-4 py-2 rounded"
        @click="stop"
      >
        Stop Synchronization
      </button>
    </div>
    <div v-if="!!progress" class="mb-4">
      <p class="text-gray-700">Progress: {{ progress }} / {{ total }}</p>
    </div>
    <div v-if="hasError" class="mb-4">
      <p class="text-red-600">Error: {{ error?.message }}</p>
    </div>
    <div v-if="isComplete">
      <p class="text-green-600 font-semibold">Synchronization Complete!</p>
    </div>
  </div>
</template>
