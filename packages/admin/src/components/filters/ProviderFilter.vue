<template>
  <div class="relative" ref="filterContainer">
    <div class="inline-flex h-8 items-stretch overflow-hidden rounded-md border bg-card shadow-xs">
      <button type="button" class="flex cursor-pointer items-center gap-1.5 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" @click="togglePopover">
        <Icon icon="mdi:account-key" class="size-3.5" />
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
          <div class="text-sm font-medium mb-3">Select Providers</div>
          <div class="space-y-2">
            <div
              v-for="provider in availableProviders"
              :key="provider.value"
              class="flex items-center space-x-2"
            >
              <Checkbox
                :id="`provider-filter-${provider.value}`"
                :model-value="selectedProviders.includes(provider.value)"
                @update:model-value="toggleProvider(provider.value)"
              />
              <label
                :for="`provider-filter-${provider.value}`"
                class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center space-x-2"
              >
                <ProviderIcon v-if="provider.value !== 'email_password'" :provider="provider.value" iconClass="h-4 w-4" />
                <Icon v-else icon="mdi:email" class="h-4 w-4" />
                <span>{{ provider.label }}</span>
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
import ProviderIcon from '../ProviderIcon.vue';

const props = defineProps<{
  config: { selectedProviders: string[] };
}>();

const emit = defineEmits<{
  update: [config: { selectedProviders: string[] }];
  remove: [];
}>();

const isOpen = ref(false);
const filterContainer = ref<HTMLElement>();

const selectedProviders = ref([...props.config.selectedProviders]);

const availableProviders = [
  { value: 'email_password', label: 'Email/Password' },
  { value: 'github', label: 'GitHub' },
  { value: 'google', label: 'Google' },
  { value: 'azure', label: 'Azure' },
];

const filterLabel = computed(() => {
  if (selectedProviders.value.length === 0) return 'Provider: None';
  if (selectedProviders.value.length === 1) {
    const provider = availableProviders.find(p => p.value === selectedProviders.value[0]);
    return `Provider: ${provider?.label}`;
  }
  return `Provider: ${selectedProviders.value.length} selected`;
});

watch(selectedProviders, (newProviders) => {
  emit('update', { selectedProviders: newProviders });
}, { deep: true });

function togglePopover() {
  isOpen.value = !isOpen.value;
}

function toggleProvider(providerValue: string) {
  const index = selectedProviders.value.indexOf(providerValue);
  if (index > -1) {
    selectedProviders.value.splice(index, 1);
  } else {
    selectedProviders.value.push(providerValue);
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