<template>
  <div class="relative" ref="filterContainer">
    <div class="inline-flex h-8 items-stretch overflow-hidden rounded-md border bg-card shadow-xs">
      <button type="button" class="flex cursor-pointer items-center gap-1.5 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" @click="togglePopover">
        <Icon icon="mdi:account-check" class="size-3.5" />
        <span>{{ filterLabel }}</span>
        <Icon icon="mdi:chevron-down" class="size-3.5 transition-transform duration-200" :class="{ 'rotate-180': isOpen }" />
      </button>
      <button type="button" class="flex cursor-pointer items-center border-l px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive" aria-label="Remove filter" @click="removeFilter">
        <Icon icon="mdi:close" class="size-3.5" />
      </button>
    </div>

    <Transition
      enter-active-class="animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
      leave-active-class="animate-out fade-out-0 zoom-out-95 slide-out-to-top-2 duration-150"
    >
      <div 
        v-if="isOpen"
        class="absolute top-full left-0 mt-2 w-64 bg-popover border border-border rounded-md shadow-md z-50 origin-top-left"
      >
        <div class="p-4">
          <div class="text-sm font-medium mb-3">Select Status</div>
          <div class="space-y-2">
            <div
              v-for="[statusName, statusValue] in Object.entries(AuthStatus)"
              :key="statusName"
              class="flex items-center space-x-2"
            >
              <Checkbox
                :id="`status-filter-${statusName}`"
                :model-value="selectedStatuses.includes(statusValue as number)"
                @update:model-value="toggleStatus(statusValue as number)"
              />
              <label
                :for="`status-filter-${statusName}`"
                class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {{ statusName }}
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
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@iconify/vue';
import { AuthStatus } from '@/stores/users';

const props = defineProps<{
  config: { selectedStatuses: number[] };
}>();

const emit = defineEmits<{
  update: [config: { selectedStatuses: number[] }];
  remove: [];
}>();

const isOpen = ref(false);
const filterContainer = ref<HTMLElement>();

const selectedStatuses = ref([...props.config.selectedStatuses]);

const filterLabel = computed(() => {
  if (selectedStatuses.value.length === 0) return 'Status: None';
  if (selectedStatuses.value.length === 1) {
    const statusName = Object.entries(AuthStatus).find(([, value]) => value === selectedStatuses.value[0])?.[0];
    return `Status: ${statusName}`;
  }
  return `Status: ${selectedStatuses.value.length} selected`;
});

watch(selectedStatuses, (newStatuses) => {
  emit('update', { selectedStatuses: newStatuses });
}, { deep: true });

function togglePopover() {
  isOpen.value = !isOpen.value;
}

function toggleStatus(statusValue: number) {
  const index = selectedStatuses.value.indexOf(statusValue);
  if (index > -1) {
    selectedStatuses.value.splice(index, 1);
  } else {
    selectedStatuses.value.push(statusValue);
  }
}

function removeFilter() {
  emit('remove');
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