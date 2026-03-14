<template>
  <div class="p-2 border rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
    <h3 class="text-lg mb-2 flex items-center justify-between">
      <span>User actions</span>
      <Icon icon="mdi:account-cog" class="h-6 w-6 text-neutral-500" />
    </h3>
    <div class="space-y-3">
      <div class="bg-background p-3 border rounded shadow-xs">
        <div class="text-sm text-neutral-500 mb-2">Force the user to log out of all sessions on all devices immediately.</div>
        <Dialog v-model:open="showForceLogoutDialog">
          <DialogTrigger as-child>
            <Button variant="outline" @click="showForceLogoutDialog = true" class="cursor-pointer"> Force logout </Button>
          </DialogTrigger>
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Force logout user</DialogTitle>
              <DialogDescription> Are you sure you want to force logout {{ user?.email }}? They will be logged out of all sessions. </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" @click="showForceLogoutDialog = false" class="cursor-pointer">Cancel</Button>
              <Button @click="forceLogout" class="cursor-pointer">Force Logout</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div class="bg-background p-3 border rounded shadow-xs">
        <div class="text-sm text-neutral-500 mb-2">Permanently delete the user account and all associated data. This action cannot be undone.</div>
        <Dialog v-model:open="showDeleteUserDialog">
          <DialogTrigger as-child>
            <Button variant="destructive" @click="showDeleteUserDialog = true" class="cursor-pointer"> Delete </Button>
          </DialogTrigger>
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete user</DialogTitle>
              <DialogDescription> Are you sure you want to delete {{ user?.email }}? This action cannot be undone and will permanently remove all user data. </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" @click="showDeleteUserDialog = false" class="cursor-pointer">Cancel</Button>
              <Button variant="destructive" @click="deleteUser" class="cursor-pointer">Delete User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useUsersStore, type User } from "@/stores/users";
import { toast } from "vue-sonner";
import { Icon } from "@iconify/vue";

const props = defineProps<{
  user: User;
}>();

const router = useRouter();
const usersStore = useUsersStore();

const showForceLogoutDialog = ref(false);
const showDeleteUserDialog = ref(false);

async function forceLogout() {
  if (!props.user) return;

  showForceLogoutDialog.value = false;

  try {
    const result = await usersStore.forceLogoutUser(props.user.id);
    if (result.selfLogout) {
      toast.error("You have logged yourself out!", {
        description: "Redirecting to login page...",
      });
      await router.push("/login");
    } else {
      toast.success("User logged out", {
        description: `${props.user.email} has been logged out successfully.`,
      });
    }
  } catch (error: any) {
    toast.error("Force logout failed", {
      description: error.message,
    });
  }
}

async function deleteUser() {
  if (!props.user) return;

  showDeleteUserDialog.value = false;

  try {
    await usersStore.deleteUser(props.user.id);
    toast.success("User deleted", {
      description: `${props.user.email} has been deleted successfully.`,
    });
    await router.push("/users");
  } catch (error: any) {
    toast.error("Delete user failed", {
      description: error.message,
    });
  }
}
</script>
