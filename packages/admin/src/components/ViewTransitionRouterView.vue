<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const isTransitioning = ref(false);

const handleNavigation = (to: string) => {
  if (!document.startViewTransition) {
    router.push(to);
    return;
  }
  
  isTransitioning.value = true;
  document.startViewTransition(async () => {
    await router.push(to);
    isTransitioning.value = false;
  });
};

// Watch for programmatic route changes (like from guards)
watch(() => route.path, () => {
  isTransitioning.value = false;
});

// Make the navigation function available to child components
defineExpose({ handleNavigation });
</script>

<template>
  <router-view />
</template>

<style>
/* Default slide transition for routes */
::view-transition-old(root) {
  animation: slide-out 0.3s ease-in;
}

::view-transition-new(root) {
  animation: slide-in 0.3s ease-out;
}

@keyframes slide-out {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}

@keyframes slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
</style>