<template>
  <div ref="searchContainer" class="relative">
    <div class="relative">
      <Input ref="searchInput" v-model="searchQuery" placeholder="Search users..." class="h-8 w-56 pl-8 text-sm" @focus="handleFocus" @blur="handleBlur" />
      <Icon icon="mdi:magnify" class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <kbd class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
    </div>

    <Transition enter-active-class="animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200" leave-active-class="animate-out fade-out-0 zoom-out-95 slide-out-to-top-2 duration-150">
      <div v-if="isPopoverOpen" class="absolute right-0 top-full z-50 mt-2 w-[420px] origin-top rounded-lg border bg-popover shadow-md">
        <div class="border-b px-4 py-2">
          <div class="text-xs text-muted-foreground">{{ searchResults.length }} result{{ searchResults.length !== 1 ? "s" : "" }}{{ searchQuery ? ` for "${searchQuery}"` : "" }}</div>
        </div>

        <div v-if="isSearching" class="px-4 py-8 text-center text-sm text-muted-foreground">Searching...</div>

        <div v-else-if="searchResults.length === 0 && searchQuery.trim()" class="px-4 py-8 text-center text-sm text-muted-foreground">No users found matching "{{ searchQuery }}"</div>

        <div v-else class="max-h-96 overflow-y-auto py-1">
          <button v-for="user in searchResults" :key="user.id" type="button" class="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent" @click="navigateToUser(user.id)">
            <div class="flex size-7 shrink-0 select-none items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {{ user.email.charAt(0).toUpperCase() }}
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-medium">{{ user.email }}</span>
                <ProviderIcon v-for="provider in user.providers" :key="provider.provider" :provider="provider.provider" icon-class="size-3.5 text-muted-foreground" />
              </div>
              <div class="mt-0.5 truncate text-xs text-muted-foreground">
                {{ getRoleNames(user.rolemask).join(", ") || "No roles" }}<span v-if="user.mfa_methods && user.mfa_methods.length > 0"> · MFA</span>
              </div>
            </div>

            <span class="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span class="size-1.5 rounded-full" :class="getStatusDotClass(user.status)" />
              {{ getStatusName(user.status) }}
            </span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useMagicKeys } from "@vueuse/core";
import { Input } from "@/components/ui/input";
import { Icon } from "@iconify/vue";
import ProviderIcon from "./ProviderIcon.vue";
import { useUsersStore, type User } from "@/stores/users";
import { getStatusDotClass, getStatusName } from "@/lib/display";

const router = useRouter();
const usersStore = useUsersStore();

const searchQuery = ref("");
const searchResults = ref<User[]>([]);
const isPopoverOpen = ref(false);
const isSearching = ref(false);
const isFocused = ref(false);
const searchContainer = ref<HTMLElement>();
const searchInput = ref<InstanceType<typeof Input>>();

const keys = useMagicKeys();
const cmdK = keys["Meta+k"];
const ctrlK = keys["Ctrl+k"];

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

watch([cmdK, ctrlK], ([cmd, ctrl]) => {
  if (cmd || ctrl) {
    searchInput.value?.$el.focus();
  }
});

watch(searchQuery, (newQuery) => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  if (newQuery.trim() === "") {
    searchResults.value = [];
    isPopoverOpen.value = false;
    return;
  }

  if (isFocused.value) {
    isPopoverOpen.value = true;
    searchTimeout = setTimeout(async () => {
      await performSearch(newQuery.trim());
    }, 300);
  }
});

async function performSearch(query: string) {
  if (!query) return;

  isSearching.value = true;

  try {
    searchResults.value = await usersStore.searchUsers(query);
  } catch (error) {
    console.error("Search error:", error);
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
}

function handleFocus() {
  isFocused.value = true;
}

function handleBlur() {
  // delay so result clicks land before the popover closes
  setTimeout(() => {
    isFocused.value = false;
    if (!searchQuery.value.trim()) {
      isPopoverOpen.value = false;
    }
  }, 200);
}

function handleClickOutside(event: MouseEvent) {
  if (searchContainer.value && !searchContainer.value.contains(event.target as Node)) {
    isPopoverOpen.value = false;
    searchQuery.value = "";
    searchResults.value = [];
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});

function navigateToUser(userId: number) {
  router.push(`/users/edit/${userId}`);
  isPopoverOpen.value = false;
  searchQuery.value = "";
  searchResults.value = [];
}

function getRoleNames(rolemask: number): string[] {
  return usersStore.getRoleNames(rolemask);
}
</script>
