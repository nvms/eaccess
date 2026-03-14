<template>
  <div class="relative" ref="filterContainer">
    <Button @click="togglePopover" class="gap-2 text-neutral-500 rounded-full cursor-pointer" variant="outline" size="sm">
      <Icon icon="iconamoon:shield-yes-fill" class="w-4 h-4" />
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
import { Button } from '../ui/button';

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