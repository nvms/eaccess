<template>
  <div class="relative" ref="filterContainer">
    <Button @click="togglePopover" class="gap-2 text-neutral-500 rounded-full cursor-pointer" variant="outline" size="sm">
      <Icon icon="mdi:calendar-clock" class="w-4 h-4" />
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
        class="absolute top-full left-0 mt-2 w-80 bg-popover border border-border rounded-md shadow-md z-50 origin-top-left"
      >
        <div class="p-4">
          <div class="text-sm font-medium mb-3">Select Events</div>
          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="event in availableEvents"
              :key="event"
              class="flex items-center space-x-2"
            >
              <Checkbox
                :id="`event-filter-${event}`"
                :model-value="selectedEvents.includes(event)"
                @update:model-value="toggleEvent(event)"
              />
              <label
                :for="`event-filter-${event}`"
                class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {{ getEventDisplayName(event) }}
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
import { Button } from '../ui/button';

const props = defineProps<{
  config: { selectedEvents: string[] };
}>();

const emit = defineEmits<{
  update: [config: { selectedEvents: string[] }];
  remove: [];
}>();

const isOpen = ref(false);
const filterContainer = ref<HTMLElement>();

const selectedEvents = ref([...props.config.selectedEvents]);

const availableEvents = [
  'login',
  'logout',
  'failed_login',
  'register',
  'email_confirmed',
  'password_reset_requested',
  'password_reset_completed',
  'password_changed',
  'email_changed',
  'role_changed',
  'status_changed',
  'force_logout',
  'oauth_connected',
  'remember_token_created',
  'two_factor_setup',
  'two_factor_verified',
  'two_factor_failed',
  'two_factor_disabled',
  'backup_code_used',
];

const filterLabel = computed(() => {
  if (selectedEvents.value.length === 0) return 'Event: None';
  if (selectedEvents.value.length === 1) {
    return `Event: ${getEventDisplayName(selectedEvents.value[0])}`;
  }
  return `Event: ${selectedEvents.value.length} selected`;
});

watch(selectedEvents, (newEvents) => {
  emit('update', { selectedEvents: newEvents });
}, { deep: true });

function togglePopover() {
  isOpen.value = !isOpen.value;
}

function toggleEvent(event: string) {
  const index = selectedEvents.value.indexOf(event);
  if (index > -1) {
    selectedEvents.value.splice(index, 1);
  } else {
    selectedEvents.value.push(event);
  }
}

function removeFilter() {
  emit('remove');
}

function getEventDisplayName(event: string): string {
  switch (event) {
    case 'login': return 'Login';
    case 'logout': return 'Logout';
    case 'failed_login': return 'Failed Login';
    case 'register': return 'Registration';
    case 'email_confirmed': return 'Email Confirmed';
    case 'password_reset_requested': return 'Password Reset Requested';
    case 'password_reset_completed': return 'Password Reset Completed';
    case 'password_changed': return 'Password Changed';
    case 'email_changed': return 'Email Changed';
    case 'role_changed': return 'Role Changed';
    case 'status_changed': return 'Status Changed';
    case 'force_logout': return 'Force Logout';
    case 'oauth_connected': return 'OAuth Connected';
    case 'remember_token_created': return 'Remember Token Created';
    case 'two_factor_setup': return 'Two-Factor Setup';
    case 'two_factor_verified': return 'Two-Factor Verified';
    case 'two_factor_failed': return 'Two-Factor Failed';
    case 'two_factor_disabled': return 'Two-Factor Disabled';
    case 'backup_code_used': return 'Backup Code Used';
    default: return event.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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