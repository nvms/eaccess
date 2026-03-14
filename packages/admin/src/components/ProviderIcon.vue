<template>
  <Icon :icon="getProviderIcon(provider)" :class="iconClass" />
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";

interface Props {
  provider: string;
  iconClass?: string;
}

withDefaults(defineProps<Props>(), {
  iconClass: "h-5 w-5",
});

function getProviderIcon(provider: string) {
  if (!provider) return "mdi:form-textbox-password";

  switch (provider.toLowerCase()) {
    case "github":
      return "mdi:github";
    case "google":
      return "gg:google";
    case "azure":
      return "teenyicons:azure-solid";
    default:
      return "mdi:account";
  }
}
</script>
