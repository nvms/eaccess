<template>
  <div class="min-h-screen flex flex-col">
    <AppNavbar />

    <!-- Main Content Container -->
    <div class="container mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <!-- Left Column (1/3): User Activity + Token Activity -->
        <div class="space-y-4">
          <!-- Core Metrics Section -->
          <div class="space-y-2 border p-2 rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
            <!-- <h2 class="text-lg font-medium text-neutral-900 dark:text-neutral-100">Users</h2> -->
            <div class="space-y-2">
              <Stat title="Total users" :value="overviewStore.stats.totalUsers" :loading="overviewStore.isLoading" icon="mdi:account-group" icon-color="text-neutral-400 dark:text-neutral-500" />
              <Stat title="Active users (24h)" :value="overviewStore.stats.activeUsers24h" :loading="overviewStore.isLoading" icon="mdi:account-clock" icon-color="text-neutral-400 dark:text-neutral-500" />
              <Stat title="Active users (7d)" :value="overviewStore.stats.activeUsers7d" :loading="overviewStore.isLoading" icon="mdi:calendar-week" icon-color="text-neutral-400 dark:text-neutral-500" />
              <Stat title="Active users (30d)" :value="overviewStore.stats.activeUsers30d" :loading="overviewStore.isLoading" icon="mdi:calendar-month" icon-color="text-neutral-400 dark:text-neutral-500" />
            </div>
          </div>

          <!-- Token Activity Section -->
          <div class="space-y-2 border p-2 rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
            <!-- <h2 class="text-lg font-medium text-neutral-900 dark:text-neutral-100">Tokens</h2> -->
            <div class="space-y-2">
              <Stat title="Active email confirmation tokens" :value="overviewStore.stats.pendingConfirmations" :loading="overviewStore.isLoading" icon="mdi:email-check-outline" icon-color="text-neutral-400 dark:text-neutral-500" />
              <Stat title="Active password reset tokens" :value="overviewStore.stats.pendingResets" :loading="overviewStore.isLoading" icon="mdi:lock-reset" icon-color="text-neutral-400 dark:text-neutral-500" />
              <Stat title="Active session remember tokens" :value="overviewStore.stats.activeRememberTokens" :loading="overviewStore.isLoading" icon="mdi:account-clock" icon-color="text-neutral-400 dark:text-neutral-500" />
            </div>
          </div>
        </div>

        <!-- Right Column (2/3): MFA + Status + Auth Methods -->
        <div class="lg:col-span-2 space-y-4">
          <!-- MFA Overview Section -->
          <div class="space-y-2 border p-2 rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
            <!-- <h2 class="text-lg font-medium text-neutral-900 dark:text-neutral-100">MFA</h2> -->
            <Stat title="Users with MFA enabled" :value="overviewStore.stats.mfaEnabledUsers" :loading="overviewStore.isLoading" icon="mdi:shield-check" icon-color="text-neutral-400 dark:text-neutral-500" />
            <!-- MFA Distribution -->
            <div class="relative space-y-3 p-2 border rounded overflow-hidden bg-background shadow-xs">
              <!-- Large background icon -->
              <div class="absolute right-8 top-1/2 -translate-y-1/2 opacity-15">
                <Icon icon="mdi:shield-outline" class="w-15 h-15 text-neutral-400 dark:text-neutral-500" />
              </div>

              <!-- Content -->
              <div class="relative z-10">
                <div class="flex items-center justify-between">
                  <div class="text-sm font-medium text-neutral-400 dark:text-neutral-600">MFA mechanism distribution</div>
                </div>
                <div class="space-y-2">
                  <div v-if="overviewStore.isLoading" class="text-sm text-neutral-500">Loading...</div>
                  <div v-else-if="overviewStore.stats.mfaDistribution.length === 0" class="text-sm text-neutral-500">No MFA methods configured</div>
                  <div v-else class="space-y-2 mt-4">
                    <div v-for="method in overviewStore.stats.mfaDistribution" :key="method.mechanism" class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <div class="w-6 h-6 dark:bg-neutral-200 bg-neutral-700 rounded-full flex items-center justify-center flex-shrink-0 text-neutral-100 dark:text-neutral-950">
                          <Icon :icon="getMfaMethodIcon(method.mechanism)" class="h-4 w-4" />
                        </div>
                        <span class="text-sm text-neutral-700 dark:text-neutral-300">{{ getMfaMethodName(method.mechanism) }}</span>
                      </div>
                      <span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ method.count }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Status and Roles Section -->
          <div class="space-y-2 border p-2 rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
            <!-- <h2 class="text-lg font-medium text-neutral-900 dark:text-neutral-100">Status and roles</h2> -->

            <!-- User Status Distribution -->
            <div class="relative space-y-3 p-2 border rounded overflow-hidden bg-background shadow-xs">
              <!-- Large background icon -->
              <div class="absolute right-8 top-1/2 -translate-y-1/2 opacity-15">
                <Icon icon="mdi:account-multiple" class="w-15 h-15 text-neutral-400 dark:text-neutral-500" />
              </div>

              <!-- Content -->
              <div class="relative z-10">
                <div class="flex items-start justify-between">
                  <div class="text-sm font-medium text-neutral-400 dark:text-neutral-600">Status distribution</div>
                </div>
                <div class="space-y-2">
                  <div v-if="overviewStore.isLoading" class="text-sm text-neutral-500">Loading...</div>
                  <div v-else-if="overviewStore.stats.statusDistribution.length === 0" class="text-sm text-neutral-500">No users</div>
                  <div v-else class="space-y-2 mt-4">
                    <div v-for="statusItem in overviewStore.stats.statusDistribution" :key="statusItem.status" class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="inline-flex items-center px-2 py-1 text-sm rounded-md" :class="getStatusClass(statusItem.status)">
                          {{ getStatusName(statusItem.status) }}
                        </span>
                      </div>
                      <span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ statusItem.count }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Role Distribution -->
            <div class="relative space-y-3 p-2 border rounded overflow-hidden bg-background shadow-xs">
              <!-- Large background icon -->
              <div class="absolute right-8 top-1/2 -translate-y-1/2 opacity-15">
                <Icon icon="mdi:shield-account" class="w-15 h-15 text-neutral-400 dark:text-neutral-500" />
              </div>

              <!-- Content -->
              <div class="relative z-10">
                <div class="flex items-start justify-between">
                  <div class="text-sm font-medium text-neutral-400 dark:text-neutral-600">Role distribution</div>
                </div>
                <div class="space-y-2">
                  <div v-if="overviewStore.isLoading" class="text-sm text-neutral-500">Loading...</div>
                  <div v-else-if="overviewStore.stats.roleDistribution?.length === 0" class="text-sm text-neutral-500">No roles configured</div>
                  <div v-else class="grid grid-cols-3 gap-y-2 gap-x-12 mt-4">
                    <div v-for="roleItem in overviewStore.stats.roleDistribution" :key="roleItem.role" class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <div class="w-6 h-6 dark:bg-neutral-200 bg-neutral-700 rounded-full flex items-center justify-center flex-shrink-0 text-neutral-100 dark:text-neutral-950">
                          <Icon :icon="getRoleIcon(roleItem.role)" class="h-4 w-4" />
                        </div>
                        <span class="text-sm text-neutral-700 dark:text-neutral-300">{{ getRoleName(roleItem.role) }}</span>
                      </div>
                      <span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ roleItem.count }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Authentication Methods -->
          <div class="space-y-2 border p-2 rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
            <!-- <h2 class="text-lg font-medium text-neutral-900 dark:text-neutral-100">Authentication</h2> -->

            <!-- Authentication Methods Distribution -->
            <div class="relative space-y-3 p-2 border rounded overflow-hidden bg-background shadow-xs">
              <!-- Large background icon -->
              <div class="absolute right-8 top-1/2 -translate-y-1/2 opacity-15">
                <Icon icon="mdi:login" class="w-15 h-15 text-neutral-400 dark:text-neutral-500" />
              </div>

              <!-- Content -->
              <div class="relative z-10">
                <div class="flex items-start justify-between">
                  <div class="text-sm font-medium text-neutral-400 dark:text-neutral-600">Authentication method distribution</div>
                </div>
                <div class="space-y-2">
                  <div v-if="overviewStore.isLoading" class="text-sm text-neutral-500">Loading...</div>
                  <div v-else-if="overviewStore.stats.authMethods.length === 0" class="text-sm text-neutral-500">No authentication methods</div>
                  <div v-else class="space-y-2 mt-4">
                    <div v-for="authMethod in overviewStore.stats.authMethods" :key="authMethod.method" class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <div class="w-6 h-6 dark:bg-neutral-200 bg-neutral-700 rounded-full flex items-center justify-center flex-shrink-0 text-neutral-100 dark:text-neutral-950">
                          <Icon :icon="getAuthMethodIcon(authMethod.method)" class="h-4 w-4" />
                        </div>
                        <span class="text-sm text-neutral-700 dark:text-neutral-300">{{ getAuthMethodName(authMethod.method) }}</span>
                      </div>
                      <span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ authMethod.count }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted } from "vue";
import AppNavbar from "../AppNavbar.vue";
import Stat from "../Stat.vue";
import { Icon } from "@iconify/vue";
import { useOverviewStore } from "@/stores/overview";
import { AuthStatus } from "@/stores/users";

const overviewStore = useOverviewStore();

onMounted(async () => {
  await overviewStore.loadStats();
});

function getStatusClass(status: number) {
  switch (status) {
    case AuthStatus.Normal:
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-600";
    case AuthStatus.Archived:
      return "bg-neutral-200 text-neutral-800 dark:bg-neutral-700/30 dark:text-neutral-500";
    case AuthStatus.Banned:
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500";
    case AuthStatus.Locked:
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-500";
    case AuthStatus.PendingReview:
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500";
    case AuthStatus.Suspended:
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-500";
    default:
      return "bg-neutral-100 text-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-500";
  }
}

function getStatusName(status: number): string {
  switch (status) {
    case AuthStatus.Normal:
      return "Normal";
    case AuthStatus.Archived:
      return "Archived";
    case AuthStatus.Banned:
      return "Banned";
    case AuthStatus.Locked:
      return "Locked";
    case AuthStatus.PendingReview:
      return "Pending Review";
    case AuthStatus.Suspended:
      return "Suspended";
    default:
      return "Unknown";
  }
}

function getMfaMethodName(mechanism: number): string {
  switch (mechanism) {
    case 1:
      return "TOTP";
    case 2:
      return "Email";
    case 3:
      return "SMS";
    default:
      return "Unknown";
  }
}

function getAuthMethodName(method: string): string {
  switch (method) {
    case "email_password":
      return "Email/Password";
    case "github":
      return "GitHub";
    case "google":
      return "Google";
    case "azure":
      return "Azure";
    default:
      return method.charAt(0).toUpperCase() + method.slice(1);
  }
}

function getAuthMethodIcon(method: string): string {
  switch (method) {
    case "email_password":
      return "mdi:email";
    case "github":
      return "mdi:github";
    case "google":
      return "gg:google";
    case "azure":
      return "teenyicons:azure-solid";
    default:
      return "mdi:login";
  }
}

function getMfaMethodIcon(mechanism: number): string {
  switch (mechanism) {
    case 1:
      return "mdi:shield-key";
    case 2:
      return "mdi:email-outline";
    case 3:
      return "mdi:message-text-outline";
    default:
      return "mdi:shield-outline";
  }
}

function getRoleName(role: string): string {
  return role;
}

function getRoleIcon(role: string): string {
  switch (role) {
    case "Admin":
      return "mdi:shield-crown";
    case "SuperAdmin":
      return "mdi:shield-star";
    case "SuperEditor":
      return "mdi:shield-edit";
    case "SuperModerator":
      return "mdi:shield-sword";
    case "Moderator":
      return "mdi:shield-half-full";
    case "Manager":
      return "mdi:account-supervisor";
    case "Director":
      return "mdi:account-tie-hat";
    case "Author":
      return "mdi:pencil";
    case "Editor":
      return "mdi:pencil-box";
    case "Publisher":
      return "mdi:publish";
    case "Reviewer":
      return "mdi:eye-check";
    case "Creator":
      return "mdi:creation";
    case "Developer":
      return "mdi:code-braces";
    case "Member":
      return "mdi:wrench";
    case "Collaborator":
      return "mdi:account-group";
    case "Contributor":
      return "mdi:account-plus";
    case "Owner":
      return "mdi:account-network";
    case "Consultant":
      return "mdi:account-tie";
    case "Employee":
      return "mdi:badge-account";
    case "Consumer":
      return "mdi:account";
    case "Subscriber":
      return "mdi:account-heart";
    case "Translator":
      return "mdi:translate";
    default:
      return "mdi:account-circle";
  }
}
</script>
