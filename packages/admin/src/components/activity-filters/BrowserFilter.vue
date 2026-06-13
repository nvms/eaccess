<template>
  <div class="relative" ref="filterContainer">
    <div class="inline-flex h-8 items-stretch overflow-hidden rounded-md border bg-card shadow-xs">
      <button type="button" class="flex cursor-pointer items-center gap-1.5 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" @click="togglePopover">
        <Icon icon="mdi:web" class="size-3.5" />
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
          <div class="text-sm font-medium mb-3">Select Browsers</div>
          <div class="space-y-2">
            <div
              v-for="browser in availableBrowsers"
              :key="browser"
              class="flex items-center space-x-2"
            >
              <Checkbox
                :id="`browser-filter-${browser}`"
                :model-value="selectedBrowsers.includes(browser)"
                @update:model-value="toggleBrowser(browser)"
              />
              <label
                :for="`browser-filter-${browser}`"
                class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center space-x-2"
              >
                <Icon :icon="getBrowserIcon(browser)" class="h-4 w-4" />
                <span>{{ browser }}</span>
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
  config: { selectedBrowsers: string[] };
}>();

const emit = defineEmits<{
  update: [config: { selectedBrowsers: string[] }];
  remove: [];
}>();

const isOpen = ref(false);
const filterContainer = ref<HTMLElement>();

const selectedBrowsers = ref([...props.config.selectedBrowsers]);

const availableBrowsers = [
  'Chrome',
  'Firefox', 
  'Safari',
  'Edge',
  'Opera'
];

const filterLabel = computed(() => {
  if (selectedBrowsers.value.length === 0) return 'Browser: None';
  if (selectedBrowsers.value.length === 1) {
    return `Browser: ${selectedBrowsers.value[0]}`;
  }
  return `Browser: ${selectedBrowsers.value.length} selected`;
});

watch(selectedBrowsers, (newBrowsers) => {
  emit('update', { selectedBrowsers: newBrowsers });
}, { deep: true });

function togglePopover() {
  isOpen.value = !isOpen.value;
}

function toggleBrowser(browser: string) {
  const index = selectedBrowsers.value.indexOf(browser);
  if (index > -1) {
    selectedBrowsers.value.splice(index, 1);
  } else {
    selectedBrowsers.value.push(browser);
  }
}

function removeFilter() {
  emit('remove');
}

function getBrowserIcon(browser: string): string {
  const browserLower = browser.toLowerCase();
  if (browserLower.includes('chrome')) return 'ri:chrome-fill';
  if (browserLower.includes('firefox')) return 'ri:firefox-browser-fill';
  if (browserLower.includes('safari')) return 'ri:safari-fill';
  if (browserLower.includes('edge')) return 'mdi:microsoft-edge';
  if (browserLower.includes('opera')) return 'mdi:opera';
  return 'mdi:web';
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