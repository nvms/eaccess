<template>
  <div class="min-h-screen flex flex-col">
    <AppNavbar />
    <div class="container mx-auto">
      <div class="space-y-6">
        <div v-if="user" class="w-full space-y-6">
          <!-- User Info Section -->
          <div class="mb-8">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
              <div class="min-w-0">
                <div class="text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1">Email</div>
                <div class="text-base font-light text-neutral-900 dark:text-neutral-100 truncate leading-9" :title="user.email">
                  {{ user.email }}
                </div>
              </div>

              <div class="min-w-0">
                <div class="text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1">Foreign user ID</div>
                <div class="flex items-center gap-2 min-w-0">
                  <div v-if="!isEditingUserId" class="text-base font-light font-mono text-neutral-900 dark:text-neutral-100 truncate leading-9" :title="user.user_id">
                    {{ user.user_id }}
                  </div>
                  <Input v-else v-model="editUserId" class="text-base font-light font-mono flex-1 min-w-0" :disabled="isSavingUserId" @keyup.enter="saveUserId" @keyup.escape="cancelEditUserId" />
                  <Button v-if="!isEditingUserId" variant="ghost" class="text-neutral-500 shrink-0" @click="startEditUserId"> Edit </Button>
                  <div v-else class="flex gap-1 shrink-0">
                    <Button variant="outline" @click="saveUserId" :disabled="isSavingUserId || !editUserId.trim()">
                      {{ isSavingUserId ? "Saving..." : "Save" }}
                    </Button>
                    <Button variant="outline" @click="cancelEditUserId" :disabled="isSavingUserId"> Cancel </Button>
                  </div>
                </div>
              </div>

              <div>
                <div class="text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1">Registered</div>
                <div class="text-base font-light text-neutral-900 dark:text-neutral-100 leading-9">
                  {{ formatDate(user.registered) }}
                </div>
              </div>

              <div>
                <div class="text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1">Last Login</div>
                <div class="text-base font-light text-neutral-900 dark:text-neutral-100 leading-9">
                  {{ formatDate(user.last_login) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Tabs Section -->
          <Tabs default-value="credentials" class="w-full space-y-4">
            <div class="flex items-center">
              <TabsList class="border [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
                <TabsTrigger value="credentials"> Credentials </TabsTrigger>
                <TabsTrigger value="mfa"> MFA </TabsTrigger>
                <TabsTrigger value="access-roles"> Access & Roles </TabsTrigger>
                <TabsTrigger value="actions"> Moderation </TabsTrigger>
              </TabsList>
              <div class="space-x-2">
                <!-- <Button variant="outline">Invalidate all authenticated sessions</Button>
                <Button variant="destructive">Delete</Button> -->
              </div>
            </div>

            <TabsContent value="credentials">
              <UserCredentials :user="user" @refresh="loadUser" />
            </TabsContent>

            <TabsContent value="mfa">
              <UserMFA :user="user" @refresh="loadUser" />
            </TabsContent>

            <TabsContent value="access-roles">
              <UserAccessRoles :user="user" :temp-rolemask="tempRolemask" :temp-status="tempStatus" @update:temp-rolemask="tempRolemask = $event" @update:temp-status="tempStatus = $event" @load-user="loadUser" />
            </TabsContent>

            <TabsContent value="actions">
              <UserActions :user="user" />
            </TabsContent>
          </Tabs>
        </div>

        <div v-if="!user && !isLoading" class="text-center py-8 text-muted-foreground">User not found</div>

        <div v-if="isLoading" class="text-center py-8 text-muted-foreground">Loading user...</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed, watch } from "vue";
import { useRoute } from "vue-router";
import AppNavbar from "../AppNavbar.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UserCredentials from "./user-edit/UserCredentials.vue";
import UserMFA from "./user-edit/UserMFA.vue";
import UserAccessRoles from "./user-edit/UserAccessRoles.vue";
import UserActions from "./user-edit/UserActions.vue";
import { useUsersStore, type User } from "@/stores/users";
import { toast } from "vue-sonner";

const route = useRoute();
const usersStore = useUsersStore();

const user = ref<User | null>(null);
const isLoading = ref(false);
const tempRolemask = ref(0);
const tempStatus = ref(0);

// User ID editing state
const isEditingUserId = ref(false);
const editUserId = ref("");
const isSavingUserId = ref(false);

const userId = computed(() => route.params.id as string);

onMounted(async () => {
  await loadUser();
});

// Watch for route parameter changes to reload user data
watch(
  () => route.params.id,
  async (newId, oldId) => {
    if (newId !== oldId) {
      await loadUser();
    }
  },
  { immediate: false },
);

async function loadUser() {
  isLoading.value = true;
  try {
    // First try to find user in current store
    let foundUser = usersStore.users.find((u) => u.id === parseInt(userId.value));

    if (!foundUser) {
      // If not found, fetch directly from API
      const response = await fetch(`/admin/api/users/${userId.value}`, {
        credentials: "include",
      });

      if (response.ok) {
        foundUser = await response.json();
      }
    }

    if (foundUser) {
      user.value = foundUser;
      tempRolemask.value = foundUser.rolemask;
      tempStatus.value = foundUser.status;
    }
  } catch (error) {
    console.error("Failed to load user:", error);
  } finally {
    isLoading.value = false;
  }
}

function formatDate(dateString: string | null) {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleString();
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
    // Reload user to get fresh data
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
