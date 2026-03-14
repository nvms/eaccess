<template>
  <div class="relative" ref="searchContainer">
    <div class="relative">
      <Input ref="searchInput" v-model="searchQuery" placeholder="Search users..." class="w-64 pl-10 rounded-full" @focus="handleFocus" @blur="handleBlur" />
      <Icon icon="mdi:magnify" class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    </div>

    <!-- Custom positioned dropdown with animations -->
    <Transition enter-active-class="animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200" leave-active-class="animate-out fade-out-0 zoom-out-95 slide-out-to-top-2 duration-150">
      <div v-if="isPopoverOpen" class="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-[500px] bg-popover border border-border rounded-md shadow-md z-50 origin-top">
        <div class="border-b px-4 py-2">
          <div class="text-sm text-muted-foreground">{{ searchResults.length }} result{{ searchResults.length !== 1 ? "s" : "" }} found{{ searchQuery ? ` for "${searchQuery}"` : "" }}</div>
        </div>

        <div v-if="isSearching" class="flex items-center justify-center py-8">
          <div class="text-muted-foreground">Searching...</div>
        </div>

        <div v-else-if="searchResults.length === 0 && searchQuery.trim()" class="flex items-center justify-center py-8">
          <div class="text-muted-foreground">No users found matching "{{ searchQuery }}"</div>
        </div>

        <div v-else class="max-h-96 overflow-y-auto">
          <div v-for="user in searchResults" :key="user.id" class="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors border-b border-border/50 last:border-b-0" @click="navigateToUser(user.id)">
            <!-- Avatar -->
            <div class="w-8 h-8 dark:bg-neutral-700 bg-neutral-200 rounded-full flex items-center justify-center flex-shrink-0">
              <span class="text-xs font-medium dark:text-neutral-300">
                {{ user.email.charAt(0).toUpperCase() }}
              </span>
            </div>

            <!-- User Info -->
            <div class="flex-1 min-w-0 grid grid-cols-1 gap-1">
              <!-- First row: Email and providers -->
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm truncate">{{ user.email }}</span>
                <div v-if="user.providers && user.providers.length > 0" class="flex gap-1 flex-shrink-0">
                  <div v-for="provider in user.providers" :key="provider.provider" class="w-4 h-4 dark:bg-neutral-700 rounded-full flex items-center justify-center">
                    <ProviderIcon :provider="provider.provider" iconClass="h-3 w-3" />
                  </div>
                </div>
              </div>

              <!-- Second row: ID, roles, MFA -->
              <div class="flex items-center gap-3 text-xs text-muted-foreground">
                <!-- <span class="flex-shrink-0">ID: {{ user.user_id }}</span> -->
                <div class="flex flex-wrap gap-1 min-w-0">
                  <span v-for="role in getRoleNames(user.rolemask)" :key="role" class="inline-flex items-center px-1.5 py-0.5 text-xs rounded-sm dark:bg-neutral-700/30 dark:text-neutral-400 bg-neutral-200/70 text-neutral-600">
                    {{ role }}
                  </span>
                </div>
                <div v-if="user.mfa_methods && user.mfa_methods.length > 0" class="w-4 h-4 rounded-full flex items-center justify-center bg-indigo-100 dark:bg-indigo-700/30 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                  <Icon icon="iconamoon:shield-yes-fill" class="w-3 h-3" />
                </div>
              </div>
            </div>

            <!-- Status -->
            <div class="flex-shrink-0 self-start">
              <span class="inline-flex items-center px-2 py-1 text-xs rounded-md" :class="getStatusClass(user.status)">
                {{ getStatusName(user.status) }}
              </span>
            </div>
          </div>
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

let searchTimeout: NodeJS.Timeout | null = null;

// keyboard shortcuts
watch([cmdK, ctrlK], ([cmd, ctrl]) => {
  if (cmd || ctrl) {
    searchInput.value?.$el.focus();
  }
});

// Watch for search query changes with debounce
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
    }, 300); // 300ms debounce
  }
});

async function performSearch(query: string) {
  if (!query) return;

  isSearching.value = true;

  try {
    const results = await usersStore.searchUsers(query);
    searchResults.value = results;
  } catch (error) {
    console.error("Search error:", error);
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
}

function handleFocus() {
  isFocused.value = true;
  // Don't open popover on focus - only when user starts typing
}

function handleBlur() {
  // Small delay to allow clicking on search results
  setTimeout(() => {
    isFocused.value = false;
    // Close popover when focus is lost if no search query
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

function getStatusName(status: number): string {
  return usersStore.getStatusName(status);
}

function getStatusClass(status: number) {
  switch (status) {
    case 0:
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-600";
    case 1:
      return "bg-neutral-200 text-neutral-800 dark:bg-neutral-700/30 dark:text-neutral-500";
    case 2:
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500";
    case 3:
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-500";
    case 4:
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500";
    case 5:
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-500";
    default:
      return "bg-neutral-100 text-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-500";
  }
}
</script>
