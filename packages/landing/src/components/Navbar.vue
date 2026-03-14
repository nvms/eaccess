<template>
  <NavigationMenu>
    <NavigationMenuList>
      <NavigationMenuItem>
        <NavigationMenuTrigger>Getting started</NavigationMenuTrigger>
        <NavigationMenuContent>
          <div class="grid grid-cols-3 gap-2 w-[700px]">
            <div class="w-full h-full bg-neutral-100 rounded p-2 row-span-3">
              hi
            </div>
            <NavigationMenuLink class="block p-4 hover:bg-accent rounded-md transition cursor-default">
              <div class="text-foreground font-medium">Quick Start</div>
              <div class="text-muted-foreground text-sm">Get up and running in minutes</div>
            </NavigationMenuLink>
            <NavigationMenuLink class="block p-4 hover:bg-accent rounded-md transition cursor-default">
              <div class="text-foreground font-medium">Installation</div>
              <div class="text-muted-foreground text-sm">Add eaccess to your project</div>
            </NavigationMenuLink>
            <NavigationMenuLink class="block p-4 hover:bg-accent rounded-md transition cursor-default">
              <div class="text-foreground font-medium">Configuration</div>
              <div class="text-muted-foreground text-sm">Configure providers and settings</div>
            </NavigationMenuLink>
            <NavigationMenuLink class="block p-4 hover:bg-accent rounded-md transition cursor-default">
              <div class="text-foreground font-medium">Examples</div>
              <div class="text-muted-foreground text-sm">See real-world implementations</div>
            </NavigationMenuLink>
            <NavigationMenuLink class="block p-4 hover:bg-accent rounded-md transition cursor-default">
              <div class="text-foreground font-medium">Middleware</div>
              <div class="text-muted-foreground text-sm">Protect your routes and APIs</div>
            </NavigationMenuLink>
            <NavigationMenuLink class="block p-4 hover:bg-accent rounded-md transition cursor-default">
              <div class="text-foreground font-medium">TypeScript</div>
              <div class="text-muted-foreground text-sm">Full type safety and intellisense</div>
            </NavigationMenuLink>
          </div>
        </NavigationMenuContent>
      </NavigationMenuItem>
      <NavigationMenuItem>
        <NavigationMenuTrigger>Atoms</NavigationMenuTrigger>
        <NavigationMenuContent>
          <div class="grid grid-cols-1 gap-2 w-[300px]">
            <NavigationMenuLink class="block p-4 hover:bg-accent rounded-md transition cursor-default">
              <div class="text-foreground font-medium">Login Component</div>
              <div class="text-muted-foreground text-sm">Drop-in authentication forms</div>
            </NavigationMenuLink>
            <NavigationMenuLink class="block p-4 hover:bg-accent rounded-md transition cursor-default">
              <div class="text-foreground font-medium">Session Provider</div>
              <div class="text-muted-foreground text-sm">Manage user sessions globally</div>
            </NavigationMenuLink>
            <NavigationMenuLink class="block p-4 hover:bg-accent rounded-md transition cursor-default">
              <div class="text-foreground font-medium">Auth Guards</div>
              <div class="text-muted-foreground text-sm">Protect components and routes</div>
            </NavigationMenuLink>
          </div>
        </NavigationMenuContent>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
</template>

<script setup lang="ts">
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from "@/components/ui/navigation-menu";
</script>
