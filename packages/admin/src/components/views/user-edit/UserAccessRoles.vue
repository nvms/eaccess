<template>
  <div class="divide-y rounded-lg border bg-card">
    <section class="px-5 py-4">
      <h3 class="text-sm font-medium">Account status</h3>
      <p class="mt-0.5 text-xs text-muted-foreground">Only users with "Normal" status can log in. All other statuses prevent authentication.</p>
      <Select v-model="tempStatus" @update:model-value="saveStatus">
        <SelectTrigger class="mt-3 w-full max-w-xs">
          <SelectValue :placeholder="getStatusName(tempStatus)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="status in statusOptions" :key="status" :value="status">
            {{ getStatusName(status) }}
          </SelectItem>
        </SelectContent>
      </Select>
    </section>

    <section class="px-5 py-4">
      <h3 class="text-sm font-medium">Roles</h3>
      <p class="mt-0.5 text-xs text-muted-foreground">Changes are saved immediately.</p>
      <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div v-for="[roleName, roleValue] in Object.entries(usersStore.roles)" :key="roleName" class="flex items-center gap-2">
          <Checkbox :id="`role-${roleName}`" :model-value="hasRole(roleValue as number)" @update:model-value="toggleAndSaveRole(roleValue as number)" />
          <label :for="`role-${roleName}`" class="cursor-pointer text-sm leading-none">
            {{ roleName }}
          </label>
        </div>
      </div>
      <p v-if="Object.keys(usersStore.roles).length === 0" class="mt-3 text-sm text-muted-foreground">No roles configured.</p>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from "vue";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthStatus, useUsersStore, type User } from "@/stores/users";
import { getStatusName } from "@/lib/display";
import { toast } from "vue-sonner";

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

const statusOptions = Object.values(AuthStatus);

const tempStatus = ref(props.tempStatus);
const tempRolemask = ref(props.tempRolemask);

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
    tempRolemask.value &= ~roleValue;
  } else {
    tempRolemask.value |= roleValue;
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
      description: `Status for ${props.user.email} has been updated to ${getStatusName(tempStatus.value)}.`,
    });
    emit("loadUser");
  } catch (error: any) {
    toast.error("Failed to update status", {
      description: error.message,
    });
  }
}
</script>
