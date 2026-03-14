<template>
  <div class="space-y-4">
    <div class="p-2 border rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
      <h3 class="text-lg mb-2 flex items-center justify-between">
        <span>Authentication method</span>
        <Icon icon="material-symbols-light:key-rounded" class="h-6 w-6 text-neutral-500" />
      </h3>
      <div v-if="user.providers && user.providers.length > 0" class="space-y-3">
        <div v-for="provider in user.providers" :key="provider.provider" class="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg border dark:border-indigo-900 border-indigo-200">
          <div class="flex-shrink-0">
            <ProviderIcon icon-class="w-6 h-6" :provider="provider.provider" />
          </div>
          <div class="flex-1">
            <div class="text-indigo-700 dark:text-indigo-300">
              {{ provider.provider }}
            </div>
            <div class="text-xs text-indigo-600 dark:text-indigo-400">Signed in via {{ provider.provider_name || provider.provider }}</div>
          </div>
          <div class="flex-shrink-0">
            <!-- <div class="w-2 h-2 bg-green-500 rounded-full"></div> -->
          </div>
        </div>
      </div>
      <div v-else class="p-3 bg-background rounded-lg border shadow-xs">
        <div class="flex items-center gap-3">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-full flex items-center justify-center">
              <Icon icon="mdi:at" class="w-4 h-4" />
            </div>
          </div>
          <div class="flex-1">
            <div class="text-neutral-900 dark:text-neutral-100">Email & Password</div>
            <div class="text-xs text-neutral-600 dark:text-neutral-400">Traditional email/password authentication</div>
          </div>
          <div class="flex-shrink-0">
            <!-- <div class="w-2 h-2 bg-neutral-400 rounded-full"></div> -->
          </div>
        </div>
      </div>
    </div>

    <div class="p-2 border rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
      <h3 class="text-lg mb-2 flex items-center justify-between">
        <span>Password management</span>
        <Icon icon="fluent:password-24-filled" class="h-6 w-6 text-neutral-500" />
      </h3>

      <!-- Show password management for email/password users -->
      <div v-if="!user.providers || user.providers.length === 0" class="space-y-3">
        <div class="p-3 border rounded-md space-y-3 bg-background shadow-xs">
          <div>
            <div class="font-medium text-sm mb-2">Change Password</div>
            <div class="text-xs text-neutral-500 mb-3">Set a new password for this user</div>
          </div>
          <div class="flex gap-2">
            <Input v-model="newPassword" type="password" placeholder="New password (min 8 characters)" :disabled="isChangingPassword" @keyup.enter="changePassword" class="flex-1" />
            <Button @click="changePassword" :disabled="!newPassword || isChangingPassword">
              {{ isChangingPassword ? "Changing..." : "Change" }}
            </Button>
          </div>
        </div>

        <!-- <div class="flex items-center justify-between p-3 bg-muted/50 rounded-md">
          <div>
            <div class="font-medium text-sm">Send Password Reset</div>
            <div class="text-xs text-muted-foreground">
              Send password reset link to user's email
            </div>
          </div>
          <Button variant="outline" size="sm" disabled>
            Coming Soon
          </Button>
        </div> -->
      </div>

      <!-- Show message for OAuth users -->
      <div v-else class="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg border dark:border-indigo-900 border-indigo-200">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 mt-0.5">
            <Icon icon="cbi:oauth" class="w-6 h-6" />
          </div>
          <div>
            <div class="text-indigo-700 dark:text-indigo-300 mb-1">OAuth Authentication</div>
            <div class="text-xs text-indigo-600 dark:text-indigo-400">This user authenticates through {{ user.providers[0].provider }}. Password management is handled by their OAuth provider and cannot be controlled from this admin panel.</div>
          </div>
        </div>
      </div>
    </div>

    <div class="p-2 border rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
      <h3 class="text-lg mb-2 flex items-center justify-between">
        <span>Tokens</span>
        <Icon icon="bitcoin-icons:coins-filled" class="h-6 w-6 text-neutral-500" />
      </h3>

      <div class="space-y-2">
        <!-- Email confirmation tokens -->
        <div v-if="user.confirmation_tokens && user.confirmation_tokens.length > 0">
          <div class="space-y-2">
            <div v-for="(token, index) in user.confirmation_tokens" :key="index" class="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border shadow-xs">
              <div class="flex items-center gap-3">
                <div class="flex-shrink-0">
                  <Icon icon="mdi:email-outline" class="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div class="flex-1">
                  <div class="text-sm text-amber-800 dark:text-amber-200">Confirmation token expires {{ formatDate(token.expires) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Password reset tokens -->
        <div v-if="user.reset_tokens && user.reset_tokens.length > 0">
          <div class="space-y-2">
            <div v-for="(token, index) in user.reset_tokens" :key="index" class="p-3 bg-red-50 dark:bg-red-950/40 rounded-lg border shadow-xs">
              <div class="flex items-center gap-3">
                <div class="flex-shrink-0">
                  <Icon icon="mdi:lock-reset" class="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <div class="flex-1">
                  <div class="text-sm text-red-800 dark:text-red-200">Reset token expires {{ formatDate(token.expires) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Remember tokens -->
        <div v-if="user.remember_tokens && user.remember_tokens.length > 0">
          <div class="space-y-2">
            <div v-for="(token, index) in user.remember_tokens" :key="index" class="p-3 bg-green-50 dark:bg-green-950/40 rounded-lg border shadow-xs">
              <div class="flex items-center gap-3">
                <div class="flex-shrink-0">
                  <Icon icon="mdi:account-clock" class="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div class="flex-1">
                  <div class="text-sm text-green-800 dark:text-green-200">Remember token expires {{ formatDate(token.expires) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="(!user.confirmation_tokens || user.confirmation_tokens.length === 0) && (!user.reset_tokens || user.reset_tokens.length === 0) && (!user.remember_tokens || user.remember_tokens.length === 0)"
        class="text-sm text-neutral-500 bg-background border p-3 rounded shadow-xs"
      >
        No pending tokens
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import ProviderIcon from "../../ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@iconify/vue";
import { useUsersStore, type User } from "@/stores/users";
import { toast } from "vue-sonner";

const props = defineProps<{
  user: User;
}>();

const usersStore = useUsersStore();

const newPassword = ref("");
const isChangingPassword = ref(false);

async function changePassword() {
  if (!newPassword.value || newPassword.value.length < 8) {
    toast.error("Password must be at least 8 characters");
    return;
  }

  isChangingPassword.value = true;

  try {
    await usersStore.changeUserPassword(props.user.id, newPassword.value);
    toast.success("Password changed", {
      description: `Password for ${props.user.email} has been updated.`,
    });
    newPassword.value = "";
  } catch (error: any) {
    toast.error("Failed to change password", {
      description: error.message,
    });
  } finally {
    isChangingPassword.value = false;
  }
}

function formatDate(dateString: string | null) {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleString();
}
</script>
