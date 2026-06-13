<template>
  <div class="relative" ref="filterContainer">
    <div class="inline-flex h-8 items-stretch overflow-hidden rounded-md border bg-card shadow-xs">
      <button type="button" class="flex cursor-pointer items-center gap-1.5 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" @click="togglePopover">
        <Icon icon="iconamoon:shield-yes-fill" class="size-3.5" />
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
          <div class="text-sm font-medium mb-3">MFA Status</div>
          <div class="space-y-2">
            <div class="flex items-center space-x-2">
              <input
                id="mfa-enabled"
                type="radio"
                :value="true"
                v-model="enabled"
                class="w-4 h-4"
              />
              <label for="mfa-enabled" class="text-sm cursor-pointer">
                Enabled
              </label>
            </div>
            <div class="flex items-center space-x-2">
              <input
                id="mfa-disabled"
                type="radio"
                :value="false"
                v-model="enabled"
                class="w-4 h-4"
              />
              <label for="mfa-disabled" class="text-sm cursor-pointer">
                Disabled
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

const props = defineProps<{
  config: { enabled: boolean };
}>();

const emit = defineEmits<{
  update: [config: { enabled: boolean }];
  remove: [];
}>();

const isOpen = ref(false);
const filterContainer = ref<HTMLElement>();

const enabled = ref(props.config.enabled);

const filterLabel = computed(() => {
  return `MFA: ${enabled.value ? 'Enabled' : 'Disabled'}`;
});

watch(enabled, (newEnabled) => {
  emit('update', { enabled: newEnabled });
});

function togglePopover() {
  isOpen.value = !isOpen.value;
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