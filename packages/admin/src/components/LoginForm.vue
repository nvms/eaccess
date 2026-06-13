<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useUsersStore } from "../stores/users";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import Shield2Logo from "../assets/shield2.svg";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const usersStore = useUsersStore();

const email = ref(import.meta.env.DEV ? "admin@demo.com" : "");
const password = ref(import.meta.env.DEV ? "Admin123!Demo" : "");
const remember = ref(false);
const error = ref("");
const emailInputComponent = ref();

onMounted(() => {
  emailInputComponent.value?.$el?.focus();
});

async function handleLogin() {
  error.value = "";
  try {
    await authStore.login(email.value, password.value, remember.value);
    await usersStore.loadRoles();

    const redirectTo = (route.query.redirect as string) || "/";
    await router.push(redirectTo);
  } catch (err: any) {
    error.value = err.message || "Login failed";
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-4">
    <div class="w-full max-w-sm">
      <div class="rounded-xl border bg-card p-8 shadow-sm">
        <div class="mb-8 flex flex-col items-center gap-4">
          <img :src="Shield2Logo" alt="eaccess" class="h-8 w-8 brightness-0 dark:invert" />
          <div class="text-center">
            <h1 class="text-base font-semibold tracking-tight">Sign in</h1>
            <p class="mt-1 text-sm text-muted-foreground">to continue to the admin panel</p>
          </div>
        </div>

        <form class="space-y-4" @submit.prevent="handleLogin">
          <div>
            <label for="email" class="mb-1.5 block text-sm font-medium"> Email address </label>
            <Input id="email" ref="emailInputComponent" v-model="email" name="email" type="email" autocomplete="email" required class="w-full" />
          </div>

          <div>
            <label for="password" class="mb-1.5 block text-sm font-medium"> Password </label>
            <Input id="password" v-model="password" name="password" type="password" autocomplete="current-password" required class="w-full" />
          </div>

          <div class="flex items-center gap-2">
            <Checkbox id="remember-me" v-model="remember" name="remember-me" />
            <label for="remember-me" class="cursor-pointer text-sm text-muted-foreground"> Remember me </label>
          </div>

          <p v-if="error" class="text-sm text-destructive">
            {{ error }}
          </p>

          <Button type="submit" :disabled="authStore.isLoading" class="w-full">
            {{ authStore.isLoading ? "Signing in..." : "Sign in" }}
          </Button>
        </form>
      </div>
    </div>
  </div>
</template>
