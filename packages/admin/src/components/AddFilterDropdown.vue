<template>
  <div class="relative" ref="dropdownContainer">
    <Button variant="outline" class="rounded-full text-neutral-500" size="sm" @click="toggleDropdown">
      <Icon icon="mdi:plus" class="w-4 h-4" />
      Add filter
    </Button>

    <Transition enter-active-class="animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200" leave-active-class="animate-out fade-out-0 zoom-out-95 slide-out-to-top-2 duration-150">
      <div v-if="isOpen" class="absolute top-full left-0 mt-2 w-48 bg-popover border border-border rounded-md shadow-md z-50 origin-top-left">
        <div class="py-1">
          <button v-for="filter in availableFilters" :key="filter.type" @click="selectFilter(filter.type)" class="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
            {{ filter.label }}
          </button>
        </div>

        <div v-if="availableFilters.length === 0" class="px-3 pb-2 text-sm text-neutral-500 italic">No more filters available</div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/vue";

defineProps<{
  availableFilters: Array<{ type: string; label: string }>;
}>();

const emit = defineEmits<{
  select: [type: string];
}>();

const isOpen = ref(false);
const dropdownContainer = ref<HTMLElement>();

function toggleDropdown() {
  isOpen.value = !isOpen.value;
}

function selectFilter(type: string) {
  emit("select", type);
  isOpen.value = false;
}

function handleClickOutside(event: MouseEvent) {
  if (dropdownContainer.value && !dropdownContainer.value.contains(event.target as Node)) {
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
