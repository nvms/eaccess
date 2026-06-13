import { AuthStatus } from "@/stores/users";

const statusNames: Record<number, string> = {
  [AuthStatus.Normal]: "Normal",
  [AuthStatus.Archived]: "Archived",
  [AuthStatus.Banned]: "Banned",
  [AuthStatus.Locked]: "Locked",
  [AuthStatus.PendingReview]: "Pending review",
  [AuthStatus.Suspended]: "Suspended",
};

const statusDots: Record<number, string> = {
  [AuthStatus.Normal]: "bg-emerald-500",
  [AuthStatus.Archived]: "bg-neutral-400",
  [AuthStatus.Banned]: "bg-red-500",
  [AuthStatus.Locked]: "bg-orange-400",
  [AuthStatus.PendingReview]: "bg-amber-400",
  [AuthStatus.Suspended]: "bg-purple-400",
};

export function getStatusName(status: number): string {
  return statusNames[status] ?? "Unknown";
}

export function getStatusDotClass(status: number): string {
  return statusDots[status] ?? "bg-neutral-400";
}

const mfaMechanismNames: Record<number, string> = {
  1: "Authenticator app",
  2: "Email",
  3: "SMS",
};

export function getMfaMechanismName(mechanism: number): string {
  return mfaMechanismNames[mechanism] ?? "Unknown";
}

const providerNames: Record<string, string> = {
  email_password: "Email & password",
  github: "GitHub",
  google: "Google",
  azure: "Azure",
};

export function getProviderName(provider: string): string {
  return providerNames[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatTimeAgo(dateString: string, now: Date = new Date()): string {
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
