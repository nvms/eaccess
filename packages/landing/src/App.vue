<template>
  <div class="bg-neutral-100">
    <div class="container mx-auto p-4 flex items-center">
        <img src="./assets/shield2.svg" alt="Shield" class="shield w-6 invert mr-12" />
        <Navbar />
    </div>
    <div class="min-h-[400px] container mx-auto p-12"></div>
    <div class="bg-background">hello</div>
  </div>
</template>

<script setup lang="ts">
import Navbar from "./components/Navbar.vue";
</script>

<style scoped></style>

having the LLM be able to understand relationships between entities, when those entities and their relationships are defined in many places across a vast corpus of documents, would be hugely beneficial I would think