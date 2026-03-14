<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useUsersStore } from "../stores/users";
import { useStatsStore } from "../stores/stats";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import Shield2Logo from "../assets/shield2.svg";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const usersStore = useUsersStore();
const statsStore = useStatsStore();

const email = ref(import.meta.env.DEV ? "admin@demo.com" : "");
const password = ref(import.meta.env.DEV ? "Admin123!Demo" : "");
const remember = ref(false);
const error = ref("");
const emailInputComponent = ref();

onMounted(() => {
  // Focus the input element inside the Input component
  const inputElement = emailInputComponent.value?.$el;
  if (inputElement) {
    inputElement.focus();
  }
});

async function handleLogin() {
  error.value = "";
  try {
    await authStore.login(email.value, password.value, remember.value);

    // Load initial data after successful login
    await Promise.all([usersStore.loadRoles(), statsStore.loadStats(), usersStore.loadUsers()]);

    // Redirect to the intended page or home
    const redirectTo = (route.query.redirect as string) || "/";
    await router.push(redirectTo);
  } catch (err: any) {
    error.value = err.message || "Login failed";
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center dark:bg-black bg-neutral-100 px-4 sm:px-6 lg:px-8 relative">
    <div class="w-full max-w-md space-y-8 p-2 border rounded-2xl dark:border-neutral-700/50 bg-neutral-100 dark:bg-neutral-950 shadow-xl relative z-10 dark:[box-shadow:inset_0_0_0_3px_black] [box-shadow:inset_0_0_0_3px_white]">
      <div class="p-6 border rounded bg-background shadow-xs">
        <div class="text-center">
          <!-- Logo above form -->
          <div class="mb-8 flex justify-center">
            <img :src="Shield2Logo" alt="Easy Auth" class="w-12 h-12 invert dark:invert-0" />
          </div>
        </div>

        <form class="space-y-6" @submit.prevent="handleLogin">
          <div class="space-y-4">
            <div>
              <label for="email" class="block text-sm font-medium text-neutral-500 mb-2"> Email address </label>
              <Input id="email" ref="emailInputComponent" v-model="email" name="email" type="email" autocomplete="email" required placeholder="Enter your email" class="w-full" />
            </div>

            <div>
              <label for="password" class="block text-sm font-medium text-neutral-500 mb-2"> Password </label>
              <Input id="password" v-model="password" name="password" type="password" autocomplete="current-password" required placeholder="Enter your password" class="w-full" />
            </div>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <Checkbox id="remember-me" v-model="remember" name="remember-me" />
              <label for="remember-me" class="text-sm text-neutral-500 cursor-pointer"> Remember me </label>
            </div>
          </div>

          <div v-if="error" class="p-3 rounded-md bg-red-950/20 border border-red-900/30">
            <div class="text-sm text-red-400 text-center">
              {{ error }}
            </div>
          </div>

          <Button type="submit" :disabled="authStore.isLoading" class="w-full">
            <span v-if="authStore.isLoading">Signing in...</span>
            <span v-else>Sign in</span>
          </Button>
        </form>
      </div>
    </div>
  </div>
</template>
