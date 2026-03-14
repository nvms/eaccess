<template>
  <div class="min-h-screen flex flex-col">
    <AppNavbar />

    <!-- Main Content Container -->
    <div class="container mx-auto">
      <div class="space-y-4 mb-8">
        <div class="p-2 space-y-2 border rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
          <div class="container mx-auto">
            <div class="flex justify-between items-center">
              <ActivityFilterBar />
            </div>
          </div>
          <div class="border rounded bg-background shadow-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-12 border-r text-muted-foreground/50">Event</TableHead>
                  <TableHead class="w-19 border-r text-muted-foreground/50">Metadata</TableHead>
                  <TableHead class="border-r text-muted-foreground/50">Email</TableHead>
                  <TableHead class="border-r text-muted-foreground/50">Browser</TableHead>
                  <TableHead class="border-r text-muted-foreground/50">OS</TableHead>
                  <TableHead class="border-r text-muted-foreground/50">IP Address</TableHead>
                  <TableHead class="text-muted-foreground/50">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="activityStore.isLoading">
                  <TableCell colspan="7" class="text-center py-8">
                    <div class="text-muted-foreground">Loading activity...</div>
                  </TableCell>
                </TableRow>

                <TableRow v-else-if="activityStore.activities.length === 0">
                  <TableCell colspan="7" class="text-center py-8">
                    <div class="text-muted-foreground">No activity found</div>
                  </TableCell>
                </TableRow>

                <TableRow v-for="activity in paginatedActivities" :key="activity.id" v-else>
                  <!-- Event -->
                  <TableCell class="border-r flex items-center justify-around">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <div class="w-6 h-6 rounded-full flex items-center justify-center" :class="getActionIconClass(activity.action, activity.success)">
                            <Icon :icon="getActionIcon(activity.action)" class="w-4 h-4" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{{ getActionDisplayName(activity.action) }}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>

                  <!-- Metadata -->
                  <TableCell class="border-r">
                    <div v-if="activity.metadata" class="flex items-center justify-around">
                      <Popover>
                        <PopoverTrigger as-child>
                          <Button variant="ghost" size="sm" class="h-6 w-6 p-0">
                            <Icon icon="mdi:magnify" class="w-3 h-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent class="w-96">
                          <div class="space-y-2">
                            <h4 class="font-medium leading-none">Metadata</h4>
                            <pre class="text-xs bg-muted p-3 rounded overflow-auto max-h-64">{{ JSON.stringify(activity.metadata, null, 2) }}</pre>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <span v-else class="text-muted-foreground text-xs">-</span>
                  </TableCell>

                  <!-- Email -->
                  <TableCell class="font-medium border-r">
                    <div class="flex items-center gap-3">
                      <div class="w-6 h-6 dark:bg-neutral-700 bg-neutral-200 rounded-full flex items-center justify-center flex-shrink-0">
                        <span class="text-xs font-medium dark:text-neutral-300">
                          {{ (activity.account_email || activity.metadata?.email || "U").charAt(0).toUpperCase() }}
                        </span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <router-link
                          v-if="activity.account_id && activity.account_email"
                          :to="`/users/edit/${activity.account_id}`"
                          class="dark:text-neutral-400 text-neutral-500 underline font-medium hover:underline cursor-pointer hover:dark:text-neutral-100 hover:text-neutral-800"
                        >
                          {{ activity.account_email }}
                        </router-link>
                        <span v-else class="text-muted-foreground">
                          {{ activity.metadata?.email || "Unknown" }}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  <!-- Browser -->
                  <TableCell class="border-r">
                    <div class="flex items-center gap-2">
                      <div class="w-6 h-6 dark:bg-neutral-700 bg-neutral-200 rounded-full flex items-center justify-center flex-shrink-0">
                        <Icon :icon="getBrowserIcon(activity.browser)" class="w-4 h-4" />
                      </div>
                      <span class="text-sm">{{ activity.browser || "Unknown" }}</span>
                    </div>
                  </TableCell>

                  <!-- OS -->
                  <TableCell class="border-r">
                    <div class="flex items-center gap-2">
                      <div class="w-6 h-6 dark:bg-neutral-700 bg-neutral-200 rounded-full flex items-center justify-center flex-shrink-0">
                        <Icon :icon="getOSIcon(activity.os)" class="w-4 h-4" />
                      </div>
                      <span class="text-sm">{{ activity.os || "Unknown" }}</span>
                    </div>
                  </TableCell>

                  <!-- IP Address -->
                  <TableCell class="font-mono text-sm border-r">
                    {{ activity.ip_address || "-" }}
                  </TableCell>

                  <!-- Time -->
                  <TableCell class="text-sm text-muted-foreground">
                    {{ formatTimeAgo(activity.created_at) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <!-- <div v-if="activityStore.activities.length === 0 && !activityStore.isLoading" class="text-center py-8 text-muted-foreground">No activity found</div> -->

          <!-- <div v-if="activityStore.isLoading" class="text-center py-8 text-muted-foreground">Loading activity...</div> -->
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
                <SelectItem :value="200">200 rows per page</SelectItem>
                <SelectItem value="all">All rows</SelectItem>
              </SelectContent>
            </Select>
            <span> {{ displayRange.start }}-{{ displayRange.end }} of {{ totalActivities }} rows </span>
          </div>

          <div v-if="rowsPerPage !== 'all' && totalPages > 1" class="flex justify-center">
            <Pagination v-slot="{ page }" :items-per-page="rowsPerPage" :total="totalActivities" :default-page="currentPage" @update:page="currentPage = $event">
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

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from "vue";
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

const activityStore = useActivityStore();
const activityFiltersStore = useActivityFiltersStore();

const rowsPerPage = ref<number | "all">(20);
const currentPage = ref(1);

// Reactive current time that updates every minute
const currentTime = ref(new Date());
let timeUpdateInterval: NodeJS.Timeout | null = null;

onMounted(async () => {
  await loadActivityWithFilters();

  // Update current time every minute to keep relative times fresh
  timeUpdateInterval = setInterval(() => {
    currentTime.value = new Date();
  }, 60_000);
});

onUnmounted(() => {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }
});

// Watch for filter changes and reload activity
watch(
  () => activityFiltersStore.activeFilters,
  () => {
    loadActivityWithFilters();
  },
  { deep: true },
);

watch(rowsPerPage, () => {
  loadActivityWithFilters();
  currentPage.value = 1; // Reset to first page when rows per page changes
});

function convertFiltersToStoreFormat() {
  const storeFilters = activityFiltersStore.convertToStoreFormat();
  return {
    ...storeFilters,
    timeFilter: storeFilters.timeFilter as "all" | "1h" | "24h" | "7d" | "30d" | undefined,
    limit: 1000, // Load all available data for client-side pagination
  };
}

async function loadActivityWithFilters() {
  const filters = convertFiltersToStoreFormat();
  await activityStore.loadActivity(filters);
  currentPage.value = 1; // Reset to first page when filters change
}

// Computed properties for pagination
const totalActivities = computed(() => activityStore.activities.length);

const totalPages = computed(() => {
  if (rowsPerPage.value === "all") return 1;
  return Math.ceil(totalActivities.value / rowsPerPage.value);
});

const paginatedActivities = computed(() => {
  if (rowsPerPage.value === "all") return activityStore.activities;

  const start = (currentPage.value - 1) * rowsPerPage.value;
  const end = start + rowsPerPage.value;
  return activityStore.activities.slice(start, end);
});

const displayRange = computed(() => {
  if (totalActivities.value === 0) return { start: 0, end: 0 };

  if (rowsPerPage.value === "all") {
    return { start: 1, end: totalActivities.value };
  }

  const start = (currentPage.value - 1) * rowsPerPage.value + 1;
  const end = Math.min(start + rowsPerPage.value - 1, totalActivities.value);
  return { start, end };
});

// Watch for changes in rowsPerPage to reset current page
function handleRowsPerPageChange() {
  currentPage.value = 1;
}

function getActionIcon(action: string): string {
  switch (action) {
    case "login":
      return "mdi:login";
    case "logout":
      return "mdi:logout";
    case "failed_login":
      return "mdi:lock-alert";
    case "register":
      return "mdi:account-plus";
    case "email_confirmed":
      return "mdi:email-check";
    case "password_reset_requested":
      return "mdi:lock-reset";
    case "password_reset_completed":
      return "mdi:lock-check";
    case "password_changed":
      return "mdi:lock-reset";
    case "email_changed":
      return "mdi:email-edit";
    case "role_changed":
      return "mdi:account-cog";
    case "status_changed":
      return "mdi:account-edit";
    case "force_logout":
      return "mdi:account-remove";
    case "oauth_connected":
      return "mdi:link";
    case "remember_token_created":
      return "mdi:account-clock";
    case "two_factor_setup":
      return "mdi:shield-check";
    case "two_factor_verified":
      return "mdi:shield-check";
    case "two_factor_failed":
      return "mdi:shield-alert";
    case "two_factor_disabled":
      return "mdi:shield-remove";
    case "backup_code_used":
      return "mdi:key-variant";
    default:
      return "mdi:information";
  }
}

function getActionIconClass(action: string, success: boolean): string {
  if (!success) {
    return "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400";
  }

  switch (action) {
    case "login":
      return "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400";
    case "logout":
      return "bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-400";
    case "failed_login":
      return "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400";
    case "register":
      return "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400";
    case "email_confirmed":
      return "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400";
    case "password_reset_requested":
    case "password_reset_completed":
    case "password_changed":
      return "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400";
    case "email_changed":
      return "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400";
    case "role_changed":
    case "status_changed":
      return "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400";
    case "force_logout":
      return "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400";
    case "oauth_connected":
      return "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400";
    case "remember_token_created":
      return "bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400";
    case "two_factor_setup":
      return "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400";
    case "two_factor_verified":
      return "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400";
    case "two_factor_failed":
      return "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400";
    case "two_factor_disabled":
      return "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400";
    case "backup_code_used":
      return "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400";
    default:
      return "bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-400";
  }
}

function getActionDisplayName(action: string): string {
  switch (action) {
    case "login":
      return "Login";
    case "logout":
      return "Logout";
    case "failed_login":
      return "Failed Login";
    case "register":
      return "Registration";
    case "email_confirmed":
      return "Email Confirmed";
    case "password_reset_requested":
      return "Password Reset Requested";
    case "password_reset_completed":
      return "Password Reset Completed";
    case "password_changed":
      return "Password Changed";
    case "email_changed":
      return "Email Changed";
    case "role_changed":
      return "Role Changed";
    case "status_changed":
      return "Status Changed";
    case "force_logout":
      return "Force Logout";
    case "oauth_connected":
      return "OAuth Connected";
    case "remember_token_created":
      return "Remember Me Token Created";
    case "two_factor_setup":
      return "Two-Factor Setup";
    case "two_factor_verified":
      return "Two-Factor Verified";
    case "two_factor_failed":
      return "Two-Factor Failed";
    case "two_factor_disabled":
      return "Two-Factor Disabled";
    case "backup_code_used":
      return "Backup Code Used";
    default:
      return action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }
}

function getBrowserIcon(browser: string | null): string {
  if (!browser) return "mdi:web";

  const browserLower = browser.toLowerCase();
  if (browserLower.includes("chrome")) return "ri:chrome-fill";
  if (browserLower.includes("firefox")) return "ri:firefox-browser-fill";
  if (browserLower.includes("safari")) return "ri:safari-fill";
  if (browserLower.includes("edge")) return "mdi:microsoft-edge";
  if (browserLower.includes("opera")) return "mdi:opera";
  return "mdi:web";
}

function getOSIcon(os: string | null): string {
  if (!os) return "mdi:laptop";

  const osLower = os.toLowerCase();
  if (osLower.includes("mac") || osLower.includes("ios")) return "ri:apple-fill";
  if (osLower.includes("windows")) return "ri:windows-fill";
  if (osLower.includes("linux")) return "mdi:linux";
  if (osLower.includes("android")) return "mdi:android";
  return "mdi:laptop";
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = currentTime.value; // Use reactive current time
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
</script>
