<template>
  <div class="space-x-2 flex items-center">
    <RoleFilter v-if="filtersStore.hasActiveFilter('role')" :config="filtersStore.getActiveFilter('role')?.config" @update="filtersStore.updateFilter('role', $event)" @remove="filtersStore.removeFilter('role')" />
    <MfaFilter v-if="filtersStore.hasActiveFilter('mfa')" :config="filtersStore.getActiveFilter('mfa')?.config" @update="filtersStore.updateFilter('mfa', $event)" @remove="filtersStore.removeFilter('mfa')" />
    <StatusFilter v-if="filtersStore.hasActiveFilter('status')" :config="filtersStore.getActiveFilter('status')?.config" @update="filtersStore.updateFilter('status', $event)" @remove="filtersStore.removeFilter('status')" />
    <ProviderFilter v-if="filtersStore.hasActiveFilter('provider')" :config="filtersStore.getActiveFilter('provider')?.config" @update="filtersStore.updateFilter('provider', $event)" @remove="filtersStore.removeFilter('provider')" />
    <AddFilterDropdown :available-filters="filtersStore.getAvailableFilters()" @select="filtersStore.addFilter" />
  </div>
</template>

<script setup lang="ts">
import AddFilterDropdown from "./AddFilterDropdown.vue";
import RoleFilter from "./filters/RoleFilter.vue";
import MfaFilter from "./filters/MfaFilter.vue";
import StatusFilter from "./filters/StatusFilter.vue";
import ProviderFilter from "./filters/ProviderFilter.vue";
import { useFiltersStore } from "@/stores/filters";

const filtersStore = useFiltersStore();
</script>
