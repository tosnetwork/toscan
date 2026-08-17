<script setup lang="ts">
import AppHeader from "@/components/AppHeader.vue";
import AppIcon from "@/components/AppIcon.vue";
import BrandMark from "@/components/BrandMark.vue";
import DataModeBanner from "@/components/DataModeBanner.vue";
import { useLocale } from "@/i18n";
const { t } = useLocale();

function backToTop(): void {
  window.scrollTo({ top: 0, behavior: "smooth" });
}
</script>

<template>
  <a class="skip-link" href="#main-content">{{ t('Skip to content') }}</a>
  <AppHeader />
  <DataModeBanner />
  <main id="main-content" tabindex="-1">
    <RouterView />
  </main>
  <footer class="site-footer">
    <div class="container footer-shell">
      <div class="footer-utility">
        <div>
          <a href="https://github.com/tosnetwork/toscan" target="_blank" rel="noreferrer">GitHub <AppIcon name="arrow-up-right" :size="14" /></a>
          <a href="https://tos.network" target="_blank" rel="noreferrer">TOS Network <AppIcon name="arrow-up-right" :size="14" /></a>
        </div>
        <button type="button" @click="backToTop"><AppIcon class="footer-back-icon" name="chevron" :size="14" />{{ t('Back to top') }}</button>
      </div>

      <div class="footer-main">
        <section class="footer-brand">
          <BrandMark />
          <p>{{ t('Open-source explorer for TOS Network') }}. {{ t('Chain facts for people and autonomous agents.') }}</p>
          <span>{{ t('Read-only by design. Every claim stays inside the available evidence.') }}</span>
        </section>

        <nav aria-label="Explore TOS Network">
          <h2>{{ t('Chain data') }}</h2>
          <RouterLink to="/blocks">{{ t('Blocks') }}</RouterLink>
          <RouterLink to="/transactions">{{ t('Transactions') }}</RouterLink>
          <RouterLink to="/assets">{{ t('Assets') }}</RouterLink>
          <RouterLink to="/analytics">{{ t('Analytics') }}</RouterLink>
        </nav>

        <nav aria-label="Agent economy">
          <h2>{{ t('Agent Economy') }}</h2>
          <RouterLink to="/agents">{{ t('Agents') }}</RouterLink>
          <RouterLink to="/tasks">{{ t('Tasks') }}</RouterLink>
          <RouterLink to="/services">{{ t('Services') }}</RouterLink>
          <RouterLink to="/disputes">{{ t('Disputes') }}</RouterLink>
        </nav>

        <nav aria-label="Network and consensus">
          <h2>{{ t('Network & consensus') }}</h2>
          <RouterLink to="/network">{{ t('Network status') }}</RouterLink>
          <RouterLink to="/validators">{{ t('Validators') }}</RouterLink>
          <RouterLink to="/staking">{{ t('Staking') }}</RouterLink>
          <RouterLink to="/governance">{{ t('Governance') }}</RouterLink>
        </nav>
      </div>

      <div class="footer-bottom">
        <span>© 2026 TOS Network</span>
        <span>{{ t('Open source') }} · {{ t('Read only') }}</span>
      </div>
    </div>
  </footer>
</template>
