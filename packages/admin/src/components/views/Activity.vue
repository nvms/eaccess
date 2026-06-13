<template>
  <div class="min-h-screen">
    <AppNavbar />

    <main class="container mx-auto px-6 py-8">
      <header class="mb-6">
        <h1 class="text-xl font-semibold tracking-tight">Activity</h1>
        <p class="mt-1 text-sm text-muted-foreground">Authentication events across all accounts.</p>
      </header>

      <div class="mb-4">
        <ActivityFilterBar />
      </div>

      <div class="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead class="h-10 px-4 text-xs">Event</TableHead>
              <TableHead class="h-10 px-4 text-xs">User</TableHead>
              <TableHead class="h-10 px-4 text-xs">Device</TableHead>
              <TableHead class="h-10 px-4 text-xs">IP address</TableHead>
              <TableHead class="h-10 px-4 text-xs">Time</TableHead>
              <TableHead class="h-10 w-10 px-4 text-xs"><span class="sr-only">Metadata</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="activityStore.isLoading" class="hover:bg-transparent">
              <TableCell colspan="6" class="py-12 text-center text-sm text-muted-foreground">Loading activity...</TableCell>
            </TableRow>

            <TableRow v-else-if="activityStore.activities.length === 0" class="hover:bg-transparent">
              <TableCell colspan="6" class="py-12 text-center text-sm text-muted-foreground">No activity found</TableCell>
            </TableRow>

            <TableRow v-for="activity in activityStore.activities" v-else :key="activity.id">
              <TableCell class="px-4 py-3">
                <span class="flex items-center gap-2 text-sm">
                  <Icon :icon="getActionIcon(activity.action)" class="size-4 shrink-0" :class="activity.success ? 'text-muted-foreground' : 'text-destructive'" />
                  {{ getActionDisplayName(activity.action) }}
                </span>
              </TableCell>
              <TableCell class="px-4 py-3">
                <router-link v-if="activity.account_id && activity.account_email" :to="`/users/edit/${activity.account_id}`" class="text-sm font-medium hover:underline">
                  {{ activity.account_email }}
                </router-link>
                <span v-else class="text-sm text-muted-foreground">
                  {{ activity.metadata?.email || "Unknown" }}
                </span>
              </TableCell>
              <TableCell class="px-4 py-3 text-sm text-muted-foreground">
                {{ deviceLabel(activity) }}
              </TableCell>
              <TableCell class="px-4 py-3 font-mono text-sm text-muted-foreground">
                {{ activity.ip_address || "—" }}
              </TableCell>
              <TableCell class="px-4 py-3 text-sm text-muted-foreground">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <span>{{ formatTimeAgo(activity.created_at, currentTime) }}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{{ formatDate(activity.created_at) }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
              <TableCell class="px-4 py-3">
                <Popover v-if="activity.metadata">
                  <PopoverTrigger as-child>
                    <Button variant="ghost" size="icon" class="size-6 text-muted-foreground">
                      <Icon icon="mdi:code-json" class="size-3.5" />
                      <span class="sr-only">View metadata</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-96" align="end">
                    <div class="space-y-2">
                      <h4 class="text-sm font-medium">Metadata</h4>
                      <pre class="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">{{ JSON.stringify(activity.metadata, null, 2) }}</pre>
                    </div>
                  </PopoverContent>
                </Popover>
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
                <SelectItem :value="200">200 per page</SelectItem>
              </SelectContent>
            </Select>
            <span class="whitespace-nowrap text-sm text-muted-foreground"> {{ displayRange.start }}–{{ displayRange.end }} of {{ activityStore.totalEntries.toLocaleString() }} </span>
          </div>

          <Pagination v-if="activityStore.totalPages > 1" v-slot="{ page }" :key="paginationKey" :items-per-page="rowsPerPage" :total="activityStore.totalEntries" :default-page="currentPage" @update:page="goToPage">
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

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import AppNavbar from "../AppNavbar.vue";
import ActivityFilterBar from "../ActivityFilterBar.vue";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Icon } from "@iconify/vue";
import { useActivityStore } from "@/stores/activity";
import { useActivityFiltersStore } from "@/stores/activityFilters";
import { formatDate, formatTimeAgo } from "@/lib/display";

const activityStore = useActivityStore();
const activityFiltersStore = useActivityFiltersStore();

const rowsPerPage = ref(50);
const currentPage = ref(1);

const currentTime = ref(new Date());
let timeUpdateInterval: ReturnType<typeof setInterval> | null = null;

const paginationKey = computed(() => `${rowsPerPage.value}-${JSON.stringify(activityFiltersStore.activeFilters)}`);

const displayRange = computed(() => {
  if (activityStore.totalEntries === 0) return { start: 0, end: 0 };
  const start = (currentPage.value - 1) * rowsPerPage.value + 1;
  const end = Math.min(start + activityStore.activities.length - 1, activityStore.totalEntries);
  return { start, end };
});

onMounted(async () => {
  await loadActivity();

  timeUpdateInterval = setInterval(() => {
    currentTime.value = new Date();
  }, 60_000);
});

onUnmounted(() => {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }
});

watch(
  () => activityFiltersStore.activeFilters,
  () => {
    currentPage.value = 1;
    loadActivity();
  },
  { deep: true },
);

watch(rowsPerPage, () => {
  currentPage.value = 1;
  loadActivity();
});

async function loadActivity() {
  const storeFilters = activityFiltersStore.convertToStoreFormat();
  await activityStore.loadActivity({
    ...storeFilters,
    timeFilter: storeFilters.timeFilter as "all" | "1h" | "24h" | "7d" | "30d" | undefined,
    page: currentPage.value,
    limit: rowsPerPage.value,
  });
}

function goToPage(page: number) {
  currentPage.value = page;
  loadActivity();
}

function deviceLabel(activity: { browser: string | null; os: string | null }): string {
  const parts = [activity.browser, activity.os].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Unknown";
}

const actionIcons: Record<string, string> = {
  login: "mdi:login",
  logout: "mdi:logout",
  failed_login: "mdi:lock-alert",
  register: "mdi:account-plus",
  email_confirmed: "mdi:email-check",
  password_reset_requested: "mdi:lock-reset",
  password_reset_completed: "mdi:lock-check",
  password_changed: "mdi:lock-reset",
  email_changed: "mdi:email-edit",
  role_changed: "mdi:account-cog",
  status_changed: "mdi:account-edit",
  force_logout: "mdi:account-remove",
  oauth_connected: "mdi:link",
  remember_token_created: "mdi:account-clock",
  two_factor_setup: "mdi:shield-check",
  two_factor_verified: "mdi:shield-check",
  two_factor_failed: "mdi:shield-alert",
  two_factor_disabled: "mdi:shield-remove",
  backup_code_used: "mdi:key-variant",
};

function getActionIcon(action: string): string {
  return actionIcons[action] ?? "mdi:information-outline";
}

const actionNames: Record<string, string> = {
  login: "Signed in",
  logout: "Signed out",
  failed_login: "Failed sign-in",
  register: "Registered",
  email_confirmed: "Email confirmed",
  password_reset_requested: "Password reset requested",
  password_reset_completed: "Password reset completed",
  password_changed: "Password changed",
  email_changed: "Email changed",
  role_changed: "Roles changed",
  status_changed: "Status changed",
  force_logout: "Forced sign-out",
  oauth_connected: "OAuth connected",
  remember_token_created: "Remember token created",
  two_factor_setup: "Two-factor set up",
  two_factor_verified: "Two-factor verified",
  two_factor_failed: "Two-factor failed",
  two_factor_disabled: "Two-factor disabled",
  backup_code_used: "Backup code used",
};

function getActionDisplayName(action: string): string {
  return actionNames[action] ?? action.replace(/_/g, " ").replace(/^\w/, (l) => l.toUpperCase());
}
</script>
