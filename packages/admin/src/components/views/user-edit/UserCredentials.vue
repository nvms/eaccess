<template>
  <div class="divide-y rounded-lg border bg-card">
    <section class="px-5 py-4">
      <h3 class="text-sm font-medium">Authentication method</h3>
      <div v-if="user.providers && user.providers.length > 0" class="mt-3 space-y-2">
        <div v-for="provider in user.providers" :key="provider.provider" class="flex items-center gap-3">
          <ProviderIcon icon-class="size-4 text-muted-foreground" :provider="provider.provider" />
          <div class="text-sm">
            {{ getProviderName(provider.provider) }}
            <span v-if="provider.provider_name" class="text-muted-foreground"> · {{ provider.provider_name }}</span>
          </div>
        </div>
      </div>
      <div v-else class="mt-3 flex items-center gap-3">
        <Icon icon="mdi:at" class="size-4 text-muted-foreground" />
        <span class="text-sm">Email & password</span>
      </div>
    </section>

    <section class="px-5 py-4">
      <h3 class="text-sm font-medium">Password</h3>
      <template v-if="!user.providers || user.providers.length === 0">
        <p class="mt-0.5 text-xs text-muted-foreground">Set a new password for this user.</p>
        <div class="mt-3 flex max-w-md gap-2">
          <Input v-model="newPassword" type="password" placeholder="New password (min 8 characters)" :disabled="isChangingPassword" class="flex-1" @keyup.enter="changePassword" />
          <Button variant="outline" :disabled="!newPassword || isChangingPassword" @click="changePassword">
            {{ isChangingPassword ? "Changing..." : "Change" }}
          </Button>
        </div>
      </template>
      <p v-else class="mt-0.5 text-xs text-muted-foreground">This user authenticates through {{ getProviderName(user.providers[0].provider) }}. Their password is managed by the OAuth provider.</p>
    </section>

    <section class="px-5 py-4">
      <h3 class="text-sm font-medium">Pending tokens</h3>
      <div v-if="tokens.length > 0" class="mt-3 space-y-2">
        <div v-for="(token, index) in tokens" :key="index" class="flex items-center gap-3 text-sm">
          <Icon :icon="token.icon" class="size-4 text-muted-foreground" />
          <span>{{ token.label }}</span>
          <span class="text-muted-foreground">expires {{ formatDate(token.expires) }}</span>
        </div>
      </div>
      <p v-else class="mt-0.5 text-xs text-muted-foreground">No pending tokens.</p>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import ProviderIcon from "../../ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@iconify/vue";
import { useUsersStore, type User } from "@/stores/users";
import { formatDate, getProviderName } from "@/lib/display";
import { toast } from "vue-sonner";

const props = defineProps<{
  user: User;
}>();

const usersStore = useUsersStore();

const newPassword = ref("");
const isChangingPassword = ref(false);

const tokens = computed(() => {
  const items: Array<{ label: string; icon: string; expires: string }> = [];
  for (const token of props.user.confirmation_tokens ?? []) {
    items.push({ label: "Email confirmation", icon: "mdi:email-check-outline", expires: token.expires });
  }
  for (const token of props.user.reset_tokens ?? []) {
    items.push({ label: "Password reset", icon: "mdi:lock-reset", expires: token.expires });
  }
  for (const token of props.user.remember_tokens ?? []) {
    items.push({ label: "Remember me", icon: "mdi:account-clock", expires: token.expires });
  }
  return items;
});

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
</script>
