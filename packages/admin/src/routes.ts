import { createRouter, createWebHistory } from "vue-router";
import LoginForm from "./components/LoginForm.vue";
import { useAuthStore } from "./stores/auth";
import UserManagement from "./components/views/UserManagement.vue";
import UserEdit from "./components/views/UserEdit.vue";
import Activity from "./components/views/Activity.vue";
import Overview from "./components/views/Overview.vue";

const routes = [
  {
    path: "/login",
    name: "login",
    component: LoginForm,
    meta: { requiresGuest: true },
  },
  {
    path: "/",
    name: "home",
    redirect: "/overview",
    meta: { requiresAuth: true },
  },
  {
    path: "/overview",
    name: "overview",
    component: Overview,
    meta: { requiresAuth: true },
  },
  {
    path: "/users",
    name: "users",
    component: UserManagement,
    meta: { requiresAuth: true },
  },
  {
    path: "/users/edit/:id",
    name: "user-edit",
    component: UserEdit,
    meta: { requiresAuth: true },
    props: true,
  },
  {
    path: "/activity",
    name: "activity",
    component: Activity,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory("/admin/"),
  routes,
});

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();
  const isAuthenticated = await authStore.checkAuthStatus();

  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: "login", query: { redirect: to.fullPath } });
    return;
  }

  if (to.meta.requiresGuest && isAuthenticated) {
    next({ name: "home" });
    return;
  }

  next();
});

export default router;
