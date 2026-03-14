import { defineStore } from "pinia";
import { ref } from "vue";

export interface Stats {
  accounts: number;
  pendingConfirmations: number;
  activeRememberTokens: number;
  pendingResets: number;
}

export const useStatsStore = defineStore("stats", () => {
  const stats = ref<Stats>({
    accounts: 0,
    pendingConfirmations: 0,
    activeRememberTokens: 0,
    pendingResets: 0,
  });
  const isLoading = ref(false);

  async function loadStats() {
    isLoading.value = true;
    try {
      const response = await fetch("/admin/api/stats", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load stats");
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
