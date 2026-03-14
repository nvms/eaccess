import { defineStore } from "pinia";
import { ref } from "vue";

export const useAuthStore = defineStore("auth", () => {
  const isLoggedIn = ref(false);
  const isLoading = ref(false);
  const userEmail = ref("");

  async function checkAuthStatus() {
    try {
      const response = await fetch("/admin/api/auth-status", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        isLoggedIn.value = data.isLoggedIn;
        if (data.isLoggedIn) {
          userEmail.value = data.email || "";
        }
        return data.isLoggedIn;
      }
    } catch (error) {
      isLoggedIn.value = false;
    }
    return false;
  }

  async function login(email: string, password: string, remember = false) {
    isLoading.value = true;
    try {
      const response = await fetch("/admin/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, remember }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Login failed");
      }

      // Check auth status after successful login
      await checkAuthStatus();
      return true;
    } finally {
      isLoading.value = false;
    }
  }

  async function logout() {
    try {
      // Call logout API
      await fetch("/admin/api/logout", {
        method: "POST",
        credentials: "include",
      });

      // Check auth status to update local state properly
      await checkAuthStatus();
    } catch (error) {
      console.error("Logout failed:", error);
      // Even if API call fails, clear local state
      isLoggedIn.value = false;
      userEmail.value = "";
    }
  }

  return {
    isLoggedIn,
    isLoading,
    userEmail,
    login,
    logout,
    checkAuthStatus,
  };
});
