<script setup lang="ts">
import { onMounted } from "vue";
import { useAuthStore } from "./stores/auth";
import { useUsersStore } from "./stores/users";
import { useStatsStore } from "./stores/stats";
import { useColorMode } from "@vueuse/core";
import { Toaster } from "vue-sonner";
import ViewTransitionRouterView from "./components/ViewTransitionRouterView.vue";
import "vue-sonner/style.css";

useColorMode({ storageKey: "easyaccess-theme" });
const authStore = useAuthStore();
const usersStore = useUsersStore();
const statsStore = useStatsStore();

onMounted(async () => {
  const isAuthenticated = await authStore.checkAuthStatus();

  if (isAuthenticated) {
    try {
      await Promise.all([usersStore.loadRoles(), statsStore.loadStats(), usersStore.loadUsers()]);
    } catch (error) {
      console.error("Failed to load initial data:", error);
    }
  }
});
</script>

<template>
  <div class="min-h-screen">
    <div v-if="!authStore.isLoggedIn">
      <ViewTransitionRouterView :transition="false" />
    </div>

    <div v-else>
      <main class="bg-neutral-50 dark:bg-background">
        <ViewTransitionRouterView :transition="false" />
      </main>
    </div>

    <Toaster />
  </div>
</template>
