import { defineStore } from "pinia";
import { ref, watch } from "vue";

export interface FilterConfig {
  type: string;
  label: string;
  config: any;
}

export const useFiltersStore = defineStore("filters", () => {
  const activeFilters = ref<FilterConfig[]>([]);

  // Load from localStorage on initialization
  function loadFromStorage() {
    try {
      const stored = localStorage.getItem("userManagementFilters");
      if (stored) {
        const parsedFilters = JSON.parse(stored);
        if (Array.isArray(parsedFilters)) {
          activeFilters.value = parsedFilters;
        }
      }
    } catch (error) {
      console.warn("Failed to load filters from localStorage:", error);
    }
  }

  // Save to localStorage whenever filters change
  function saveToStorage() {
    try {
      localStorage.setItem("userManagementFilters", JSON.stringify(activeFilters.value));
    } catch (error) {
      console.warn("Failed to save filters to localStorage:", error);
    }
  }

  // Watch for changes and persist
  watch(activeFilters, saveToStorage, { deep: true });

  function addFilter(type: string) {
    // Remove existing filter of the same type first
    activeFilters.value = activeFilters.value.filter((f) => f.type !== type);

    // Add filter with default config based on type
    switch (type) {
      case "role":
        activeFilters.value.push({
          type: "role",
          label: "Role",
          config: { selectedRoles: [1] }, // Default to Admin
        });
        break;
      case "mfa":
        activeFilters.value.push({
          type: "mfa",
          label: "MFA",
          config: { enabled: true }, // Default to "Enabled"
        });
        break;
      case "status":
        activeFilters.value.push({
          type: "status",
          label: "Status",
          config: { selectedStatuses: [0] }, // Default to "Normal"
        });
        break;
      case "provider":
        activeFilters.value.push({
          type: "provider",
          label: "Provider",
          config: { selectedProviders: ["email_password"] }, // Default to Email/Password
        });
        break;
    }
  }

  function updateFilter(type: string, config: any) {
    const filter = activeFilters.value.find((f) => f.type === type);
    if (filter) {
      filter.config = config;
    }
  }

  function removeFilter(type: string) {
    activeFilters.value = activeFilters.value.filter((f) => f.type !== type);
  }

  function clearAllFilters() {
    activeFilters.value = [];
  }

  function hasActiveFilter(type: string): boolean {
    return activeFilters.value.some((f) => f.type === type);
  }

  function getActiveFilter(type: string): FilterConfig | undefined {
    return activeFilters.value.find((f) => f.type === type);
  }

  function getAvailableFilters() {
    const activeTypes = activeFilters.value.map((f) => f.type);
    const allFilters = [
      { type: "role", label: "Role" },
      { type: "mfa", label: "MFA" },
      { type: "status", label: "Status" },
      { type: "provider", label: "Provider" },
    ];

    return allFilters.filter((f) => !activeTypes.includes(f.type));
  }

  // Convert filters to format expected by the users store
  function convertToStoreFormat() {
    const filters: {
      roles?: number[];
      mfa?: boolean;
      status?: number[];
      providers?: string[];
    } = {};

    activeFilters.value.forEach((filter) => {
      switch (filter.type) {
        case "role":
          if (filter.config.selectedRoles && filter.config.selectedRoles.length > 0) {
            filters.roles = filter.config.selectedRoles;
          }
          break;
        case "mfa":
          filters.mfa = filter.config.enabled;
          break;
        case "status":
          if (filter.config.selectedStatuses && filter.config.selectedStatuses.length > 0) {
            filters.status = filter.config.selectedStatuses;
          }
          break;
        case "provider":
          if (filter.config.selectedProviders && filter.config.selectedProviders.length > 0) {
            filters.providers = filter.config.selectedProviders;
          }
          break;
      }
    });

    return filters;
  }

  // Initialize from localStorage
  loadFromStorage();

  return {
    activeFilters,
    addFilter,
    updateFilter,
    removeFilter,
    clearAllFilters,
    hasActiveFilter,
    getActiveFilter,
    getAvailableFilters,
    convertToStoreFormat,
  };
});
