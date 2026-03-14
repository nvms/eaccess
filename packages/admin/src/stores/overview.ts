import { defineStore } from "pinia";
import { ref } from "vue";

export interface StatusDistribution {
  status: number;
  count: number;
}

export interface AuthMethod {
  method: string;
  count: number;
}

export interface MfaDistribution {
  mechanism: number;
  count: number;
}

export interface RoleDistribution {
  role: string;
  count: number;
}

export interface OverviewStats {
  totalUsers: number;
  activeUsers24h: number;
  activeUsers7d: number;
  activeUsers30d: number;
  pendingConfirmations: number;
  pendingResets: number;
  activeRememberTokens: number;
  mfaEnabledUsers: number;
  statusDistribution: StatusDistribution[];
  authMethods: AuthMethod[];
  mfaDistribution: MfaDistribution[];
  roleDistribution: RoleDistribution[];
}

export const useOverviewStore = defineStore("overview", () => {
  const stats = ref<OverviewStats>({
    totalUsers: 0,
    activeUsers24h: 0,
    activeUsers7d: 0,
    activeUsers30d: 0,
    pendingConfirmations: 0,
    pendingResets: 0,
    activeRememberTokens: 0,
    mfaEnabledUsers: 0,
    statusDistribution: [],
    authMethods: [],
    mfaDistribution: [],
    roleDistribution: [],
  });
  const isLoading = ref(false);

  async function loadStats() {
    isLoading.value = true;
    try {
      const response = await fetch("/admin/api/overview-stats", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load overview stats");
      }

      const data = await response.json();
      stats.value = data;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    stats,
    isLoading,
    loadStats,
  };
});
