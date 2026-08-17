<script setup lang="ts">
import AppHeader from "@/components/AppHeader.vue";
import DataModeBanner from "@/components/DataModeBanner.vue";
</script>

<template>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <AppHeader />
  <DataModeBanner />
  <main id="main-content" tabindex="-1">
    <RouterView />
  </main>
  <footer class="site-footer">
    <div class="container footer-inner">
      <div><strong>TOSCAN</strong><span>Open-source explorer for TOS Network</span></div>
      <nav aria-label="Footer navigation">
        <a href="https://tos.network" target="_blank" rel="noreferrer">TOS Network</a>
        <a href="https://github.com/tosnetwork/toscan" target="_blank" rel="noreferrer">Source</a>
        <RouterLink to="/network">Network status</RouterLink>
      </nav>
    </div>
  </footer>
</template>
