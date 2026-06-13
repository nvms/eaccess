<template>
  <div class="divide-y rounded-lg border bg-card">
    <section class="flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <h3 class="text-sm font-medium">Force sign-out</h3>
        <p class="mt-0.5 text-xs text-muted-foreground">Immediately sign the user out of all sessions on all devices.</p>
      </div>
      <Dialog v-model:open="showForceLogoutDialog">
        <DialogTrigger as-child>
          <Button variant="outline" size="sm" class="shrink-0"> Force sign-out </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Force sign-out</DialogTitle>
            <DialogDescription> Are you sure you want to force sign-out {{ user?.email }}? They will be signed out of all sessions. </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" @click="showForceLogoutDialog = false">Cancel</Button>
            <Button @click="forceLogout">Force sign-out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>

    <section class="flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <h3 class="text-sm font-medium text-destructive">Delete user</h3>
        <p class="mt-0.5 text-xs text-muted-foreground">Permanently delete this account and all associated data. This cannot be undone.</p>
      </div>
      <Dialog v-model:open="showDeleteUserDialog">
        <DialogTrigger as-child>
          <Button variant="destructive" size="sm" class="shrink-0"> Delete </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription> Are you sure you want to delete {{ user?.email }}? This action cannot be undone and will permanently remove all user data. </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" @click="showDeleteUserDialog = false">Cancel</Button>
            <Button variant="destructive" @click="deleteUser">Delete user</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useUsersStore, type User } from "@/stores/users";
import { toast } from "vue-sonner";

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
      toast.error("You have signed yourself out", {
        description: "Redirecting to the sign-in page...",
      });
      await router.push("/login");
    } else {
      toast.success("User signed out", {
        description: `${props.user.email} has been signed out of all sessions.`,
      });
    }
  } catch (error: any) {
    toast.error("Force sign-out failed", {
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
      description: `${props.user.email} has been deleted.`,
    });
    await router.push("/users");
  } catch (error: any) {
    toast.error("Delete user failed", {
      description: error.message,
    });
  }
}
</script>
