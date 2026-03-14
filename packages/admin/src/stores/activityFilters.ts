import { defineStore } from "pinia";
import { ref, watch } from "vue";

export interface ActivityFilterConfig {
  type: string;
  label: string;
  config: any;
}

export const useActivityFiltersStore = defineStore("activityFilters", () => {
  const activeFilters = ref<ActivityFilterConfig[]>([]);

  // Load from localStorage on initialization
  function loadFromStorage() {
    try {
      const stored = localStorage.getItem("activityFilters");
      if (stored) {
        const parsedFilters = JSON.parse(stored);
        if (Array.isArray(parsedFilters)) {
          activeFilters.value = parsedFilters;
        }
      }
    } catch (error) {
      console.warn("Failed to load activity filters from localStorage:", error);
    }
  }

  // Save to localStorage whenever filters change
  function saveToStorage() {
    try {
      localStorage.setItem("activityFilters", JSON.stringify(activeFilters.value));
    } catch (error) {
      console.warn("Failed to save activity filters to localStorage:", error);
    }
  }

  // Watch for changes and persist
  watch(activeFilters, saveToStorage, { deep: true });

  function addFilter(type: string) {
    // Remove existing filter of the same type first
    activeFilters.value = activeFilters.value.filter((f) => f.type !== type);

    // Add filter with default config based on type
    switch (type) {
      case "eventType":
        activeFilters.value.push({
          type: "eventType",
          label: "Event",
          config: { selectedEvents: ["login"] }, // Default to login events
        });
        break;
      case "browser":
        activeFilters.value.push({
          type: "browser",
          label: "Browser",
          config: { selectedBrowsers: ["Chrome"] }, // Default to Chrome
        });
        break;
      case "os":
        activeFilters.value.push({
          type: "os",
          label: "OS",
          config: { selectedOSes: ["macOS"] }, // Default to macOS
        });
        break;
      case "timeRange":
        activeFilters.value.push({
          type: "timeRange",
          label: "Time",
          config: { selectedRange: "24h" }, // Default to last 24 hours
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

  function getActiveFilter(type: string): ActivityFilterConfig | undefined {
    return activeFilters.value.find((f) => f.type === type);
  }

  function getAvailableFilters() {
    const activeTypes = activeFilters.value.map((f) => f.type);
    const allFilters = [
      { type: "eventType", label: "Event" },
      { type: "browser", label: "Browser" },
      { type: "os", label: "OS" },
      { type: "timeRange", label: "Time" },
    ];

    return allFilters.filter((f) => !activeTypes.includes(f.type));
  }

  // Convert filters to format expected by the activity store
  function convertToStoreFormat() {
    const filters: {
      events?: string[];
      browsers?: string[];
      oses?: string[];
      timeFilter?: string;
    } = {};

    activeFilters.value.forEach((filter) => {
      switch (filter.type) {
        case "eventType":
          if (filter.config.selectedEvents && filter.config.selectedEvents.length > 0) {
            filters.events = filter.config.selectedEvents;
          }
          break;
        case "browser":
          if (filter.config.selectedBrowsers && filter.config.selectedBrowsers.length > 0) {
            filters.browsers = filter.config.selectedBrowsers;
          }
          break;
        case "os":
          if (filter.config.selectedOSes && filter.config.selectedOSes.length > 0) {
            filters.oses = filter.config.selectedOSes;
          }
          break;
        case "timeRange":
          filters.timeFilter = filter.config.selectedRange;
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
