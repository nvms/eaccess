<template>
  <div class="space-x-2 flex items-center">
    <EventTypeFilter v-if="filtersStore.hasActiveFilter('eventType')" :config="filtersStore.getActiveFilter('eventType')?.config" @update="filtersStore.updateFilter('eventType', $event)" @remove="filtersStore.removeFilter('eventType')" />
    <BrowserFilter v-if="filtersStore.hasActiveFilter('browser')" :config="filtersStore.getActiveFilter('browser')?.config" @update="filtersStore.updateFilter('browser', $event)" @remove="filtersStore.removeFilter('browser')" />
    <OSFilter v-if="filtersStore.hasActiveFilter('os')" :config="filtersStore.getActiveFilter('os')?.config" @update="filtersStore.updateFilter('os', $event)" @remove="filtersStore.removeFilter('os')" />
    <TimeRangeFilter v-if="filtersStore.hasActiveFilter('timeRange')" :config="filtersStore.getActiveFilter('timeRange')?.config" @update="filtersStore.updateFilter('timeRange', $event)" @remove="filtersStore.removeFilter('timeRange')" />
    <AddFilterDropdown :available-filters="filtersStore.getAvailableFilters()" @select="filtersStore.addFilter" />
  </div>
</template>

<script setup lang="ts">
import AddFilterDropdown from "./AddFilterDropdown.vue";
import EventTypeFilter from "./activity-filters/EventTypeFilter.vue";
import BrowserFilter from "./activity-filters/BrowserFilter.vue";
import OSFilter from "./activity-filters/OSFilter.vue";
import TimeRangeFilter from "./activity-filters/TimeRangeFilter.vue";
import { useActivityFiltersStore } from "@/stores/activityFilters";

const filtersStore = useActivityFiltersStore();
</script>
