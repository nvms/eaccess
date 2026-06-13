<template>
  <div class="flex items-center gap-3 py-1.5">
    <span class="flex w-44 shrink-0 items-center gap-2 truncate text-sm text-muted-foreground">
      <span v-if="dot" class="size-1.5 shrink-0 rounded-full" :class="dot" />
      {{ label }}
    </span>
    <div class="h-1 flex-1 overflow-hidden rounded-full bg-muted">
      <div class="h-full rounded-full bg-foreground/35 transition-[width] duration-500" :style="{ width: `${percent}%` }" />
    </div>
    <span class="w-12 shrink-0 text-right text-sm font-medium tabular-nums">{{ count.toLocaleString() }}</span>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";

const props = defineProps<{
  label: string;
  count: number;
  max: number;
  dot?: string;
}>();

const percent = computed(() => (props.max > 0 ? Math.max(2, (props.count / props.max) * 100) : 0));
</script>
