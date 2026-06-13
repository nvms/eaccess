<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { useColorMode } from "@vueuse/core";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const mode = useColorMode({ storageKey: "easyaccess-theme" });

const switchTheme = (newTheme: "light" | "dark" | "auto") => {
  if (!document.startViewTransition) {
    mode.value = newTheme;
    return;
  }

  document.documentElement.classList.add("theme-transition");

  document
    .startViewTransition(() => {
      mode.value = newTheme;
    })
    .finished.finally(() => {
      document.documentElement.classList.remove("theme-transition");
    });
};
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-foreground">
        <Icon icon="radix-icons:moon" class="size-4 rotate-0 opacity-100 transition-all duration-500 dark:-rotate-90 dark:opacity-0" />
        <Icon icon="radix-icons:sun" class="absolute size-4 rotate-90 opacity-0 transition-all duration-500 dark:rotate-0 dark:opacity-100" />
        <span class="sr-only">Toggle theme</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem @select="switchTheme('light')"> Light </DropdownMenuItem>
      <DropdownMenuItem @select="switchTheme('dark')"> Dark </DropdownMenuItem>
      <DropdownMenuItem @select="switchTheme('auto')"> System </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
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
