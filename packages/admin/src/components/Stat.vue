<template>
  <div class="relative space-y-3 p-2 border rounded overflow-hidden shadow-xs" :class="[containerClasses, backgroundColorClasses]">
    <!-- Large background icon -->
    <div v-if="icon" class="absolute right-8 top-1/2 -translate-y-1/2 opacity-15">
      <Icon :icon="icon" class="w-15 h-15" :class="backgroundIconClasses" />
    </div>

    <!-- Content -->
    <div class="relative z-10">
      <div class="flex items-start justify-between">
        <div class="text-sm font-medium" :class="titleClasses">
          {{ title }}
        </div>
      </div>
      <div class="text-2xl font-light" :class="valueClasses">
        <span v-if="loading">-</span>
        <span v-else>{{ formattedValue }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { Icon } from "@iconify/vue";

const props = defineProps<{
  title: string;
  value: number | string | null | undefined;
  loading?: boolean;
  icon?: string;
  iconColor?: string;
}>();

const formattedValue = computed(() => {
  if (props.value === null || props.value === undefined) {
    return "0";
  }

  if (typeof props.value === "number") {
    return props.value.toLocaleString();
  }

  return props.value;
});

const containerClasses = computed(() => {
  return "";
});

const titleClasses = computed(() => {
  return "text-neutral-400 dark:text-neutral-600";
});

const valueClasses = computed(() => {
  return "text-neutral-900 dark:text-neutral-100";
});

const backgroundIconClasses = computed(() => {
  return props.iconColor || "text-neutral-400 dark:text-neutral-500";
});

const backgroundColorClasses = computed(() => {
  return "bg-background";
});
</script>
