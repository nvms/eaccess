<template>
  <div class="space-y-4">
    <div class="divide-y rounded-lg border bg-card">
      <section class="flex items-center justify-between px-5 py-4">
        <div>
          <h3 class="text-sm font-medium">Multi-factor authentication</h3>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ mfaEnabled ? `${enabledMethodsCount} verified ${enabledMethodsCount === 1 ? "method" : "methods"}` : "No methods configured" }}
          </p>
        </div>
        <span class="flex items-center gap-2 text-sm">
          <span class="size-1.5 rounded-full" :class="mfaEnabled ? 'bg-emerald-500' : 'bg-neutral-400'" />
          {{ mfaEnabled ? "Enabled" : "Disabled" }}
        </span>
      </section>

      <!-- TOTP -->
      <section v-if="totpMethod" class="px-5 py-4">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <Icon icon="mdi:shield-key-outline" class="size-4 shrink-0 text-muted-foreground" />
            <div>
              <div class="text-sm font-medium">Authenticator app</div>
              <div class="text-xs text-muted-foreground">
                Set up {{ formatDate(totpMethod.created_at) }}
                <span v-if="totpMethod.last_used_at"> · Last used {{ formatDate(totpMethod.last_used_at) }}</span>
                <span v-if="totpMethod.backup_codes"> · {{ totpMethod.backup_codes.length }} backup {{ totpMethod.backup_codes.length === 1 ? "code" : "codes" }} remaining</span>
              </div>
            </div>
          </div>
          <div class="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" :disabled="isLoading" @click="resetBackupCodes(totpMethod.id)"> Reset backup codes </Button>
            <Button variant="outline" size="sm" :disabled="isLoading" @click="disableMethod(totpMethod.id, 'TOTP')"> Disable </Button>
          </div>
        </div>

        <div v-if="existingTotpQrCode" class="mt-4 flex flex-wrap items-start gap-6 pl-7">
          <div class="overflow-hidden rounded-md border bg-white p-2">
            <img :src="existingTotpQrCode" alt="TOTP QR code" class="size-36" />
          </div>
          <div>
            <div class="text-sm font-medium">Test a code</div>
            <p class="mt-0.5 text-xs text-muted-foreground">Enter a code from the authenticator app to verify it works.</p>
            <PinInput v-model="totpTestValue" placeholder="○" :disabled="isTesting" class="mt-3 gap-2" @complete="testTotp">
              <PinInputGroup>
                <PinInputSlot v-for="index in 6" :key="index" :index="index - 1" class="h-10 w-8 border text-center" />
              </PinInputGroup>
            </PinInput>
          </div>
        </div>

        <div v-if="currentBackupCodes.length > 0" class="mt-4 rounded-md border bg-muted/40 p-4 pl-4">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Backup codes</span>
            <div class="flex gap-2">
              <Button variant="outline" size="sm" @click="copyAllBackupCodes"> Copy all </Button>
              <Button variant="ghost" size="sm" @click="hideBackupCodes"> Hide </Button>
            </div>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button v-for="(code, index) in currentBackupCodes" :key="index" type="button" class="cursor-pointer rounded-md border bg-card px-2 py-1.5 text-left font-mono text-sm transition-colors hover:bg-accent" @click="copyToClipboard(code, `Backup code ${index + 1}`)">
              {{ code }}
            </button>
          </div>
          <p class="mt-3 text-xs text-muted-foreground">Securely share these codes with {{ user.email }}. Each code can only be used once.</p>
        </div>
      </section>

      <!-- Email -->
      <section v-if="emailMethod" class="flex items-center justify-between gap-4 px-5 py-4">
        <div class="flex items-center gap-3">
          <Icon icon="mdi:email-outline" class="size-4 shrink-0 text-muted-foreground" />
          <div>
            <div class="text-sm font-medium">Email</div>
            <div class="text-xs text-muted-foreground">
              {{ maskEmail(emailMethod.secret) }}
              <span v-if="emailMethod.last_used_at"> · Last used {{ formatDate(emailMethod.last_used_at) }}</span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" class="shrink-0" :disabled="isLoading" @click="disableMethod(emailMethod.id, 'Email')"> Disable </Button>
      </section>

      <!-- SMS -->
      <section v-if="smsMethod" class="flex items-center justify-between gap-4 px-5 py-4">
        <div class="flex items-center gap-3">
          <Icon icon="mdi:message-text-outline" class="size-4 shrink-0 text-muted-foreground" />
          <div>
            <div class="text-sm font-medium">SMS</div>
            <div class="text-xs text-muted-foreground">
              {{ maskPhone(smsMethod.secret) }}
              <span v-if="smsMethod.last_used_at"> · Last used {{ formatDate(smsMethod.last_used_at) }}</span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" class="shrink-0" :disabled="isLoading" @click="disableMethod(smsMethod.id, 'SMS')"> Disable </Button>
      </section>

      <section v-if="mfaStats" class="grid grid-cols-3 divide-x px-0 py-0">
        <div class="px-5 py-3">
          <div class="text-xs text-muted-foreground">Successful verifications</div>
          <div class="mt-0.5 text-sm font-medium tabular-nums">{{ mfaStats.verifications || 0 }}</div>
        </div>
        <div class="px-5 py-3">
          <div class="text-xs text-muted-foreground">Failed attempts</div>
          <div class="mt-0.5 text-sm font-medium tabular-nums">{{ mfaStats.failures || 0 }}</div>
        </div>
        <div class="px-5 py-3">
          <div class="text-xs text-muted-foreground">Backup codes used</div>
          <div class="mt-0.5 text-sm font-medium tabular-nums">{{ mfaStats.backupCodesUsed || 0 }}</div>
        </div>
      </section>
    </div>

    <div v-if="canEnableMore" class="divide-y rounded-lg border bg-card">
      <section class="px-5 py-4">
        <h3 class="text-sm font-medium">Enable a method</h3>
        <p class="mt-0.5 text-xs text-muted-foreground">Set up an additional verification method for this user.</p>
      </section>

      <section v-if="!totpMethod" class="flex items-center justify-between gap-4 px-5 py-4">
        <div class="flex items-center gap-3">
          <Icon icon="mdi:shield-key-outline" class="size-4 shrink-0 text-muted-foreground" />
          <div>
            <div class="text-sm font-medium">Authenticator app</div>
            <div class="text-xs text-muted-foreground">Google Authenticator, 1Password, or similar</div>
          </div>
        </div>
        <Button variant="outline" size="sm" class="shrink-0" :disabled="isLoading" @click="enableTotp">
          {{ isLoading ? "Enabling..." : "Enable" }}
        </Button>
      </section>

      <section v-if="!emailMethod" class="flex items-center justify-between gap-4 px-5 py-4">
        <div class="flex items-center gap-3">
          <Icon icon="mdi:email-outline" class="size-4 shrink-0 text-muted-foreground" />
          <div>
            <div class="text-sm font-medium">Email</div>
            <div class="text-xs text-muted-foreground">Send codes to {{ user.email }}</div>
          </div>
        </div>
        <Button variant="outline" size="sm" class="shrink-0" :disabled="isLoading" @click="enableEmail">
          {{ isLoading ? "Enabling..." : "Enable" }}
        </Button>
      </section>

      <section v-if="!smsMethod" class="flex items-center justify-between gap-4 px-5 py-4">
        <div class="flex items-center gap-3">
          <Icon icon="mdi:message-text-outline" class="size-4 shrink-0 text-muted-foreground" />
          <div>
            <div class="text-sm font-medium">SMS</div>
            <div class="text-xs text-muted-foreground">Send codes via text message</div>
          </div>
        </div>
        <Button variant="outline" size="sm" class="shrink-0" :disabled="isLoading" @click="showSmsDialog = true"> Enable </Button>
      </section>
    </div>
  </div>

  <!-- Disable Method Confirmation Dialog -->
  <Dialog v-model:open="showDisableDialog">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Disable {{ methodToDisable?.type }} authentication</DialogTitle>
        <DialogDescription> Are you sure you want to disable {{ methodToDisable?.type }} authentication for {{ user.email }}? This action cannot be undone and the user will need to set up this method again. </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="secondary" @click="showDisableDialog = false">Cancel</Button>
        <Button variant="destructive" :disabled="isLoading" @click="confirmDisableMethod">
          {{ isLoading ? "Disabling..." : "Disable method" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- SMS Setup Dialog -->
  <Dialog v-model:open="showSmsDialog">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Enable SMS authentication</DialogTitle>
        <DialogDescription> Enter a phone number to enable SMS-based two-factor authentication for {{ user.email }}. </DialogDescription>
      </DialogHeader>
      <div class="space-y-4 py-4">
        <SPhoneInput v-model="phoneNumber" :disabled="isLoading" />
      </div>
      <DialogFooter>
        <Button variant="secondary" @click="showSmsDialog = false">Cancel</Button>
        <Button :disabled="!phoneNumber || isLoading" @click="enableSms">
          {{ isLoading ? "Enabling..." : "Enable SMS 2FA" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- TOTP Setup Results Dialog -->
  <Dialog v-model:open="showTotpResultDialog">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>TOTP authentication enabled</DialogTitle>
        <DialogDescription> Save this information securely and share it with {{ user.email }}. </DialogDescription>
      </DialogHeader>
      <div v-if="totpSetupResult" class="space-y-6 py-4">
        <div class="text-center">
          <div v-if="qrCodeDataUrl" class="inline-block overflow-hidden rounded-md border bg-white p-2">
            <img :src="qrCodeDataUrl" alt="TOTP QR code" class="size-48" />
          </div>
          <div v-else class="break-all rounded-md border bg-muted p-2 font-mono text-xs">
            {{ totpSetupResult.qrCode }}
          </div>
          <div class="mt-2 text-xs text-muted-foreground">Scan with an authenticator app or use the secret below.</div>
        </div>

        <div>
          <h4 class="text-sm font-medium">Secret</h4>
          <div class="mt-2 break-all rounded-md bg-muted p-2 font-mono text-sm">
            {{ totpSetupResult.secret }}
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-medium">Backup codes</h4>
            <Button variant="outline" size="sm" @click="copyAllBackupCodes"> Copy all </Button>
          </div>
          <div class="mt-2 grid grid-cols-2 gap-2">
            <div v-for="code in totpSetupResult.backupCodes" :key="code" class="rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-sm">
              {{ code }}
            </div>
          </div>
          <p class="mt-2 text-xs text-muted-foreground">Save these codes in a secure location and share them with {{ user.email }}. Each code can only be used once.</p>
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
import { formatDate } from "@/lib/display";
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
  return activeMechanisms.size < 3;
});

const totpMethod = computed(() => mfaMethods.value.find((method) => method.mechanism === 1 && method.verified));
const emailMethod = computed(() => mfaMethods.value.find((method) => method.mechanism === 2 && method.verified));
const smsMethod = computed(() => mfaMethods.value.find((method) => method.mechanism === 3 && method.verified));

onMounted(async () => {
  await loadMfaData();
});

watch(
  () => props.user.id,
  async (newUserId, oldUserId) => {
    if (newUserId !== oldUserId) {
      currentBackupCodes.value = [];
      await loadMfaData();
    }
  },
);

async function loadMfaData() {
  try {
    mfaMethods.value = await usersStore.getUserMfaMethods(props.user.id);
    mfaStats.value = await usersStore.getUserMfaStats(props.user.id);

    const totp = mfaMethods.value.find((method) => method.mechanism === 1 && method.verified);
    if (totp && totp.qrCodeUri) {
      existingTotpQrCode.value = await generateQrDataUrl(totp.qrCodeUri);
    } else {
      existingTotpQrCode.value = null;
    }
  } catch (error) {
    console.error("Failed to load MFA data:", error);
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
    qrCodeDataUrl.value = await generateQrDataUrl(result.qrCode);

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

  if (phone.startsWith("+")) {
    return phone[0] + phone[1] + "*".repeat(phone.length - 3) + phone.slice(-2);
  }

  return phone[0] + "*".repeat(phone.length - 3) + phone.slice(-2);
}

async function generateQrDataUrl(uri: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(uri);
  } catch (error) {
    console.error("Failed to generate QR code:", error);
    return null;
  }
}

async function copyToClipboard(text: string, description: string = "Text") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${description} copied to clipboard`);
  } catch {
    toast.error(`Failed to copy ${description.toLowerCase()}`);
  }
}

function copyAllBackupCodes() {
  const codes = currentBackupCodes.value.length > 0 ? currentBackupCodes.value : (totpSetupResult.value?.backupCodes ?? []);
  copyToClipboard(codes.join("\n"), "All backup codes");
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
      toast.success("TOTP verification successful", {
        description: "The authenticator app is working correctly.",
      });
    } else {
      const error = await response.json();
      toast.error("TOTP verification failed", {
        description: error.error || "Invalid code. Please try again.",
      });
    }
  } catch {
    toast.error("TOTP test failed", {
      description: "Failed to test TOTP code.",
    });
  } finally {
    totpTestValue.value = [];
    isTesting.value = false;
  }
}
</script>
