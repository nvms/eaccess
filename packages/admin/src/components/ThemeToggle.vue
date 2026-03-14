<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { ref, onMounted } from "vue";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const currentTheme = ref<"light" | "dark" | "auto">("auto");

const getSystemTheme = () => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

const applyTheme = (theme: "light" | "dark" | "auto") => {
  const root = document.documentElement;

  if (theme === "auto") {
    const systemTheme = getSystemTheme();
    root.classList.toggle("dark", systemTheme === "dark");
  } else {
    root.classList.toggle("dark", theme === "dark");
  }

  localStorage.setItem("easyaccess-theme", theme);
  currentTheme.value = theme;
};

const switchTheme = (newTheme: "light" | "dark" | "auto") => {
  if (!document.startViewTransition) {
    applyTheme(newTheme);
    return;
  }

  // Add class to identify this as a theme transition
  document.documentElement.classList.add('theme-transition');
  
  document.startViewTransition(() => {
    applyTheme(newTheme);
  }).finished.finally(() => {
    document.documentElement.classList.remove('theme-transition');
  });
};

onMounted(() => {
  const savedTheme = localStorage.getItem("easyaccess-theme") as "light" | "dark" | "auto" | null;
  const theme = savedTheme || "auto";
  applyTheme(theme);

  // Listen for system theme changes when in auto mode
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", () => {
    if (currentTheme.value === "auto") {
      applyTheme("auto");
    }
  });
});
</script>

<template>
  <div>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="outline" class="rounded-full" size="icon">
          <Icon icon="radix-icons:moon" class="h-[1.2rem] w-[1.2rem] rotate-0 opacity-100 transition-all dark:-rotate-90 dark:opacity-0 duration-500" />
          <Icon icon="radix-icons:sun" class="absolute h-[1.2rem] w-[1.2rem] rotate-90 opacity-0 transition-all dark:rotate-0 dark:opacity-100 duration-500" />
          <span class="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem @click="switchTheme('light')"> Light </DropdownMenuItem>
        <DropdownMenuItem @click="switchTheme('dark')"> Dark </DropdownMenuItem>
        <DropdownMenuItem @click="switchTheme('auto')"> System </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<style>
:root {
  --expo-out: linear(0 0%, 0.1684 2.66%, 0.3165 5.49%, 0.446 8.52%, 0.5581 11.78%, 0.6535 15.29%, 0.7341 19.11%, 0.8011 23.3%, 0.8557 27.93%, 0.8962 32.68%, 0.9283 38.01%, 0.9529 44.08%, 0.9711 51.14%, 0.9833 59.06%, 0.9915 68.74%, 1 100%);
}

.theme-transition::view-transition-group(root) {
  animation-duration: 0.7s;
  animation-timing-function: var(--expo-out);
}

.theme-transition::view-transition-new(root) {
  animation-name: reveal-light;
}

.theme-transition::view-transition-old(root),
.theme-transition.dark::view-transition-old(root) {
  animation: none;
  z-index: -1;
}

.theme-transition.dark::view-transition-new(root) {
  animation-name: reveal-dark;
}

@keyframes reveal-dark {
  from {
    clip-path: polygon(50% -71%, -50% 71%, -50% 71%, 50% -71%);
  }
  to {
    clip-path: polygon(50% -71%, -50% 71%, 50% 171%, 171% 50%);
  }
}

@keyframes reveal-light {
  from {
    clip-path: polygon(171% 50%, 50% 171%, 50% 171%, 171% 50%);
  }
  to {
    clip-path: polygon(171% 50%, 50% 171%, -50% 71%, 50% -71%);
  }
}
</style>
