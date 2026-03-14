<template>
  <div class="space-y-4">
    <div class="p-2 border rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
      <h3 class="text-lg mb-2 flex items-center justify-between">
        <span>Status</span>
        <Icon icon="tabler:auth-2fa" class="h-6 w-6 text-neutral-500" />
      </h3>
      <!-- MFA Status Overview -->
      <div class="flex items-center gap-3 p-3 rounded-lg border shadow-xs" :class="mfaEnabled ? 'bg-green-50 dark:bg-green-950/40 border-green-400 dark:border-green-800' : 'bg-background '">
        <div class="flex-shrink-0">
          <div class="w-8 h-8 rounded-full flex items-center justify-center" :class="mfaEnabled ? 'bg-green-200 dark:bg-green-900/60' : 'bg-neutral-200 dark:bg-neutral-800/60'">
            <Icon :icon="mfaEnabled ? 'mdi:shield-check' : 'mdi:shield-off'" :class="mfaEnabled ? 'text-green-600 dark:text-green-400' : 'text-neutral-500 dark:text-neutral-400'" class="w-5 h-5" />
          </div>
        </div>
        <div class="flex-1">
          <div class="font-medium" :class="mfaEnabled ? 'text-green-900 dark:text-green-100' : 'text-neutral-900 dark:text-neutral-100'">
            {{ mfaEnabled ? "Enabled" : "Disabled" }}
          </div>
          <div class="text-xs" :class="mfaEnabled ? 'text-green-700 dark:text-green-300' : 'text-neutral-600 dark:text-neutral-400'">
            {{ mfaEnabled ? `${enabledMethodsCount} method${enabledMethodsCount === 1 ? "" : "s"} active` : "No methods configured" }}
          </div>
        </div>
      </div>
    </div>

    <!-- Active Methods -->
    <div v-if="mfaMethods && mfaMethods.length > 0" class="p-2 border rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
      <h3 class="text-lg mb-2 flex items-center justify-between">
        <span>Active Methods</span>
        <Icon icon="mdi:shield-check" class="h-6 w-6 text-neutral-500" />
      </h3>
      <div class="space-y-2">
        <!-- TOTP Method -->
        <div v-if="totpMethod" class="p-3 border rounded-lg space-y-3 bg-background shadow-xs">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
              <Icon icon="mdi:shield-key" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div class="flex-1">
              <div class="font-medium">Authenticator App (TOTP)</div>
              <div class="text-xs text-muted-foreground">
                Set up {{ formatDate(totpMethod.created_at) }}
                <span v-if="totpMethod.last_used_at"> · Last used {{ formatDate(totpMethod.last_used_at) }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center px-2 py-1 text-xs rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"> Active </span>
            </div>
          </div>

          <!-- Backup Codes Info -->
          <div v-if="totpMethod.backup_codes" class="flex items-center justify-between p-2 rounded bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
            <div class="flex items-center gap-2">
              <Icon icon="mdi:key-variant" class="w-4 h-4 text-muted-foreground" />
              <span class="text-sm">Backup codes remaining</span>
            </div>
            <span class="text-sm font-medium">{{ totpMethod.backup_codes.length }}</span>
          </div>

          <!-- QR Code -->
          <div v-if="existingTotpQrCode" class="text-center space-y-3">
            <div class="p-0 bg-white border rounded-lg inline-block overflow-hidden">
              <img :src="existingTotpQrCode" alt="TOTP QR Code" class="w-64 h-64" />
            </div>

            <!-- TOTP Test Input -->
            <div class="space-y-2">
              <div class="text-sm font-medium">Test TOTP Code</div>
              <div class="flex justify-center">
                <PinInput v-model="totpTestValue" placeholder="○" :disabled="isTesting" @complete="testTotp" class="gap-2">
                  <PinInputGroup>
                    <PinInputSlot v-for="index in 6" :key="index" :index="index - 1" class="w-8 h-10 text-center border" />
                  </PinInputGroup>
                </PinInput>
              </div>
              <div class="text-xs text-muted-foreground">Enter code from your authenticator app</div>
            </div>
          </div>

          <!-- Current Backup Codes -->
          <div v-if="currentBackupCodes.length > 0" class="space-y-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-base font-medium">Backup codes</span>
              </div>
              <div class="flex items-center gap-1">
                <Button variant="outline" size="sm" @click="copyAllBackupCodes">
                  <Icon icon="mdi:content-copy" class="w-3 h-3" />
                  Copy All
                </Button>
                <Button variant="outline" size="sm" @click="hideBackupCodes">
                  <Icon icon="mdi:eye-off" class="w-3 h-3" />
                  Hide
                </Button>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div
                v-for="(code, index) in currentBackupCodes"
                :key="index"
                class="flex items-center justify-between p-2 bg-background border rounded cursor-pointer hover:bg-muted transition-colors"
                @click="copyToClipboard(code, `Backup code ${index + 1}`)"
              >
                <span class="font-mono text-sm">{{ code }}</span>
                <Icon icon="mdi:content-copy" class="w-3 h-3 text-muted-foreground hover:text-foreground" />
              </div>
            </div>
            <div class="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/40 p-2 rounded">
              <Icon icon="mdi:information" class="w-3 h-3 inline mr-1" />
              Securely share these codes with {{ user.email }}. Each code can only be used once.
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" @click="resetBackupCodes(totpMethod.id)" :disabled="isLoading">
              <Icon icon="mdi:refresh" class="w-4 h-4" />
              Reset Backup Codes
            </Button>
            <Button variant="outline" size="sm" @click="disableMethod(totpMethod.id, 'TOTP')" :disabled="isLoading">
              <Icon icon="mdi:shield-remove" class="w-4 h-4" />
              Disable
            </Button>
          </div>
        </div>

        <!-- Email Method -->
        <div v-if="emailMethod" class="p-3 border rounded-lg space-y-3 bg-background shadow-xs">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center">
              <Icon icon="mdi:email-outline" class="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div class="flex-1">
              <div class="font-medium">Email Authentication</div>
              <div class="text-xs text-muted-foreground">
                {{ maskEmail(emailMethod.secret) }}
                <span v-if="emailMethod.last_used_at"> · Last used {{ formatDate(emailMethod.last_used_at) }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center px-2 py-1 text-xs rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"> Active </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" @click="disableMethod(emailMethod.id, 'Email')" :disabled="isLoading">
              <Icon icon="mdi:shield-remove" class="w-4 h-4" />
              Disable
            </Button>
          </div>
        </div>

        <!-- SMS Method -->
        <div v-if="smsMethod" class="p-3 border rounded-lg space-y-3 bg-background shadow-xs">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center">
              <Icon icon="mdi:message-text-outline" class="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div class="flex-1">
              <div class="font-medium">SMS Authentication</div>
              <div class="text-xs text-muted-foreground">
                {{ maskPhone(smsMethod.secret) }}
                <span v-if="smsMethod.last_used_at"> · Last used {{ formatDate(smsMethod.last_used_at) }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center px-2 py-1 text-xs rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"> Active </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" @click="disableMethod(smsMethod.id, 'SMS')" :disabled="isLoading">
              <Icon icon="mdi:shield-remove" class="w-4 h-4" />
              Disable
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Usage Statistics (if available) -->
    <div v-if="mfaStats" class="p-2 border rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
      <h3 class="text-lg mb-2 flex items-center justify-between">
        <span>Recent Activity</span>
        <Icon icon="mdi:chart-line" class="h-6 w-6 text-neutral-500" />
      </h3>
      <div class="grid grid-cols-3 gap-4">
        <div class="p-3 rounded-lg text-center border bg-background shadow-xs">
          <div class="text-lg">{{ mfaStats.verifications || 0 }}</div>
          <div class="text-xs text-muted-foreground">Successful verifications</div>
        </div>
        <div class="p-3 rounded-lg text-center border bg-background shadow-xs">
          <div class="text-lg">{{ mfaStats.failures || 0 }}</div>
          <div class="text-xs text-muted-foreground">Failed attempts</div>
        </div>
        <div v-if="totpMethod && mfaStats.backupCodesUsed !== undefined" class="p-3 rounded-lg text-center border bg-background shadow-xs">
          <div class="text-lg">{{ mfaStats.backupCodesUsed || 0 }}</div>
          <div class="text-xs text-muted-foreground">Backup codes used</div>
        </div>
      </div>
    </div>

    <!-- Enable Methods Section -->
    <div v-if="!mfaEnabled || canEnableMore" class="p-2 border rounded-xl bg-neutral-100 dark:bg-neutral-950 [box-shadow:inset_0_0_0_3px_white] dark:[box-shadow:inset_0_0_0_3px_black]">
      <h3 class="text-lg mb-2 flex items-center justify-between">
        <span>Enable Methods</span>
        <Icon icon="mdi:shield-plus" class="h-6 w-6 text-neutral-500" />
      </h3>

      <div class="grid gap-3">
        <!-- Enable TOTP -->
        <div v-if="!totpMethod" class="flex items-center justify-between p-3 border rounded-lg bg-background shadow-xs">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-blue-100 dark:bg-blue-950/40 rounded-full flex items-center justify-center">
              <Icon icon="mdi:shield-key" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div class="font-medium">Authenticator App (TOTP)</div>
              <div class="text-xs text-muted-foreground">Use Google Authenticator, Authy, or similar</div>
            </div>
          </div>
          <Button @click="enableTotp" :disabled="isLoading" variant="outline">
            {{ isLoading ? "Enabling..." : "Enable" }}
          </Button>
        </div>

        <!-- Enable Email -->
        <div v-if="!emailMethod" class="flex items-center justify-between p-3 border rounded-lg bg-background shadow-xs">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-amber-100 dark:bg-amber-950/40 rounded-full flex items-center justify-center">
              <Icon icon="mdi:email-outline" class="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div class="font-medium">Email Authentication</div>
              <div class="text-xs text-muted-foreground">Send codes to {{ user.email }}</div>
            </div>
          </div>
          <Button @click="enableEmail" :disabled="isLoading" variant="outline">
            {{ isLoading ? "Enabling..." : "Enable" }}
          </Button>
        </div>

        <!-- Enable SMS -->
        <div v-if="!smsMethod" class="flex items-center justify-between p-3 border rounded-lg bg-background shadow-xs">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-purple-100 dark:bg-purple-950/40 rounded-full flex items-center justify-center">
              <Icon icon="mdi:message-text-outline" class="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div class="font-medium">SMS Authentication</div>
              <div class="text-xs text-muted-foreground">Send codes via text message</div>
            </div>
          </div>
          <Button @click="showSmsDialog = true" :disabled="isLoading" variant="outline"> Enable </Button>
        </div>
      </div>
    </div>

    <!-- No Methods State -->
    <div v-if="!mfaEnabled && !canEnableMore" class="text-center py-6 text-muted-foreground">
      <Icon icon="mdi:shield-off" class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <div class="text-sm">This user has not set up multi-factor authentication</div>
    </div>
  </div>

  <!-- Disable Method Confirmation Dialog -->
  <Dialog v-model:open="showDisableDialog">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Disable {{ methodToDisable?.type }} Authentication</DialogTitle>
        <DialogDescription> Are you sure you want to disable {{ methodToDisable?.type }} authentication for {{ user.email }}? This action cannot be undone and the user will need to set up this method again. </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="secondary" @click="showDisableDialog = false">Cancel</Button>
        <Button variant="destructive" @click="confirmDisableMethod" :disabled="isLoading">
          {{ isLoading ? "Disabling..." : "Disable Method" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- SMS Setup Dialog -->
  <Dialog v-model:open="showSmsDialog">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Enable SMS Authentication</DialogTitle>
        <DialogDescription> Enter a phone number to enable SMS-based two-factor authentication for {{ user.email }}. </DialogDescription>
      </DialogHeader>
      <div class="space-y-4 py-4">
        <SPhoneInput v-model="phoneNumber" :disabled="isLoading" />
      </div>
      <DialogFooter>
        <Button variant="secondary" @click="showSmsDialog = false">Cancel</Button>
        <Button @click="enableSms" :disabled="!phoneNumber || isLoading">
          {{ isLoading ? "Enabling..." : "Enable SMS 2FA" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- TOTP Setup Results Dialog -->
  <Dialog v-model:open="showTotpResultDialog">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>TOTP Authentication Enabled</DialogTitle>
        <DialogDescription> Save this information securely and share it with {{ user.email }}. </DialogDescription>
      </DialogHeader>
      <div v-if="totpSetupResult" class="space-y-6 py-4">
        <!-- QR Code -->
        <div class="text-center space-y-2">
          <div class="p-2 bg-background inline-block">
            <div v-if="qrCodeDataUrl" class="justify-center bg-white inline-block rounded overflow-hidden">
              <img :src="qrCodeDataUrl" alt="TOTP QR Code" class="w-48 h-48" />
            </div>
            <div v-else class="text-xs font-mono break-all p-2 border bg-muted rounded">
              {{ totpSetupResult.qrCode }}
            </div>
            <div class="text-xs text-neutral-500 mt-2">Scan with authenticator app or use manual entry secret below</div>
          </div>
        </div>

        <!-- Secret -->
        <div class="space-y-2">
          <h4 class="font-medium">Secret</h4>
          <div class="p-2 bg-muted rounded font-mono text-sm break-all">
            {{ totpSetupResult.secret }}
          </div>
        </div>

        <!-- Backup Codes -->
        <div class="space-y-3 p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <!-- <Icon icon="mdi:key-variant" class="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> -->
              <span class="text-base font-medium">Backup codes</span>
            </div>
            <Button variant="outline" size="sm" @click="copyAllBackupCodes">
              <Icon icon="mdi:content-copy" class="w-3 h-3" />
              Copy All
            </Button>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div v-for="code in totpSetupResult.backupCodes" :key="code" class="p-2 bg-background border rounded">
              <span class="font-mono text-sm">{{ code }}</span>
            </div>
          </div>
          <div class="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/40 p-2 rounded">
            <Icon icon="mdi:information" class="w-3 h-3 inline mr-1" />
            Save these codes in a secure location and share them with {{ user.email }}. Each code can only be used once.
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button @click="showTotpResultDialog = false">Done</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@iconify/vue";
import { useUsersStore, type User, type MfaMethod, type MfaStats } from "@/stores/users";
import { toast } from "vue-sonner";
import QRCode from "qrcode";
import { PinInput, PinInputGroup, PinInputSlot } from "@/components/ui/pin-input";
import SPhoneInput from "./SPhoneInput.vue";

const props = defineProps<{
  user: User;
}>();

const emit = defineEmits<{
  refresh: [];
}>();

const usersStore = useUsersStore();
const isLoading = ref(false);
const showDisableDialog = ref(false);
const methodToDisable = ref<{ id: number; type: string } | null>(null);

const mfaMethods = ref<MfaMethod[]>([]);
const mfaStats = ref<MfaStats | null>(null);

// Enable MFA dialogs and data
const showSmsDialog = ref(false);
const showTotpResultDialog = ref(false);
const phoneNumber = ref("");
const totpSetupResult = ref<{ secret: string; qrCode: string; backupCodes: string[] } | null>(null);
const qrCodeDataUrl = ref<string | null>(null);
const existingTotpQrCode = ref<string | null>(null);
const currentBackupCodes = ref<string[]>([]);
const totpTestValue = ref<string[]>([]);
const isTesting = ref(false);

const mfaEnabled = computed(() => mfaMethods.value.some((method) => method.verified));
const enabledMethodsCount = computed(() => mfaMethods.value.filter((method) => method.verified).length);
const canEnableMore = computed(() => {
  const activeMechanisms = new Set(mfaMethods.value.filter((m) => m.verified).map((m) => m.mechanism));
  return activeMechanisms.size < 3; // Can enable more if not all 3 mechanisms are active
});

const totpMethod = computed(() => mfaMethods.value.find((method) => method.mechanism === 1 && method.verified));
const emailMethod = computed(() => mfaMethods.value.find((method) => method.mechanism === 2 && method.verified));
const smsMethod = computed(() => mfaMethods.value.find((method) => method.mechanism === 3 && method.verified));

onMounted(async () => {
  await loadMfaData();
});

// Watch for user prop changes to reload MFA data
watch(
  () => props.user.id,
  async (newUserId, oldUserId) => {
    if (newUserId !== oldUserId) {
      await loadMfaData();
    }
  },
  { immediate: false },
);

async function loadMfaData() {
  try {
    mfaMethods.value = await usersStore.getUserMfaMethods(props.user.id);
    mfaStats.value = await usersStore.getUserMfaStats(props.user.id);

    // Generate QR code for existing TOTP method
    const totpMethod = mfaMethods.value.find((method) => method.mechanism === 1 && method.verified);
    if (totpMethod && totpMethod.qrCodeUri) {
      await generateExistingTotpQrCode(totpMethod.qrCodeUri);
    } else {
      existingTotpQrCode.value = null;
    }
  } catch (error) {
    console.error("Failed to load MFA data:", error);
    // Don't show error toast for stats since it might not be available
    mfaMethods.value = [];
    mfaStats.value = null;
    existingTotpQrCode.value = null;
  }
}

async function enableTotp() {
  isLoading.value = true;
  try {
    const result = await usersStore.enableUserTotp(props.user.id);
    totpSetupResult.value = result;
    currentBackupCodes.value = result.backupCodes;

    // Generate QR code
    await generateQRCode(result.qrCode);

    // showTotpResultDialog.value = true;

    toast.success("TOTP authentication enabled", {
      description: `Authenticator app 2FA has been set up for ${props.user.email}.`,
    });

    await loadMfaData();
    emit("refresh");
  } catch (error: any) {
    toast.error("Failed to enable TOTP", {
      description: error.message,
    });
  } finally {
    isLoading.value = false;
  }
}

async function enableEmail() {
  isLoading.value = true;
  try {
    await usersStore.enableUserEmail2fa(props.user.id);

    toast.success("Email authentication enabled", {
      description: `Email 2FA has been enabled for ${props.user.email}.`,
    });

    await loadMfaData();
    emit("refresh");
  } catch (error: any) {
    toast.error("Failed to enable Email 2FA", {
      description: error.message,
    });
  } finally {
    isLoading.value = false;
  }
}

async function enableSms() {
  if (!phoneNumber.value) return;

  isLoading.value = true;
  try {
    await usersStore.enableUserSms2fa(props.user.id, phoneNumber.value);

    toast.success("SMS authentication enabled", {
      description: `SMS 2FA has been enabled for ${props.user.email} at ${phoneNumber.value}.`,
    });

    showSmsDialog.value = false;
    phoneNumber.value = "";
    await loadMfaData();
    emit("refresh");
  } catch (error: any) {
    toast.error("Failed to enable SMS 2FA", {
      description: error.message,
    });
  } finally {
    isLoading.value = false;
  }
}

function disableMethod(methodId: number, type: string) {
  methodToDisable.value = { id: methodId, type };
  showDisableDialog.value = true;
}

async function confirmDisableMethod() {
  if (!methodToDisable.value) return;

  isLoading.value = true;
  try {
    await usersStore.disableUserMfaMethod(props.user.id, methodToDisable.value.id);

    // Clear backup codes if TOTP is being disabled
    if (methodToDisable.value.type === "TOTP") {
      currentBackupCodes.value = [];
    }

    toast.success(`${methodToDisable.value.type} authentication disabled`, {
      description: `${methodToDisable.value.type} has been disabled for ${props.user.email}.`,
    });

    showDisableDialog.value = false;
    methodToDisable.value = null;
    await loadMfaData();
    emit("refresh");
  } catch (error: any) {
    toast.error("Failed to disable method", {
      description: error.message,
    });
  } finally {
    isLoading.value = false;
  }
}

async function resetBackupCodes(methodId: number) {
  isLoading.value = true;
  try {
    const newCodes = await usersStore.resetUserBackupCodes(props.user.id, methodId);
    currentBackupCodes.value = newCodes;

    toast.success("Backup codes reset", {
      description: `${newCodes.length} new backup codes generated and displayed below.`,
    });

    await loadMfaData();
    emit("refresh");
  } catch (error: any) {
    toast.error("Failed to reset backup codes", {
      description: error.message,
    });
  } finally {
    isLoading.value = false;
  }
}

function formatDate(dateString: string | null) {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleString();
}

function maskEmail(email: string | null): string {
  if (!email) return "";
  const [username, domain] = email.split("@");
  if (username.length <= 2) {
    return `${username[0]}***@${domain}`;
  }
  return `${username[0]}${"*".repeat(username.length - 2)}${username[username.length - 1]}@${domain}`;
}

function maskPhone(phone: string | null): string {
  if (!phone) return "";
  if (phone.length < 4) {
    return phone.replace(/./g, "*");
  }

  // Show first digit and last 2 digits: +1234567890 -> +1*****90
  if (phone.startsWith("+")) {
    return phone[0] + phone[1] + "*".repeat(phone.length - 3) + phone.slice(-2);
  }

  // For regular numbers: 1234567890 -> 1*****90
  return phone[0] + "*".repeat(phone.length - 3) + phone.slice(-2);
}

async function generateQRCode(uri: string): Promise<void> {
  try {
    const dataUrl = await QRCode.toDataURL(uri);
    qrCodeDataUrl.value = dataUrl;
  } catch (error) {
    console.error("Failed to generate QR code:", error);
    qrCodeDataUrl.value = null;
  }
}

async function generateExistingTotpQrCode(uri: string): Promise<void> {
  try {
    const dataUrl = await QRCode.toDataURL(uri);
    existingTotpQrCode.value = dataUrl;
  } catch (error) {
    console.error("Failed to generate existing TOTP QR code:", error);
    existingTotpQrCode.value = null;
  }
}

async function copyToClipboard(text: string, description: string = "Text") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${description} copied to clipboard`);
  } catch (error) {
    toast.error(`Failed to copy ${description.toLowerCase()}`);
  }
}

function copyAllBackupCodes() {
  // Use current backup codes if available, otherwise use dialog result codes
  const codes = currentBackupCodes.value.length > 0 ? currentBackupCodes.value : totpSetupResult.value?.backupCodes || [];

  const codesText = codes.join("\n");
  copyToClipboard(codesText, "All backup codes");
}

function hideBackupCodes() {
  currentBackupCodes.value = [];
}

async function testTotp(code: string[]) {
  const codeString = code.join("");
  if (codeString.length !== 6) return;

  isTesting.value = true;
  try {
    const response = await fetch(`/admin/api/users/${props.user.id}/test-totp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: codeString }),
      credentials: "include",
    });

    if (response.ok) {
      toast.success("TOTP verification successful!", {
        description: "The authenticator app is working correctly.",
      });
    } else {
      const error = await response.json();
      toast.error("TOTP verification failed", {
        description: error.error || "Invalid code. Please try again.",
      });
    }

    // Clear the input
    totpTestValue.value = [];
  } catch (error: any) {
    toast.error("TOTP test failed", {
      description: "Failed to test TOTP code.",
    });
    totpTestValue.value = [];
  } finally {
    isTesting.value = false;
  }
}
</script>
