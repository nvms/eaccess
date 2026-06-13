<script setup lang="ts">
import { onMounted } from "vue";
import { useAuthStore } from "./stores/auth";
import { useUsersStore } from "./stores/users";
import { useColorMode } from "@vueuse/core";
import { Toaster } from "vue-sonner";
import "vue-sonner/style.css";

useColorMode({ storageKey: "easyaccess-theme" });
const authStore = useAuthStore();
const usersStore = useUsersStore();

onMounted(async () => {
  const isAuthenticated = await authStore.checkAuthStatus();

  if (isAuthenticated) {
    try {
      await usersStore.loadRoles();
    } catch (error) {
      console.error("Failed to load initial data:", error);
    }
  }
});
</script>

<template>
  <div class="min-h-screen">
    <router-view />
    <Toaster />
  </div>
</template>
