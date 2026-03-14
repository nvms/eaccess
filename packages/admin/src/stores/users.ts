import { defineStore } from "pinia";
import { ref } from "vue";

export interface Provider {
  provider: string;
  provider_name: string | null;
}

export interface Token {
  expires: string;
}

export interface MfaMethod {
  id: number;
  mechanism: number;
  secret: string | null;
  backup_codes: string[] | null;
  verified: boolean;
  created_at: string;
  last_used_at: string | null;
  qrCodeUri?: string;
}

export interface MfaStats {
  verifications: number;
  failures: number;
  backupCodesUsed: number;
}

export interface User {
  id: number;
  user_id: string;
  email: string;
  verified: boolean;
  status: number;
  rolemask: number;
  last_login: string | null;
  registered: string;
  resettable: boolean;
  providers: Provider[];
  confirmation_tokens: Token[];
  reset_tokens: Token[];
  remember_tokens: Token[];
  mfa_methods?: MfaMethod[];
}

export type RoleMap = Record<string, number>;

export const AuthStatus = {
  Normal: 0,
  Archived: 1,
  Banned: 2,
  Locked: 3,
  PendingReview: 4,
  Suspended: 5,
} as const;

export const useUsersStore = defineStore("users", () => {
  const users = ref<User[]>([]);
  const roles = ref<RoleMap>({});
  const isLoading = ref(false);
  const currentPage = ref(1);
  const totalUsers = ref(0);
  const totalPages = ref(0);
  const pageSize = ref(50);

  async function loadRoles() {
    const response = await fetch("/admin/api/roles", { credentials: "include" });
    if (response.ok) {
      roles.value = await response.json();
    }
  }

  async function loadUsers(filters?: { roles?: number[]; mfa?: boolean; status?: number[]; providers?: string[]; page?: number; limit?: number }) {
    isLoading.value = true;
    try {
      const params = new URLSearchParams();

      if (filters) {
        if (filters.roles && filters.roles.length > 0) {
          params.append("roles", filters.roles.join(","));
        }
        if (filters.mfa !== undefined) {
          params.append("mfa", filters.mfa ? "enabled" : "disabled");
        }
        if (filters.status && filters.status.length > 0) {
          params.append("status", filters.status.join(","));
        }
        if (filters.providers && filters.providers.length > 0) {
          params.append("providers", filters.providers.join(","));
        }
      }

      params.append("page", String(filters?.page || currentPage.value));
      params.append("limit", String(filters?.limit || pageSize.value));

      const response = await fetch(`/admin/api/users?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load users");
      }

      const data = await response.json();
      users.value = data.users;
      totalUsers.value = data.total;
      totalPages.value = data.pages;
      currentPage.value = data.page;
      pageSize.value = data.limit;
    } finally {
      isLoading.value = false;
    }
  }

  function goToPage(page: number) {
    currentPage.value = page;
    loadUsers();
  }

  async function updateUserStatus(userId: number, status: number) {
    const response = await fetch(`/admin/api/users/${userId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to update user status");
    }

    // Update local state
    const user = users.value.find((u) => u.id === userId);
    if (user) {
      user.status = status;
    }
  }

  async function updateUserRoles(userId: number, rolemask: number) {
    const response = await fetch(`/admin/api/users/${userId}/roles`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rolemask }),
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to update user roles");
    }

    // Update local state
    const user = users.value.find((u) => u.id === userId);
    if (user) {
      user.rolemask = rolemask;
    }
  }

  async function forceLogoutUser(userId: number) {
    const response = await fetch(`/admin/api/users/${userId}/logout`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to force logout user");
    }

    const result = await response.json();
    return result;
  }

  async function deleteUser(userId: number) {
    const response = await fetch(`/admin/api/users/${userId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to delete user");
    }

    // Remove from local state
    users.value = users.value.filter((u) => u.id !== userId);
  }

  function getRoleNames(rolemask: number): string[] {
    const result: string[] = [];
    Object.entries(roles.value).forEach(([name, value]) => {
      if (rolemask & value) {
        result.push(name);
      }
    });
    return result;
  }

  function getStatusName(status: number): string {
    const statusEntry = Object.entries(AuthStatus).find(([, value]) => value === status);
    return statusEntry ? statusEntry[0] : "Unknown";
  }

  async function changeUserPassword(userId: number, password: string) {
    const response = await fetch(`/admin/api/users/${userId}/password`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to change password");
    }
  }

  async function createUser(email: string, password: string) {
    const response = await fetch("/admin/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create user");
    }

    const result = await response.json();

    // Reload users to get the updated list
    await loadUsers();

    return result.user;
  }

  async function updateUserId(userId: number, user_id: string) {
    const response = await fetch(`/admin/api/users/${userId}/user-id`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id }),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update user ID");
    }

    // Update local state
    const user = users.value.find((u) => u.id === userId);
    if (user) {
      user.user_id = user_id;
    }
  }

  async function getUserMfaMethods(userId: number): Promise<MfaMethod[]> {
    const response = await fetch(`/admin/api/users/${userId}/mfa-methods`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to load MFA methods");
    }

    const result = await response.json();
    return result.methods || [];
  }

  async function getUserMfaStats(userId: number): Promise<MfaStats | null> {
    const response = await fetch(`/admin/api/users/${userId}/mfa-stats`, {
      credentials: "include",
    });

    if (!response.ok) {
      // Stats might not be available, return null instead of throwing
      return null;
    }

    const result = await response.json();
    return result.stats || null;
  }

  async function disableUserMfaMethod(userId: number, methodId: number) {
    const response = await fetch(`/admin/api/users/${userId}/mfa-methods/${methodId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to disable MFA method");
    }
  }

  async function resetUserBackupCodes(userId: number, methodId: number): Promise<string[]> {
    const response = await fetch(`/admin/api/users/${userId}/mfa-methods/${methodId}/backup-codes`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to reset backup codes");
    }

    const result = await response.json();
    return result.backupCodes || [];
  }

  async function enableUserTotp(userId: number): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    const response = await fetch(`/admin/api/users/${userId}/mfa-methods/totp`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to enable TOTP");
    }

    const result = await response.json();
    return {
      secret: result.secret,
      qrCode: result.qrCode,
      backupCodes: result.backupCodes,
    };
  }

  async function enableUserEmail2fa(userId: number, email?: string): Promise<void> {
    const response = await fetch(`/admin/api/users/${userId}/mfa-methods/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to enable Email 2FA");
    }
  }

  async function enableUserSms2fa(userId: number, phoneNumber: string): Promise<void> {
    const response = await fetch(`/admin/api/users/${userId}/mfa-methods/sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phoneNumber }),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to enable SMS 2FA");
    }
  }

  async function searchUsers(query: string): Promise<User[]> {
    const response = await fetch(`/admin/api/users/search?q=${encodeURIComponent(query)}`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to search users");
    }

    const data = await response.json();
    return data;
  }

  return {
    users,
    isLoading,
    currentPage,
    totalUsers,
    totalPages,
    pageSize,
    loadUsers,
    loadRoles,
    goToPage,
    updateUserStatus,
    updateUserRoles,
    forceLogoutUser,
    deleteUser,
    changeUserPassword,
    createUser,
    updateUserId,
    getUserMfaMethods,
    getUserMfaStats,
    disableUserMfaMethod,
    resetUserBackupCodes,
    enableUserTotp,
    enableUserEmail2fa,
    enableUserSms2fa,
    searchUsers,
    getRoleNames,
    getStatusName,
    roles,
    AuthStatus,
  };
});
