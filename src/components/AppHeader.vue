<script setup lang="ts">
import { ref } from "vue";
import AppIcon from "./AppIcon.vue";
import BrandMark from "./BrandMark.vue";
import GlobalSearch from "./GlobalSearch.vue";
import { useTheme } from "@/composables/useTheme";

const open = ref(false);
const { theme, cycleTheme } = useTheme();
const networkName = (import.meta.env.VITE_TOS_NETWORK || "mainnet").toUpperCase();
const navigation = [
  { to: "/blocks", label: "Blocks" },
  { to: "/transactions", label: "Transactions" },
  { to: "/agents", label: "Agents" },
  { to: "/tasks", label: "Tasks" },
  { to: "/services", label: "Services" },
  { to: "/network", label: "Network" },
];
</script>

<template>
  <header class="app-header">
    <div class="header-inner">
      <BrandMark />
      <div class="header-search"><GlobalSearch /></div>
      <nav class="desktop-nav" aria-label="Primary navigation">
        <RouterLink v-for="item in navigation" :key="item.to" :to="item.to">{{ item.label }}</RouterLink>
      </nav>
      <div class="header-actions">
        <span class="network-chip"><i></i>{{ networkName }}</span>
        <button class="icon-button" type="button" :title="`Theme: ${theme}`" :aria-label="`Change theme. Current: ${theme}`" @click="cycleTheme">
          <AppIcon name="sun" />
        </button>
        <button class="icon-button mobile-menu-button" type="button" aria-label="Toggle navigation" :aria-expanded="open" @click="open = !open">
          <AppIcon :name="open ? 'close' : 'menu'" />
        </button>
      </div>
    </div>
    <div v-if="open" class="mobile-panel">
      <GlobalSearch />
      <nav aria-label="Mobile navigation">
        <RouterLink v-for="item in navigation" :key="item.to" :to="item.to" @click="open = false">{{ item.label }}</RouterLink>
      </nav>
    </div>
  </header>
</template>
