<template>
  <nav class="pl-2 pt-3 mb-8 container mx-auto">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-6">
        <div class="flex items-center">
          <img src="@/assets/shield2.svg" alt="easyauth" class="h-6 w-auto brightness-0 dark:invert" />
        </div>

        <div class="flex items-center gap-2">
          <router-link to="/overview" class="text-sm px-2 py-1 rounded-md font-medium text-neutral-700 dark:text-neutral-500 transition-colors" active-class="text-black dark:text-white underline underline-offset-[5px]"> Overview </router-link>
          <router-link to="/users" class="text-sm px-2 py-1 rounded-md font-medium text-neutral-700 dark:text-neutral-500 transition-colors" active-class="text-black dark:text-white underline underline-offset-[5px]"> Users </router-link>
          <router-link to="/activity" class="text-sm px-2 py-1 rounded-md font-medium text-neutral-700 dark:text-neutral-500 transition-colors" active-class="text-black dark:text-white underline underline-offset-[5px]"> Activity </router-link>
        </div>
      </div>

      <div class="flex items-center space-x-4">
        <UserSearch />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" class="rounded-full select-none">
              <User2 class="h-4 w-4" />
              {{ authStore.userEmail }}
              <ChevronDown class="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end">
            <DropdownMenuItem>
              <span>Account</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <span @click="logout">Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { ChevronDown, User2 } from "lucide-vue-next";
import { useRouter } from "vue-router";
import ThemeToggle from "./ThemeToggle.vue";
import UserSearch from "./UserSearch.vue";
import { Button } from "./ui/button";

const authStore = useAuthStore();
const router = useRouter();

async function logout() {
  await authStore.logout();
  await router.push("/login");
}
</script>
