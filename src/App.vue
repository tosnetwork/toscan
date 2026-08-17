<script setup lang="ts">
import AppHeader from "@/components/AppHeader.vue";
import DataModeBanner from "@/components/DataModeBanner.vue";
import { useLocale } from "@/i18n";
const { t } = useLocale();
</script>

<template>
  <a class="skip-link" href="#main-content">{{ t('Skip to content') }}</a>
  <AppHeader />
  <DataModeBanner />
  <main id="main-content" tabindex="-1">
    <RouterView />
  </main>
  <footer class="site-footer">
    <div class="container footer-inner">
      <div><strong>TOSCAN</strong><span>{{ t('Open-source explorer for TOS Network') }}</span></div>
      <nav aria-label="Footer navigation">
        <a href="https://tos.network" target="_blank" rel="noreferrer">TOS Network</a>
        <a href="https://github.com/tosnetwork/toscan" target="_blank" rel="noreferrer">{{ t('Source') }}</a>
        <RouterLink to="/network">{{ t('Network status') }}</RouterLink>
      </nav>
    </div>
  </footer>
</template>
