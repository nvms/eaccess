<template>
  <div class="relative" ref="filterContainer">
    <div class="inline-flex h-8 items-stretch overflow-hidden rounded-md border bg-card shadow-xs">
      <button type="button" class="flex cursor-pointer items-center gap-1.5 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" @click="togglePopover">
        <Icon icon="mdi:laptop" class="size-3.5" />
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
          <div class="text-sm font-medium mb-3">Select Operating Systems</div>
          <div class="space-y-2">
            <div
              v-for="os in availableOSes"
              :key="os"
              class="flex items-center space-x-2"
            >
              <Checkbox
                :id="`os-filter-${os}`"
                :model-value="selectedOSes.includes(os)"
                @update:model-value="toggleOS(os)"
              />
              <label
                :for="`os-filter-${os}`"
                class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center space-x-2"
              >
                <Icon :icon="getOSIcon(os)" class="h-4 w-4" />
                <span>{{ os }}</span>
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

const props = defineProps<{
  config: { selectedOSes: string[] };
}>();

const emit = defineEmits<{
  update: [config: { selectedOSes: string[] }];
  remove: [];
}>();

const isOpen = ref(false);
const filterContainer = ref<HTMLElement>();

const selectedOSes = ref([...props.config.selectedOSes]);

const availableOSes = [
  'macOS',
  'Windows', 
  'Linux',
  'iOS',
  'Android'
];

const filterLabel = computed(() => {
  if (selectedOSes.value.length === 0) return 'OS: None';
  if (selectedOSes.value.length === 1) {
    return `OS: ${selectedOSes.value[0]}`;
  }
  return `OS: ${selectedOSes.value.length} selected`;
});

watch(selectedOSes, (newOSes) => {
  emit('update', { selectedOSes: newOSes });
}, { deep: true });

function togglePopover() {
  isOpen.value = !isOpen.value;
}

function toggleOS(os: string) {
  const index = selectedOSes.value.indexOf(os);
  if (index > -1) {
    selectedOSes.value.splice(index, 1);
  } else {
    selectedOSes.value.push(os);
  }
}

function removeFilter() {
  emit('remove');
}

function getOSIcon(os: string): string {
  const osLower = os.toLowerCase();
  if (osLower.includes('mac') || osLower.includes('ios')) return 'ri:apple-fill';
  if (osLower.includes('windows')) return 'ri:windows-fill';
  if (osLower.includes('linux')) return 'mdi:linux';
  if (osLower.includes('android')) return 'mdi:android';
  return 'mdi:laptop';
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