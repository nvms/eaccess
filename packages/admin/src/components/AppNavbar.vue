<template>
  <header class="border-b bg-card">
    <div class="container mx-auto flex h-14 items-center justify-between px-6">
      <div class="flex items-center gap-8">
        <router-link to="/overview" class="flex items-center">
          <img src="@/assets/shield2.svg" alt="eaccess" class="h-5 w-auto brightness-0 dark:invert" />
        </router-link>

        <nav class="flex items-center gap-1">
          <router-link v-for="link in links" :key="link.to" :to="link.to" class="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground" active-class="bg-accent text-foreground! font-medium">
            {{ link.label }}
          </router-link>
        </nav>
      </div>

      <div class="flex items-center gap-2">
        <UserSearch />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button class="flex size-7 cursor-pointer select-none items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
              {{ initial }}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" class="w-56">
            <DropdownMenuLabel class="font-normal">
              <div class="text-xs text-muted-foreground">Signed in as</div>
              <div class="truncate text-sm font-medium">{{ authStore.userEmail }}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="goToOwnAccount">My account</DropdownMenuItem>
            <DropdownMenuItem @select="logout">Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useUsersStore } from "@/stores/users";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import ThemeToggle from "./ThemeToggle.vue";
import UserSearch from "./UserSearch.vue";

const authStore = useAuthStore();
const usersStore = useUsersStore();
const router = useRouter();

const links = [
  { to: "/overview", label: "Overview" },
  { to: "/users", label: "Users" },
  { to: "/activity", label: "Activity" },
];

const initial = computed(() => authStore.userEmail.charAt(0).toUpperCase() || "?");

async function goToOwnAccount() {
  try {
    const results = await usersStore.searchUsers(authStore.userEmail);
    const self = results.find((u) => u.email === authStore.userEmail);
    if (!self) throw new Error("Account not found");
    await router.push(`/users/edit/${self.id}`);
  } catch {
    toast.error("Could not open your account");
  }
}

async function logout() {
  await authStore.logout();
  await router.push("/login");
}
</script>
