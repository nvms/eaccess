import { defineStore } from "pinia";

interface ActivityEntry {
  id: number;
  account_id: number | null;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  success: boolean;
  metadata: Record<string, any> | null;
  created_at: string;
  account_email: string | null;
}

interface ActivityStats {
  totalEntries: number;
  uniqueUsers: number;
  recentLogins: number;
  failedAttempts: number;
  actionCounts: Array<{ action: string; count: number }>;
  browserStats: Array<{ browser: string; count: number }>;
  osStats: Array<{ os: string; count: number }>;
}

interface ActivityFilters {
  limit?: number;
  page?: number;
  accountId?: number;
  timeFilter?: "all" | "1h" | "24h" | "7d" | "30d";
  events?: string[];
  browsers?: string[];
  oses?: string[];
}

export const useActivityStore = defineStore("activity", {
  state: () => ({
    activities: [] as ActivityEntry[],
    currentPage: 1,
    totalEntries: 0,
    totalPages: 0,
    pageSize: 100,
    stats: {
      totalEntries: 0,
      uniqueUsers: 0,
      recentLogins: 0,
      failedAttempts: 0,
      actionCounts: [],
      browserStats: [],
      osStats: [],
    } as ActivityStats,
    isLoading: false,
    error: null as string | null,
  }),

  actions: {
    async loadActivity(filters: ActivityFilters = {}) {
      this.isLoading = true;
      this.error = null;

      try {
        const params = new URLSearchParams();
        params.append("page", String(filters.page || this.currentPage));
        params.append("limit", String(filters.limit || this.pageSize));
        if (filters.accountId) params.append("accountId", filters.accountId.toString());
        if (filters.timeFilter) params.append("timeFilter", filters.timeFilter);
        if (filters.events && filters.events.length > 0) {
          params.append("events", filters.events.join(","));
        }
        if (filters.browsers && filters.browsers.length > 0) {
          params.append("browsers", filters.browsers.join(","));
        }
        if (filters.oses && filters.oses.length > 0) {
          params.append("oses", filters.oses.join(","));
        }

        const response = await fetch(`/admin/api/activity?${params}`);

        if (!response.ok) {
          throw new Error(`Failed to load activity: ${response.statusText}`);
        }

        const data = await response.json();
        this.activities = data.activities;
        this.totalEntries = data.total;
        this.totalPages = data.pages;
        this.currentPage = data.page;
        this.pageSize = data.limit;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Failed to load activity";
        console.error("Failed to load activity:", error);
      } finally {
        this.isLoading = false;
      }
    },

    async loadStats() {
      try {
        const response = await fetch("/admin/api/activity/stats");

        if (!response.ok) {
          throw new Error(`Failed to load activity stats: ${response.statusText}`);
        }

        this.stats = await response.json();
      } catch (error) {
        console.error("Failed to load activity stats:", error);
      }
    },

    async refreshAll(filters: ActivityFilters = {}) {
      await Promise.all([this.loadStats(), this.loadActivity(filters)]);
    },
  },
});
