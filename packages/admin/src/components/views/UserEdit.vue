<template>
  <div class="min-h-screen">
    <AppNavbar />

    <main class="container mx-auto px-6 py-8">
      <router-link to="/users" class="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ChevronLeft class="size-4" />
        Users
      </router-link>

      <div v-if="user" class="mt-4">
        <header class="flex items-center gap-4">
          <div class="flex size-12 shrink-0 select-none items-center justify-center rounded-full bg-muted text-lg font-medium text-muted-foreground">
            {{ user.email.charAt(0).toUpperCase() }}
          </div>
          <div class="min-w-0">
            <h1 class="truncate text-xl font-semibold tracking-tight">{{ user.email }}</h1>
            <div class="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
              <span class="size-1.5 rounded-full" :class="getStatusDotClass(user.status)" />
              {{ getStatusName(user.status) }}
            </div>
          </div>
        </header>

        <dl class="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
          <div class="min-w-0">
            <dt class="text-xs font-medium text-muted-foreground">Foreign user ID</dt>
            <dd class="mt-1 flex h-9 items-center gap-1">
              <template v-if="!isEditingUserId">
                <span class="truncate font-mono text-sm" :title="user.user_id">{{ user.user_id }}</span>
                <Button variant="ghost" size="icon" class="size-7 shrink-0 text-muted-foreground" aria-label="Edit foreign user ID" @click="startEditUserId">
                  <Pencil class="size-3.5" />
                </Button>
              </template>
              <template v-else>
                <Input v-model="editUserId" class="h-8 min-w-0 flex-1 font-mono text-sm" :disabled="isSavingUserId" @keyup.enter="saveUserId" @keydown.escape="cancelEditUserId" />
                <Button variant="outline" size="sm" class="h-8 shrink-0" :disabled="isSavingUserId || !editUserId.trim()" @click="saveUserId">
                  {{ isSavingUserId ? "Saving..." : "Save" }}
                </Button>
                <Button variant="ghost" size="sm" class="h-8 shrink-0" :disabled="isSavingUserId" @click="cancelEditUserId"> Cancel </Button>
              </template>
            </dd>
          </div>

          <div>
            <dt class="text-xs font-medium text-muted-foreground">Registered</dt>
            <dd class="mt-1 flex h-9 items-center text-sm">{{ formatDate(user.registered) }}</dd>
          </div>

          <div>
            <dt class="text-xs font-medium text-muted-foreground">Last sign-in</dt>
            <dd class="mt-1 flex h-9 items-center text-sm">{{ formatDate(user.last_login) }}</dd>
          </div>
        </dl>

        <Tabs default-value="credentials" class="mt-8">
          <TabsList class="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
            <TabsTrigger v-for="tab in tabs" :key="tab.value" :value="tab.value" class="-mb-px flex-none rounded-none border-b-2 border-transparent px-1 pb-2.5 pt-0 text-sm text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-foreground dark:data-[state=active]:bg-transparent!">
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="credentials" class="mt-6">
            <UserCredentials :user="user" @refresh="loadUser" />
          </TabsContent>

          <TabsContent value="mfa" class="mt-6">
            <UserMFA :user="user" @refresh="loadUser" />
          </TabsContent>

          <TabsContent value="access-roles" class="mt-6">
            <UserAccessRoles :user="user" :temp-rolemask="tempRolemask" :temp-status="tempStatus" @update:temp-rolemask="tempRolemask = $event" @update:temp-status="tempStatus = $event" @load-user="loadUser" />
          </TabsContent>

          <TabsContent value="actions" class="mt-6">
            <UserActions :user="user" />
          </TabsContent>
        </Tabs>
      </div>

      <div v-if="!user && !isLoading" class="py-16 text-center text-sm text-muted-foreground">User not found</div>
      <div v-if="isLoading && !user" class="py-16 text-center text-sm text-muted-foreground">Loading user...</div>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed, watch } from "vue";
import { useRoute } from "vue-router";
import AppNavbar from "../AppNavbar.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Pencil } from "lucide-vue-next";
import UserCredentials from "./user-edit/UserCredentials.vue";
import UserMFA from "./user-edit/UserMFA.vue";
import UserAccessRoles from "./user-edit/UserAccessRoles.vue";
import UserActions from "./user-edit/UserActions.vue";
import { useUsersStore, type User } from "@/stores/users";
import { formatDate, getStatusDotClass, getStatusName } from "@/lib/display";
import { toast } from "vue-sonner";

const route = useRoute();
const usersStore = useUsersStore();

const user = ref<User | null>(null);
const isLoading = ref(false);
const tempRolemask = ref(0);
const tempStatus = ref(0);

const isEditingUserId = ref(false);
const editUserId = ref("");
const isSavingUserId = ref(false);

const userId = computed(() => route.params.id as string);

const tabs = [
  { value: "credentials", label: "Credentials" },
  { value: "mfa", label: "MFA" },
  { value: "access-roles", label: "Access & roles" },
  { value: "actions", label: "Moderation" },
];

onMounted(loadUser);

watch(userId, async (newId, oldId) => {
  if (newId !== oldId) {
    await loadUser();
  }
});

async function loadUser() {
  isLoading.value = true;
  try {
    const response = await fetch(`/admin/api/users/${userId.value}`, {
      credentials: "include",
    });

    if (response.ok) {
      const freshUser: User = await response.json();
      user.value = freshUser;
      tempRolemask.value = freshUser.rolemask;
      tempStatus.value = freshUser.status;
    } else {
      user.value = null;
    }
  } catch (error) {
    console.error("Failed to load user:", error);
  } finally {
    isLoading.value = false;
  }
}

function startEditUserId() {
  if (!user.value) return;
  editUserId.value = user.value.user_id;
  isEditingUserId.value = true;
}

function cancelEditUserId() {
  editUserId.value = "";
  isEditingUserId.value = false;
}

async function saveUserId() {
  if (!user.value || !editUserId.value.trim()) return;

  isSavingUserId.value = true;

  try {
    await usersStore.updateUserId(user.value.id, editUserId.value.trim());
    toast.success("User ID updated", {
      description: `User ID changed to ${editUserId.value.trim()}.`,
    });
    isEditingUserId.value = false;
    editUserId.value = "";
    await loadUser();
  } catch (error: any) {
    toast.error("Failed to update user ID", {
      description: error.message,
    });
  } finally {
    isSavingUserId.value = false;
  }
}
</script>
