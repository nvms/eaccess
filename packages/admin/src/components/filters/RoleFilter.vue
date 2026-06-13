<template>
  <div class="relative" ref="filterContainer">
    <div class="inline-flex h-8 items-stretch overflow-hidden rounded-md border bg-card shadow-xs">
      <button type="button" class="flex cursor-pointer items-center gap-1.5 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" @click="togglePopover">
        <Icon icon="oui:app-users-roles" class="size-3.5" />
        <span>{{ filterLabel }}</span>
        <Icon icon="mdi:chevron-down" class="size-3.5 transition-transform duration-200" :class="{ 'rotate-180': isOpen }" />
      </button>
      <button type="button" class="flex cursor-pointer items-center border-l px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive" aria-label="Remove filter" @click="removeFilter">
        <Icon icon="mdi:close" class="size-3.5" />
      </button>
    </div>

    <Transition enter-active-class="animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200" leave-active-class="animate-out fade-out-0 zoom-out-95 slide-out-to-top-2 duration-150">
      <div v-if="isOpen" class="absolute top-full left-0 mt-2 w-80 bg-popover border border-border rounded-md shadow-md z-50 origin-top-left">
        <div class="p-4">
          <div class="text-sm font-medium mb-3">Select Roles</div>
          <div class="grid grid-cols-2 gap-2">
            <div v-for="[roleName, roleValue] in Object.entries(usersStore.roles)" :key="roleName" class="flex items-center space-x-2">
              <Checkbox :id="`role-filter-${roleName}`" :model-value="selectedRoles.includes(roleValue as number)" @update:model-value="toggleRole(roleValue as number)" />
              <label :for="`role-filter-${roleName}`" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                {{ roleName }}
              </label>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@iconify/vue";
import { useUsersStore } from "@/stores/users";

const usersStore = useUsersStore();

const props = defineProps<{
  config: { selectedRoles: number[] };
}>();

const emit = defineEmits<{
  update: [config: { selectedRoles: number[] }];
  remove: [];
}>();

const isOpen = ref(false);
const filterContainer = ref<HTMLElement>();

const selectedRoles = ref([...props.config.selectedRoles]);

const filterLabel = computed(() => {
  if (selectedRoles.value.length === 0) return "Role: None";
  if (selectedRoles.value.length === 1) {
    const roleName = Object.entries(usersStore.roles).find(([, value]) => value === selectedRoles.value[0])?.[0];
    return `Role: ${roleName}`;
  }
  return `Role: ${selectedRoles.value.length} selected`;
});

watch(
  selectedRoles,
  (newRoles) => {
    emit("update", { selectedRoles: newRoles });
  },
  { deep: true },
);

function togglePopover() {
  isOpen.value = !isOpen.value;
}

function toggleRole(roleValue: number) {
  const index = selectedRoles.value.indexOf(roleValue);
  if (index > -1) {
    selectedRoles.value.splice(index, 1);
  } else {
    selectedRoles.value.push(roleValue);
  }
}

function removeFilter() {
  emit("remove");
}

function handleClickOutside(event: MouseEvent) {
  if (filterContainer.value && !filterContainer.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>
