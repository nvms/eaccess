<template>
  <div class="min-h-screen">
    <AppNavbar />

    <main class="container mx-auto px-6 py-8">
      <header class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold tracking-tight">Users</h1>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ usersStore.totalUsers.toLocaleString() }} {{ usersStore.totalUsers === 1 ? "account" : "accounts" }}
          </p>
        </div>
        <CreateUserButton />
      </header>

      <div class="mb-4">
        <FilterBar />
      </div>

      <div class="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead class="h-10 px-4 text-xs">User</TableHead>
              <TableHead class="h-10 px-4 text-xs">Roles</TableHead>
              <TableHead class="h-10 px-4 text-xs">Status</TableHead>
              <TableHead class="h-10 px-4 text-xs">MFA</TableHead>
              <TableHead class="h-10 px-4 text-xs">Tokens</TableHead>
              <TableHead class="h-10 px-4 text-xs">Last sign-in</TableHead>
              <TableHead class="h-10 px-4 text-xs">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="usersStore.isLoading" class="hover:bg-transparent">
              <TableCell colspan="7" class="py-12 text-center text-sm text-muted-foreground">Loading users...</TableCell>
            </TableRow>

            <TableRow v-else-if="usersStore.users.length === 0" class="hover:bg-transparent">
              <TableCell colspan="7" class="py-12 text-center text-sm text-muted-foreground">No users found</TableCell>
            </TableRow>

            <TableRow v-for="user in usersStore.users" v-else :key="user.id" class="cursor-pointer" @click="openUser(user.id)">
              <TableCell class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div class="flex size-7 shrink-0 select-none items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {{ user.email.charAt(0).toUpperCase() }}
                  </div>
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="truncate text-sm font-medium">{{ user.email }}</span>
                    <ProviderIcon v-for="provider in user.providers" :key="provider.provider" :provider="provider.provider" icon-class="size-3.5 text-muted-foreground" />
                  </div>
                </div>
              </TableCell>
              <TableCell class="px-4 py-3">
                <div class="flex flex-wrap gap-1">
                  <span v-for="role in visibleRoles(user.rolemask)" :key="role" class="rounded border bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground">
                    {{ role }}
                  </span>
                  <span v-if="overflowRoleCount(user.rolemask) > 0" class="px-1 py-0.5 text-xs text-muted-foreground">+{{ overflowRoleCount(user.rolemask) }}</span>
                  <span v-if="usersStore.getRoleNames(user.rolemask).length === 0" class="text-sm text-muted-foreground/60">—</span>
                </div>
              </TableCell>
              <TableCell class="px-4 py-3">
                <span class="flex items-center gap-2 text-sm">
                  <span class="size-1.5 rounded-full" :class="getStatusDotClass(user.status)" />
                  {{ getStatusName(user.status) }}
                </span>
              </TableCell>
              <TableCell class="px-4 py-3">
                <TooltipProvider v-if="user.mfa_methods && user.mfa_methods.length > 0">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <span class="text-sm">Enabled</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p v-for="method in user.mfa_methods" :key="method.id">
                        {{ getMfaMechanismName(method.mechanism) }}<span v-if="!method.verified"> (unverified)</span>
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span v-else class="text-sm text-muted-foreground/60">—</span>
              </TableCell>
              <TableCell class="px-4 py-3">
                <div v-if="tokenSummaries(user).length > 0" class="flex items-center gap-2">
                  <TooltipProvider v-for="token in tokenSummaries(user)" :key="token.label">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Icon :icon="token.icon" class="size-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{{ token.label }} expires {{ formatDate(token.expires) }}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span v-else class="text-sm text-muted-foreground/60">—</span>
              </TableCell>
              <TableCell class="px-4 py-3 text-sm text-muted-foreground">
                {{ formatDate(user.last_login) }}
              </TableCell>
              <TableCell class="px-4 py-3 text-sm text-muted-foreground">
                {{ formatDate(user.registered) }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div class="flex items-center justify-between border-t px-4 py-2.5">
          <div class="flex items-center gap-4">
            <Select v-model="rowsPerPage">
              <SelectTrigger size="sm" class="text-sm text-muted-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="20">20 per page</SelectItem>
                <SelectItem :value="50">50 per page</SelectItem>
                <SelectItem :value="100">100 per page</SelectItem>
              </SelectContent>
            </Select>
            <span class="whitespace-nowrap text-sm text-muted-foreground"> {{ displayRange.start }}–{{ displayRange.end }} of {{ usersStore.totalUsers.toLocaleString() }} </span>
          </div>

          <Pagination v-if="usersStore.totalPages > 1" v-slot="{ page }" :key="paginationKey" :items-per-page="rowsPerPage" :total="usersStore.totalUsers" :default-page="currentPage" @update:page="goToPage">
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
    </main>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import AppNavbar from "../AppNavbar.vue";
import CreateUserButton from "../CreateUserButton.vue";
import ProviderIcon from "../ProviderIcon.vue";
import FilterBar from "../FilterBar.vue";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Icon } from "@iconify/vue";
import { useUsersStore, type User } from "@/stores/users";
import { useFiltersStore } from "@/stores/filters";
import { formatDate, getMfaMechanismName, getStatusDotClass, getStatusName } from "@/lib/display";

const MAX_VISIBLE_ROLES = 3;

const router = useRouter();
const usersStore = useUsersStore();
const filtersStore = useFiltersStore();
const rowsPerPage = ref(50);
const currentPage = ref(1);

// reka's Pagination only reads default-page on mount, so force a remount
// whenever filters or page size reset the page
const paginationKey = computed(() => `${rowsPerPage.value}-${JSON.stringify(filtersStore.activeFilters)}`);

const displayRange = computed(() => {
  if (usersStore.totalUsers === 0) return { start: 0, end: 0 };
  const start = (currentPage.value - 1) * rowsPerPage.value + 1;
  const end = Math.min(start + usersStore.users.length - 1, usersStore.totalUsers);
  return { start, end };
});

onMounted(loadUsers);

watch(
  () => filtersStore.activeFilters,
  () => {
    currentPage.value = 1;
    loadUsers();
  },
  { deep: true },
);

watch(rowsPerPage, () => {
  currentPage.value = 1;
  loadUsers();
});

async function loadUsers() {
  const filters = filtersStore.convertToStoreFormat();
  await usersStore.loadUsers({ ...filters, page: currentPage.value, limit: rowsPerPage.value });
}

function goToPage(page: number) {
  currentPage.value = page;
  loadUsers();
}

function openUser(id: number) {
  router.push(`/users/edit/${id}`);
}

function visibleRoles(rolemask: number): string[] {
  return usersStore.getRoleNames(rolemask).slice(0, MAX_VISIBLE_ROLES);
}

function overflowRoleCount(rolemask: number): number {
  return Math.max(0, usersStore.getRoleNames(rolemask).length - MAX_VISIBLE_ROLES);
}

function tokenSummaries(user: User) {
  const summaries: Array<{ label: string; icon: string; expires: string }> = [];
  if (user.confirmation_tokens?.length) {
    summaries.push({ label: "Email confirmation token", icon: "mdi:email-check-outline", expires: user.confirmation_tokens[0].expires });
  }
  if (user.reset_tokens?.length) {
    summaries.push({ label: "Password reset token", icon: "mdi:lock-reset", expires: user.reset_tokens[0].expires });
  }
  if (user.remember_tokens?.length) {
    summaries.push({ label: "Remember token", icon: "mdi:account-clock", expires: user.remember_tokens[0].expires });
  }
  return summaries;
}
</script>
