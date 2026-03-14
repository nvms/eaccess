<template>
  <div class="relative" ref="filterContainer">
    <Button @click="togglePopover" class="gap-2 text-neutral-500 rounded-full cursor-pointer" variant="outline" size="sm">
      <Icon icon="mdi:clock-outline" class="w-4 h-4" />
      <span>{{ filterLabel }}</span>
      <Icon 
        icon="mdi:chevron-down" 
        class="w-4 h-4 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
      />
      
      <button
        @click.stop="removeFilter"
        class="w-4 h-4 rounded-full text-neutral-500 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-colors"
      >
        <Icon icon="mdi:close" class="w-3 h-3" />
      </button>
    </Button>

    <Transition
      enter-active-class="animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
      leave-active-class="animate-out fade-out-0 zoom-out-95 slide-out-to-top-2 duration-150"
    >
      <div 
        v-if="isOpen"
        class="absolute top-full left-0 mt-2 w-64 bg-popover border border-border rounded-md shadow-md z-50 origin-top-left"
      >
        <div class="p-4">
          <div class="text-sm font-medium mb-3">Select Time Range</div>
          <div class="space-y-2">
            <div class="flex items-center space-x-2">
              <input
                id="time-all"
                type="radio"
                value="all"
                v-model="selectedRange"
                class="w-4 h-4"
              />
              <label for="time-all" class="text-sm cursor-pointer">
                All Time
              </label>
            </div>
            <div class="flex items-center space-x-2">
              <input
                id="time-1h"
                type="radio"
                value="1h"
                v-model="selectedRange"
                class="w-4 h-4"
              />
              <label for="time-1h" class="text-sm cursor-pointer">
                Past Hour
              </label>
            </div>
            <div class="flex items-center space-x-2">
              <input
                id="time-24h"
                type="radio"
                value="24h"
                v-model="selectedRange"
                class="w-4 h-4"
              />
              <label for="time-24h" class="text-sm cursor-pointer">
                Past 24 Hours
              </label>
            </div>
            <div class="flex items-center space-x-2">
              <input
                id="time-7d"
                type="radio"
                value="7d"
                v-model="selectedRange"
                class="w-4 h-4"
              />
              <label for="time-7d" class="text-sm cursor-pointer">
                Past Week
              </label>
            </div>
            <div class="flex items-center space-x-2">
              <input
                id="time-30d"
                type="radio"
                value="30d"
                v-model="selectedRange"
                class="w-4 h-4"
              />
              <label for="time-30d" class="text-sm cursor-pointer">
                Past Month
              </label>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { Button } from '../ui/button';

const props = defineProps<{
  config: { selectedRange: string };
}>();

const emit = defineEmits<{
  update: [config: { selectedRange: string }];
  remove: [];
}>();

const isOpen = ref(false);
const filterContainer = ref<HTMLElement>();

const selectedRange = ref(props.config.selectedRange);

const filterLabel = computed(() => {
  return `Time: ${getTimeRangeDisplayName(selectedRange.value)}`;
});

watch(selectedRange, (newRange) => {
  emit('update', { selectedRange: newRange });
});

function togglePopover() {
  isOpen.value = !isOpen.value;
}

function removeFilter() {
  emit('remove');
}

function getTimeRangeDisplayName(range: string): string {
  switch (range) {
    case 'all': return 'All Time';
    case '1h': return 'Past Hour';
    case '24h': return 'Past 24 Hours';
    case '7d': return 'Past Week';
    case '30d': return 'Past Month';
    default: return 'All Time';
  }
}

function handleClickOutside(event: MouseEvent) {
  if (filterContainer.value && !filterContainer.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>