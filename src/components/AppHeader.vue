<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "./AppIcon.vue";
import BrandMark from "./BrandMark.vue";
import GlobalSearch from "./GlobalSearch.vue";
import { useTheme } from "@/composables/useTheme";
import { useLocale, type Locale } from "@/i18n";

type NavigationItem = {
  to: string;
  label: string;
  description: string;
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

const open = ref(false);
const activeMenu = ref<string | null>(null);
const route = useRoute();
const { theme, cycleTheme } = useTheme();
const { locale, locales, setLocale, t } = useLocale();
const networkName = (import.meta.env.VITE_TOS_NETWORK || "mainnet").toUpperCase();
const isHome = computed(() => route.name === "home");

const navigation: NavigationGroup[] = [
  {
    label: "Blockchain",
    items: [
      { to: "/blocks", label: "Blocks", description: "Finalized masterchain and shard blocks" },
      { to: "/transactions", label: "Transactions", description: "Account changes and message execution" },
      { to: "/contracts/verified", label: "Verified contracts", description: "Reproducible source and deployed-code matches" },
      { to: "/network", label: "Network", description: "Chain tip, finality and index health" },
    ],
  },
  {
    label: "Assets",
    items: [
      { to: "/assets", label: "Assets", description: "Jettons, NFTs and verified positions" },
      { to: "/assets/activity", label: "Asset activity", description: "Ownership-position observations" },
      { to: "/domains", label: ".tos domains", description: "Auctions, leases and record history" },
    ],
  },
  {
    label: "Agent Economy",
    items: [
      { to: "/economy", label: "Economy", description: "Autonomous work and settlement overview" },
      { to: "/agents", label: "Agents", description: "Agent accounts and spending boundaries" },
      { to: "/tasks", label: "Tasks", description: "Escrow-backed work on TOS Network" },
      { to: "/services", label: "Services", description: "Callable and payable service actors" },
      { to: "/disputes", label: "Disputes", description: "Evidence and on-chain rulings" },
    ],
  },
  {
    label: "Consensus",
    items: [
      { to: "/validators", label: "Validators", description: "Current and upcoming validator sets" },
      { to: "/staking", label: "Staking", description: "Elector rewards and Nominator Pools" },
      { to: "/governance", label: "Governance", description: "Proof-backed protocol parameters" },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/analytics", label: "Analytics", description: "Chain-derived activity and fee trends" },
      { to: "/watchlist", label: "Watchlist", description: "Private monitoring in this browser" },
      { to: "/network", label: "Network status", description: "Source availability and projection lag" },
      { to: "/api-docs", label: "Explorer API", description: "Public read-only endpoint reference" },
      { to: "/diagnostics", label: "Diagnostics", description: "Private browser health records" },
    ],
  },
];

function groupActive(group: NavigationGroup): boolean {
  return group.items.some((item) => route.path === item.to || route.path.startsWith(`${item.to}/`));
}

function closeMenus(): void {
  activeMenu.value = null;
}

function toggleMenu(label: string): void {
  activeMenu.value = activeMenu.value === label ? null : label;
}

watch(() => route.fullPath, () => {
  open.value = false;
  closeMenus();
}, { flush: "sync" });
</script>

<template>
  <header class="app-header" @keydown.esc="closeMenus">
    <div class="utility-bar">
      <div class="utility-inner">
        <div class="utility-network">
          <span class="network-chip"><i></i>{{ networkName }}</span>
          <RouterLink to="/network">{{ t('Live network') }}</RouterLink>
          <span class="utility-divider" aria-hidden="true"></span>
          <span>{{ t('Read-only chain evidence') }}</span>
        </div>
        <div class="utility-actions">
          <div v-if="!isHome" class="header-search"><GlobalSearch /></div>
          <label class="locale-picker"><span class="sr-only">Language</span><select :value="locale" aria-label="Language" @change="setLocale(($event.target as HTMLSelectElement).value as Locale)"><option v-for="item in locales" :key="item" :value="item">{{ item === 'en' ? 'EN' : item === 'zh-CN' ? '中文' : '日本語' }}</option></select></label>
          <button class="icon-button" type="button" :title="`Theme: ${theme}`" :aria-label="`Change theme. Current: ${theme}`" @click="cycleTheme">
            <AppIcon name="sun" />
          </button>
        </div>
      </div>
    </div>

    <div class="header-inner">
      <BrandMark />
      <nav class="desktop-nav" aria-label="Primary navigation">
        <RouterLink class="nav-home" to="/">{{ t('Home') }}</RouterLink>
        <div v-for="group in navigation" :key="group.label" class="nav-dropdown" :class="{ 'nav-dropdown--active': groupActive(group), 'nav-dropdown--wide': group.items.length > 3, 'nav-dropdown--open': activeMenu === group.label }">
          <button type="button" aria-haspopup="true" :aria-expanded="activeMenu === group.label" @click="toggleMenu(group.label)">
            <span>{{ t(group.label) }}</span>
            <AppIcon name="chevron" :size="13" />
          </button>
          <div class="nav-dropdown-panel">
            <RouterLink v-for="item in group.items" :key="item.to + item.label" :to="item.to">
              <span>{{ t(item.label) }}</span>
              <small>{{ t(item.description) }}</small>
            </RouterLink>
          </div>
        </div>
      </nav>
      <button class="icon-button mobile-menu-button" type="button" aria-label="Toggle navigation" :aria-expanded="open" @click="open = !open">
        <AppIcon :name="open ? 'close' : 'menu'" />
      </button>
    </div>

    <div v-if="open" class="mobile-panel">
      <GlobalSearch />
      <nav aria-label="Mobile navigation">
        <RouterLink class="mobile-home" to="/" @click="open = false">{{ t('Home') }}</RouterLink>
        <section v-for="group in navigation" :key="group.label">
          <h2>{{ t(group.label) }}</h2>
          <RouterLink v-for="item in group.items" :key="item.to + item.label" :to="item.to" @click="open = false">{{ t(item.label) }}</RouterLink>
        </section>
      </nav>
    </div>
  </header>
</template>
