<template>
  <div class="space-y-4">
    <div class="p-2 border rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
      <h3 class="text-lg mb-2 flex items-center justify-between">
        <span>Account status</span>
        <Icon icon="mdi:account-check" class="h-6 w-6 text-neutral-500" />
      </h3>
      <div class="bg-background p-3 border rounded shadow-xs">
        <div class="text-sm text-neutral-500 mb-3">Only users with "Normal" status can log in. All other statuses will prevent authentication.</div>
        <Select v-model="tempStatus" @update:model-value="saveStatus">
          <SelectTrigger class="w-full">
            <SelectValue :placeholder="usersStore.getStatusName(tempStatus)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="usersStore.AuthStatus.Normal"> Normal </SelectItem>
            <SelectItem :value="usersStore.AuthStatus.Archived"> Archived </SelectItem>
            <SelectItem :value="usersStore.AuthStatus.Banned"> Banned </SelectItem>
            <SelectItem :value="usersStore.AuthStatus.Locked"> Locked </SelectItem>
            <SelectItem :value="usersStore.AuthStatus.PendingReview"> Pending Review </SelectItem>
            <SelectItem :value="usersStore.AuthStatus.Suspended"> Suspended </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div class="p-2 border rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
      <h3 class="text-lg mb-2 flex items-center justify-between">
        <span>Roles</span>
        <Icon icon="mdi:shield-account" class="h-6 w-6 text-neutral-500" />
      </h3>
      <div class="bg-background p-3 border rounded shadow-xs">
        <div class="grid grid-cols-4 gap-3">
          <div v-for="[roleName, roleValue] in Object.entries(usersStore.roles)" :key="roleName" class="flex items-center space-x-2">
            <Checkbox :id="`role-${roleName}`" :model-value="hasRole(roleValue as number)" @update:model-value="toggleAndSaveRole(roleValue as number)" />
            <label :for="`role-${roleName}`" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {{ roleName }}
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from "vue";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUsersStore, type User } from "@/stores/users";
import { toast } from "vue-sonner";
import { Icon } from "@iconify/vue";

const props = defineProps<{
  user: User;
  tempRolemask: number;
  tempStatus: number;
}>();

const emit = defineEmits<{
  "update:tempRolemask": [value: number];
  "update:tempStatus": [value: number];
  loadUser: [];
}>();

const usersStore = useUsersStore();

const tempStatus = ref(props.tempStatus);
const tempRolemask = ref(props.tempRolemask);

// Watch for prop changes and update local refs
watch(
  () => props.tempRolemask,
  (newValue) => {
    tempRolemask.value = newValue;
  },
  { immediate: true },
);

watch(
  () => props.tempStatus,
  (newValue) => {
    tempStatus.value = newValue;
  },
  { immediate: true },
);

function hasRole(roleValue: number) {
  return !!(tempRolemask.value & roleValue);
}

function toggleRole(roleValue: number) {
  if (tempRolemask.value & roleValue) {
    tempRolemask.value &= ~roleValue; // Remove role
  } else {
    tempRolemask.value |= roleValue; // Add role
  }
  emit("update:tempRolemask", tempRolemask.value);
}

async function toggleAndSaveRole(roleValue: number) {
  if (!props.user) return;

  toggleRole(roleValue);

  try {
    await usersStore.updateUserRoles(props.user.id, tempRolemask.value);
    const roleName = Object.entries(usersStore.roles).find(([_, value]) => value === roleValue)?.[0] || "Role";
    const action = hasRole(roleValue) ? "added" : "removed";

    toast.success("Roles updated", {
      description: `${roleName} ${action} for ${props.user.email}.`,
    });
    emit("loadUser");
  } catch (error: any) {
    // Revert the change if the save failed
    toggleRole(roleValue);
    toast.error("Failed to update roles", {
      description: error.message,
    });
  }
}

async function saveStatus() {
  if (!props.user) return;

  emit("update:tempStatus", tempStatus.value);

  try {
    await usersStore.updateUserStatus(props.user.id, tempStatus.value);
    toast.success("Status updated", {
      description: `Status for ${props.user.email} has been updated to ${usersStore.getStatusName(tempStatus.value)}.`,
    });
    emit("loadUser");
  } catch (error: any) {
    toast.error("Failed to update status", {
      description: error.message,
    });
  }
}
</script>
