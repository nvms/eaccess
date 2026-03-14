<template>
  <Dialog v-model:open="showCreateUserDialog">
    <DialogTrigger as-child>
      <Button @click="showCreateUserDialog = true" variant="outline" size="sm">
        <Plus class="h-4 w-4" />
        Create User
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Create New User</DialogTitle>
        <DialogDescription> Create a new user with email and password authentication. </DialogDescription>
      </DialogHeader>
      <div class="space-y-4">
        <div class="space-y-2">
          <label for="email" class="text-sm font-medium">Email</label>
          <Input id="email" v-model="newUserEmail" type="email" placeholder="user@example.com" :disabled="isCreatingUser" @keyup.enter="createUser" />
        </div>
        <div class="space-y-2">
          <label for="password" class="text-sm font-medium">Password</label>
          <Input id="password" v-model="newUserPassword" type="password" placeholder="Password (min 8 characters)" :disabled="isCreatingUser" @keyup.enter="createUser" />
        </div>
        <div class="space-y-2">
          <label for="confirmPassword" class="text-sm font-medium">Confirm Password</label>
          <Input id="confirmPassword" v-model="confirmPassword" type="password" placeholder="Confirm password" :disabled="isCreatingUser" @keyup.enter="createUser" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="secondary" @click="cancelCreateUser" :disabled="isCreatingUser"> Cancel </Button>
        <Button @click="createUser" :disabled="!canCreateUser || isCreatingUser">
          {{ isCreatingUser ? "Creating..." : "Create User" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script lang="ts" setup>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-vue-next";
import { useUsersStore } from "@/stores/users";
import { toast } from "vue-sonner";

const router = useRouter();
const usersStore = useUsersStore();

// Create user dialog state
const showCreateUserDialog = ref(false);
const newUserEmail = ref("");
const newUserPassword = ref("");
const confirmPassword = ref("");
const isCreatingUser = ref(false);

const canCreateUser = computed(() => {
  return newUserEmail.value && newUserPassword.value && confirmPassword.value && newUserPassword.value.length >= 8 && newUserPassword.value === confirmPassword.value;
});

async function createUser() {
  if (!canCreateUser.value) return;

  isCreatingUser.value = true;

  try {
    const newUser = await usersStore.createUser(newUserEmail.value, newUserPassword.value);
    toast.success("User created", {
      description: `User ${newUserEmail.value} has been created successfully.`,
    });
    cancelCreateUser();
    await router.push(`/users/edit/${newUser.id}`);
  } catch (error: any) {
    toast.error("Failed to create user", {
      description: error.message,
    });
  } finally {
    isCreatingUser.value = false;
  }
}

function cancelCreateUser() {
  showCreateUserDialog.value = false;
  newUserEmail.value = "";
  newUserPassword.value = "";
  confirmPassword.value = "";
}
</script>
