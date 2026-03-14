<template>
  <div class="min-h-screen flex flex-col">
    <AppNavbar />
    <!-- Create User Button -->

    <!-- Main Content Container -->
    <div class="container mx-auto">
      <div class="space-y-4 mb-8">
        <div class="p-2 space-y-2 border rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
          <div class="">
            <div class="flex justify-between items-center">
              <FilterBar />
              <CreateUserButton />
            </div>
          </div>
          <div class="border rounded bg-background shadow-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="border-r text-muted-foreground/50">Email</TableHead>
                  <TableHead class="border-r text-muted-foreground/50">Provider</TableHead>
                  <TableHead class="border-r text-muted-foreground/50">Last Login</TableHead>
                  <TableHead class="w-120 border-r text-muted-foreground/50">Roles</TableHead>
                  <TableHead class="border-r text-muted-foreground/50">Status</TableHead>
                  <TableHead class="border-r text-muted-foreground/50">Tokens</TableHead>
                  <TableHead class="border-r text-muted-foreground/50">MFA</TableHead>
                  <TableHead class="text-muted-foreground/50">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="user in paginatedUsers" :key="user.id">
                  <TableCell class="font-medium border-r">
                    <div class="flex items-center gap-3">
                      <div class="w-6 h-6 dark:bg-neutral-700 bg-neutral-200 rounded-full flex items-center justify-center flex-shrink-0">
                        <span class="text-xs font-medium dark:text-neutral-300 select-none">
                          {{ user.email.charAt(0).toUpperCase() }}
                        </span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <router-link :to="`/users/edit/${user.id}`" class="dark:text-neutral-400 text-neutral-500 underline underline-offset-[2px] font-medium hover:underline cursor-pointer hover:dark:text-neutral-100 hover:text-neutral-800">
                          {{ user.email }}
                        </router-link>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell class="border-r">
                    <div v-if="user.providers && user.providers.length > 0" class="flex gap-2">
                      <div v-for="provider in user.providers" :key="provider.provider" class="w-6 h-6 dark:bg-neutral-700 rounded-full flex items-center justify-center flex-shrink-0">
                        <ProviderIcon :provider="provider.provider" iconClass="h-4 w-4" />
                      </div>
                    </div>
                    <div v-else class="flex items-center gap-2">
                      <div class="w-6 h-6 dark:bg-neutral-700 rounded-full flex items-center justify-center flex-shrink-0">
                        <ProviderIcon provider="" iconClass="h-4 w-4" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell class="border-r">
                    {{ formatDate(user.last_login) }}
                  </TableCell>
                  <TableCell class="border-r">
                    <div class="flex flex-wrap gap-1">
                      <span v-for="role in usersStore.getRoleNames(user.rolemask)" :key="role" class="inline-flex items-center px-2 py-1 text-xs rounded-md dark:bg-neutral-700/30 dark:text-neutral-500 bg-neutral-200/70 text-neutral-500">
                        {{ role }}
                      </span>
                      <span v-if="usersStore.getRoleNames(user.rolemask).length === 0" class="text-muted-foreground text-sm">&nbsp;</span>
                    </div>
                  </TableCell>
                  <TableCell class="border-r">
                    <span class="inline-flex items-center px-2 py-1 text-xs rounded-md gap-1.5" :class="getStatusClass(user.status)">
                      {{ usersStore.getStatusName(user.status) }}
                    </span>
                  </TableCell>
                  <TableCell class="border-r">
                    <div class="flex gap-1">
                      <TooltipProvider v-if="user.confirmation_tokens && user.confirmation_tokens.length > 0">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <div :class="getTokenClasses('confirmation')">
                              <Icon icon="mdi:email-check-outline" class="w-4 h-4" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Email confirmation token. Expires
                              {{ formatDate(user.confirmation_tokens[0].expires) }}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider v-if="user.reset_tokens && user.reset_tokens.length > 0">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <div :class="getTokenClasses('reset')">
                              <Icon icon="mdi:lock-reset" class="w-4 h-4" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Password reset token. Expires
                              {{ formatDate(user.reset_tokens[0].expires) }}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider v-if="user.remember_tokens && user.remember_tokens.length > 0">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <div :class="getTokenClasses('remember')">
                              <Icon icon="mdi:account-clock" class="w-4 h-4" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Remember token. Expires
                              {{ formatDate(user.remember_tokens[0].expires) }}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <span
                        v-if="(!user.confirmation_tokens || user.confirmation_tokens.length === 0) && (!user.reset_tokens || user.reset_tokens.length === 0) && (!user.remember_tokens || user.remember_tokens.length === 0)"
                        class="text-muted-foreground text-xs"
                        >&mdash;</span
                      >
                    </div>
                  </TableCell>
                  <TableCell class="border-r">
                    <div class="flex items-center">
                      <TooltipProvider v-if="user.mfa_methods && user.mfa_methods.length > 0">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <div class="w-6 h-6 rounded-full flex items-center justify-center bg-indigo-100 dark:bg-indigo-700/40 text-indigo-600 dark:text-indigo-400">
                              <Icon icon="iconamoon:shield-yes-fill" class="w-4 h-4" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div class="text-sm">
                              <p class="font-medium mb-1">Method(s) enabled:</p>
                              <ul class="space-y-1">
                                <li v-for="method in user.mfa_methods" :key="method.id">
                                  {{ getMfaMethodName(method.mechanism) }}
                                  <span v-if="!method.verified" class="text-amber-400">(unverified)</span>
                                </li>
                              </ul>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <span v-else class="text-muted-foreground text-xs">&mdash;</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {{ formatDate(user.registered) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div v-if="usersStore.users.length === 0 && !usersStore.isLoading" class="text-center py-8 text-muted-foreground">No users found</div>

          <div v-if="usersStore.isLoading" class="text-center py-8 text-muted-foreground">Loading users...</div>
        </div>

        <div class="text-sm text-neutral-500 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <Select v-model="rowsPerPage" size="sm" @update:model-value="handleRowsPerPageChange">
              <SelectTrigger class="w-[180px]">
                <SelectValue placeholder="Rows per page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="20">20 rows per page</SelectItem>
                <SelectItem :value="50">50 rows per page</SelectItem>
                <SelectItem :value="100">100 rows per page</SelectItem>
                <SelectItem :value="150">150 rows per page</SelectItem>
                <SelectItem value="all">All rows</SelectItem>
              </SelectContent>
            </Select>
            <span> {{ displayRange.start }}-{{ displayRange.end }} of {{ totalUsers }} rows </span>
          </div>

          <div v-if="rowsPerPage !== 'all' && totalPages > 1" class="flex justify-center">
            <Pagination v-slot="{ page }" :items-per-page="rowsPerPage" :total="totalUsers" :default-page="currentPage" @update:page="currentPage = $event">
              <PaginationContent v-slot="{ items }">
                <PaginationPrevious />

                <template v-for="(item, index) in items" :key="index">
                  <PaginationItem v-if="item.type === 'page'" :value="item.value" :is-active="item.value === page">
                    {{ item.value }}
                  </PaginationItem>
                </template>

                <PaginationNext />
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, computed, watch } from "vue";
import AppNavbar from "../AppNavbar.vue";
import CreateUserButton from "../CreateUserButton.vue";
import ProviderIcon from "../ProviderIcon.vue";
import FilterBar from "../FilterBar.vue";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Icon } from "@iconify/vue";
import { useUsersStore } from "@/stores/users";
import { useFiltersStore } from "@/stores/filters";

const usersStore = useUsersStore();
const filtersStore = useFiltersStore();
const rowsPerPage = ref<number | "all">(20);
const currentPage = ref(1);

// Computed properties for pagination
const totalUsers = computed(() => usersStore.users.length);

const totalPages = computed(() => {
  if (rowsPerPage.value === "all") return 1;
  return Math.ceil(totalUsers.value / rowsPerPage.value);
});

const paginatedUsers = computed(() => {
  if (rowsPerPage.value === "all") return usersStore.users;

  const start = (currentPage.value - 1) * rowsPerPage.value;
  const end = start + rowsPerPage.value;
  return usersStore.users.slice(start, end);
});

const displayRange = computed(() => {
  if (totalUsers.value === 0) return { start: 0, end: 0 };

  if (rowsPerPage.value === "all") {
    return { start: 1, end: totalUsers.value };
  }

  const start = (currentPage.value - 1) * rowsPerPage.value + 1;
  const end = Math.min(start + rowsPerPage.value - 1, totalUsers.value);
  return { start, end };
});

// Watch for changes in rowsPerPage to reset current page
function handleRowsPerPageChange() {
  currentPage.value = 1;
}

onMounted(async () => {
  await loadUsersWithFilters();
});

// Watch for filter changes and reload users
watch(
  () => filtersStore.activeFilters,
  () => {
    loadUsersWithFilters();
  },
  { deep: true },
);

async function loadUsersWithFilters() {
  const filters = filtersStore.convertToStoreFormat();
  await usersStore.loadUsers(Object.keys(filters).length > 0 ? filters : undefined);
  currentPage.value = 1; // Reset to first page when filters change
}

function getTokenClasses(tokenType: "confirmation" | "reset" | "remember") {
  const baseClasses = "w-6 h-6 rounded-full flex items-center justify-center";

  switch (tokenType) {
    case "confirmation":
      return `${baseClasses} bg-indigo-100 dark:bg-indigo-700/40 text-indigo-600 dark:text-indigo-400`;
    case "reset":
      return `${baseClasses} bg-indigo-100 dark:bg-indigo-700/40 text-indigo-600 dark:text-indigo-400`;
    case "remember":
      return `${baseClasses} bg-indigo-100 dark:bg-indigo-700/40 text-indigo-600 dark:text-indigo-400`;
    default:
      return baseClasses;
  }
}

function formatDate(dateString: string | null) {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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

function getMfaMethodName(mechanism: number): string {
  switch (mechanism) {
    case 1:
      return "TOTP";
    case 2:
      return "Email";
    case 3:
      return "SMS";
    default:
      return "Unknown";
  }
}
</script>
