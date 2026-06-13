<template>
  <div class="min-h-screen">
    <AppNavbar />

    <main class="container mx-auto px-6 py-8">
      <header class="mb-6">
        <h1 class="text-xl font-semibold tracking-tight">Overview</h1>
        <p class="mt-1 text-sm text-muted-foreground">Accounts, authentication, and security at a glance.</p>
      </header>

      <section class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
        <div v-for="stat in headlineStats" :key="stat.label" class="bg-card px-5 py-4">
          <div class="text-sm text-muted-foreground">{{ stat.label }}</div>
          <div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {{ overviewStore.isLoading ? "–" : stat.value.toLocaleString() }}
          </div>
        </div>
      </section>

      <section class="mt-4 grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border bg-card p-5">
          <h2 class="text-sm font-medium">Authentication methods</h2>
          <p class="mt-0.5 text-xs text-muted-foreground">How accounts sign in</p>
          <div class="mt-4 space-y-1">
            <DistributionRow v-for="m in overviewStore.stats.authMethods" :key="m.method" :label="getProviderName(m.method)" :count="m.count" :max="maxCount(overviewStore.stats.authMethods)" />
            <p v-if="!overviewStore.isLoading && overviewStore.stats.authMethods.length === 0" class="text-sm text-muted-foreground">No authentication methods</p>
          </div>
        </div>

        <div class="rounded-lg border bg-card p-5">
          <h2 class="text-sm font-medium">Account status</h2>
          <p class="mt-0.5 text-xs text-muted-foreground">Distribution across statuses</p>
          <div class="mt-4 space-y-1">
            <DistributionRow v-for="s in overviewStore.stats.statusDistribution" :key="s.status" :label="getStatusName(s.status)" :count="s.count" :max="maxCount(overviewStore.stats.statusDistribution)" :dot="getStatusDotClass(s.status)" />
            <p v-if="!overviewStore.isLoading && overviewStore.stats.statusDistribution.length === 0" class="text-sm text-muted-foreground">No users</p>
          </div>
        </div>

        <div class="rounded-lg border bg-card p-5">
          <div class="flex items-baseline justify-between">
            <div>
              <h2 class="text-sm font-medium">Multi-factor authentication</h2>
              <p class="mt-0.5 text-xs text-muted-foreground">Verified methods by mechanism</p>
            </div>
            <div class="text-sm text-muted-foreground">
              <span class="font-medium tabular-nums text-foreground">{{ overviewStore.isLoading ? "–" : overviewStore.stats.mfaEnabledUsers.toLocaleString() }}</span>
              users enrolled
            </div>
          </div>
          <div class="mt-4 space-y-1">
            <DistributionRow v-for="m in overviewStore.stats.mfaDistribution" :key="m.mechanism" :label="getMfaMechanismName(m.mechanism)" :count="m.count" :max="maxCount(overviewStore.stats.mfaDistribution)" />
            <p v-if="!overviewStore.isLoading && overviewStore.stats.mfaDistribution.length === 0" class="text-sm text-muted-foreground">No MFA methods configured</p>
          </div>
        </div>

        <div class="rounded-lg border bg-card p-5">
          <h2 class="text-sm font-medium">Roles</h2>
          <p class="mt-0.5 text-xs text-muted-foreground">Users holding each role</p>
          <div class="mt-4 space-y-1">
            <DistributionRow v-for="r in overviewStore.stats.roleDistribution" :key="r.role" :label="r.role" :count="r.count" :max="maxCount(overviewStore.stats.roleDistribution)" />
            <p v-if="!overviewStore.isLoading && (overviewStore.stats.roleDistribution?.length ?? 0) === 0" class="text-sm text-muted-foreground">No roles configured</p>
          </div>
        </div>

        <div class="rounded-lg border bg-card p-5 md:col-span-2">
          <h2 class="text-sm font-medium">Pending tokens</h2>
          <p class="mt-0.5 text-xs text-muted-foreground">Unexpired tokens currently outstanding</p>
          <div class="mt-4 grid gap-4 sm:grid-cols-3">
            <div v-for="t in tokenStats" :key="t.label" class="rounded-md border px-4 py-3">
              <div class="text-sm text-muted-foreground">{{ t.label }}</div>
              <div class="mt-1 text-lg font-semibold tracking-tight tabular-nums">
                {{ overviewStore.isLoading ? "–" : t.value.toLocaleString() }}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted } from "vue";
import AppNavbar from "../AppNavbar.vue";
import DistributionRow from "../DistributionRow.vue";
import { useOverviewStore } from "@/stores/overview";
import { getMfaMechanismName, getProviderName, getStatusDotClass, getStatusName } from "@/lib/display";

const overviewStore = useOverviewStore();

onMounted(async () => {
  await overviewStore.loadStats();
});

const headlineStats = computed(() => [
  { label: "Total users", value: overviewStore.stats.totalUsers },
  { label: "Active (24h)", value: overviewStore.stats.activeUsers24h },
  { label: "Active (7d)", value: overviewStore.stats.activeUsers7d },
  { label: "Active (30d)", value: overviewStore.stats.activeUsers30d },
]);

const tokenStats = computed(() => [
  { label: "Email confirmations", value: overviewStore.stats.pendingConfirmations },
  { label: "Password resets", value: overviewStore.stats.pendingResets },
  { label: "Remember me", value: overviewStore.stats.activeRememberTokens },
]);

function maxCount(items: Array<{ count: number }>): number {
  return items.reduce((max, item) => Math.max(max, item.count), 0);
}
</script>
