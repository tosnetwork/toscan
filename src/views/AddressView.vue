<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "@/components/AppIcon.vue";
import CopyButton from "@/components/CopyButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import TransactionRows from "@/components/TransactionRows.vue";
import { getAccount, getAccountTransactionsPage } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatInteger, formatTos, timeAgo } from "@/utils/format";

type Tab = "activity" | "transactions" | "assets" | "authority" | "raw";
const route = useRoute();
const address = computed(() => String(route.params.address));
const tab = ref<Tab>("activity");
const transactionOffset = ref(0);
const transactionLimit = 50;
const { data, loading, error, refresh } = useAsyncData(() => getAccount(address.value), [address]);
const { data: transactionPage, loading: transactionsLoading, error: transactionsError, refresh: refreshTransactions } = useAsyncData(
  () => getAccountTransactionsPage(address.value, transactionOffset.value, transactionLimit),
  [address, transactionOffset],
);
</script>

<template>
  <div class="container page-container address-page">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><RouterLink to="/">Explorer</RouterLink><AppIcon name="chevron" :size="13" /><span>Address</span></nav>
    <PageHeading title="Address" description="Balance, activity, assets and delegated authority." eyebrow="Account">
      <span v-if="data" class="status-badge" :data-tone="data.info.state === 'active' ? 'positive' : 'neutral'">{{ data.info.state }}</span>
    </PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="surface account-card">
          <div class="account-identity"><span class="entity-glyph entity-glyph--account"><AppIcon name="wallet" :size="23" /></span><div><small>TOS account</small><p class="mono">{{ data.address }}</p></div><CopyButton :value="data.address" label="address" /></div>
          <div class="account-balance"><small>Balance</small><strong>{{ formatTos(data.info.balance) }} <em>TOS</em></strong><span>Synced {{ timeAgo(data.info.sync_utime) }}</span></div>
        </section>
        <section class="account-metrics">
          <div class="surface"><small>Account model</small><strong>{{ data.capability?.account_model ?? "Standard account" }}</strong><span>{{ data.capability?.wallet_type ?? data.info.state }}</span></div>
          <div class="surface"><small>Last transaction LT</small><strong class="mono">{{ compact(data.info.last_transaction_id.lt, 10, 5) }}</strong><span>{{ compact(data.info.last_transaction_id.hash) }}</span></div>
          <div class="surface"><small>Agent authorities</small><strong>{{ formatInteger(data.capability?.agent_count ?? data.agents.length) }}</strong><span>{{ data.capability?.supports_agents ? "Capability enabled" : "No agent extension" }}</span></div>
          <div class="surface"><small>Assets indexed</small><strong>{{ data.jettons.length + data.nfts.length }}</strong><span>{{ data.jettons.length }} jettons · {{ data.nfts.length }} NFTs</span></div>
        </section>
        <section class="surface account-details-card">
          <div class="tabs" role="tablist" aria-label="Address details">
            <button v-for="item in ([['activity', 'Wallet events'], ['transactions', 'Transactions'], ['assets', 'Assets'], ['authority', 'Authority'], ['raw', 'Raw state']] as const)" :key="item[0]" type="button" role="tab" :aria-selected="tab === item[0]" @click="tab = item[0]">{{ item[1] }}<span v-if="item[0] === 'activity'">{{ data.events.length }}</span><span v-else-if="item[0] === 'transactions'">{{ data.indexedTransactionTotal }}</span></button>
          </div>
          <div v-if="tab === 'activity'" class="event-list" role="tabpanel">
            <article v-for="event in data.events" :key="event.event_id" class="event-row">
              <span class="entity-glyph entity-glyph--transaction"><AppIcon name="transaction" :size="18" /></span>
              <div class="event-main"><strong>{{ event.transfers?.[0]?.comment || "Account transaction" }}</strong><span class="mono">{{ compact(event.hash, 11, 7) }}</span></div>
              <div v-if="event.transfers?.[0]" class="event-transfer"><StatusBadge :status="event.transfers[0].direction" /><strong>{{ event.transfers[0].direction === 'incoming' ? '+' : '−' }}{{ formatTos(event.transfers[0].amount) }} TOS</strong></div>
              <div class="event-time"><strong>{{ timeAgo(event.timestamp) }}</strong><small>Fee {{ formatTos(event.fee) }} TOS</small></div>
            </article>
            <p v-if="!data.events.length" class="inline-empty">No wallet-index events are available for this account.</p>
          </div>
          <div v-else-if="tab === 'transactions'" role="tabpanel">
            <LoadState :loading="transactionsLoading" :error="transactionsError" :empty="!transactionPage?.items.length" @retry="refreshTransactions">
              <TransactionRows v-if="transactionPage?.items.length" :transactions="transactionPage.items" />
            </LoadState>
            <PaginationBar v-if="transactionPage" :total="transactionPage.total" :offset="transactionPage.offset" :limit="transactionPage.limit" :complete="transactionPage.complete" @change="transactionOffset = $event" />
          </div>
          <div v-else-if="tab === 'assets'" class="tab-panel" role="tabpanel">
            <h2>Indexed assets</h2><p class="panel-copy">Ownership entries are state-verified by the node wallet index. Live token balances require the respective contract getter.</p>
            <div class="asset-grid">
              <article v-for="jetton in data.jettons" :key="jetton.jetton_wallet"><span class="asset-symbol">J</span><div><strong>Jetton position</strong><RouterLink class="mono" :to="{ name: 'token', params: { address: jetton.jetton_master }, query: { kind: 'jetton' } }">{{ compact(jetton.jetton_master) }}</RouterLink></div></article>
              <article v-for="nft in data.nfts" :key="nft.nft_item"><span class="asset-symbol asset-symbol--nft">N</span><div><strong>NFT item</strong><RouterLink class="mono" :to="{ name: 'token', params: { address: nft.nft_item }, query: { kind: 'nft' } }">{{ compact(nft.nft_item) }}</RouterLink></div></article>
            </div>
            <p v-if="!data.jettons.length && !data.nfts.length" class="inline-empty">No Jetton or NFT ownership entries are indexed.</p>
          </div>
          <div v-else-if="tab === 'authority'" class="tab-panel authority-panel" role="tabpanel">
            <div class="authority-header"><div><h2>Programmable authority</h2><p class="panel-copy">What this account has authorized agents and sessions to do.</p></div><StatusBadge :status="data.capability?.supports_agents ? 'active' : 'not enabled'" /></div>
            <dl v-if="data.capability" class="detail-list detail-list--columns">
              <div><dt>Authorization version</dt><dd>{{ data.capability.authorization_version }}</dd></div><div><dt>Revision</dt><dd>{{ data.capability.revision }}</dd></div>
              <div><dt>Delegations</dt><dd>{{ data.capability.delegation_count }}</dd></div><div><dt>Sessions</dt><dd>{{ data.capability.session_count }}</dd></div>
            </dl>
            <article v-for="(agent, index) in data.agents" :key="index" class="agent-authority">
              <span class="feature-icon"><AppIcon name="agent" :size="20" /></span><div><strong>Agent authority {{ index + 1 }}</strong><p>{{ agent.threshold_k }} of {{ agent.threshold_n }} principals required</p><div class="principal-list"><RouterLink v-for="principal in agent.principals" :key="principal" class="mono" :to="{ name: 'address', params: { address: principal } }">{{ compact(principal, 12, 9) }}</RouterLink></div></div><StatusBadge :status="agent.status" />
            </article>
            <p v-if="!data.capability && !data.agents.length" class="inline-empty">This account exposes no programmable-authority metadata.</p>
          </div>
          <div v-else class="tab-panel raw-panel" role="tabpanel">
            <h2>Raw account state</h2><dl class="detail-list"><div><dt>Synced at</dt><dd>{{ formatDate(data.info.sync_utime) }}</dd></div><div><dt>Block</dt><dd>{{ formatInteger(data.info.block_id.seqno) }}</dd></div></dl>
            <details><summary>Code BOC</summary><pre>{{ data.info.code || "No code" }}</pre></details><details><summary>Data BOC</summary><pre>{{ data.info.data || "No data" }}</pre></details>
          </div>
        </section>
      </template>
    </LoadState>
  </div>
</template>
