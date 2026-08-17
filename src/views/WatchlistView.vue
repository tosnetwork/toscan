<script setup lang="ts">
import { ref } from "vue";
import AppIcon from "@/components/AppIcon.vue";
import PageHeading from "@/components/PageHeading.vue";
import { getAccount, getIndexedAsset, getIndexedContract, getNominatorPoolDetail, getValidatorDetail } from "@/api/explorer";
import { useWatchlist, type WatchEntry } from "@/composables/useWatchlist";
import { compact, formatDate } from "@/utils/format";

const watchlist = useWatchlist();
const checking = ref(false);
const errors = ref<Record<string, string>>({});

async function fingerprint(item: WatchEntry): Promise<string> {
  if (item.kind === "address") {
    const data = await getAccount(item.identity);
    return JSON.stringify([data.info.balance, data.info.state, data.info.last_transaction_id]);
  }
  if (item.kind === "asset") {
    const data = await getIndexedAsset(item.identity);
    return JSON.stringify(data && [data.updated_at, data.holder_count, data.data]);
  }
  if (item.kind === "validator") {
    const data = await getValidatorDetail(item.identity);
    return JSON.stringify([data.currently_selected, data.selected_for_next_set, data.current.weight, data.latest_observed_mc_seqno]);
  }
  if (item.kind === "pool") {
    const data = await getNominatorPoolDetail(item.identity);
    return JSON.stringify([data.pool.updated_at, data.pool.status, data.pool.data.total_balance_at_risk, data.pool.data.nominators_count]);
  }
  const kind = ({ agent: "agent_account", task: "task_escrow", service: "service_actor", dispute: "dispute" } as const)[item.kind as "agent" | "task" | "service" | "dispute"];
  const data = await getIndexedContract(kind, item.identity);
  return JSON.stringify(data && [data.updated_at, data.status, data.data]);
}

async function refreshAll(): Promise<void> {
  checking.value = true;
  errors.value = {};
  await Promise.all(watchlist.items.value.map(async (item) => {
    try {
      watchlist.observe(item.key, await fingerprint(item));
    } catch (error) {
      errors.value[item.key] = error instanceof Error ? error.message : "Unable to refresh";
    }
  }));
  checking.value = false;
}
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Watchlist" description="Private browser-local monitoring for the TOS identities you care about." eyebrow="Personal tools">
      <div class="heading-actions"><button class="button button--secondary" type="button" :disabled="checking || !watchlist.items.value.length" @click="refreshAll"><AppIcon name="refresh" :size="16" />{{ checking ? 'Checking…' : 'Check for changes' }}</button><button v-if="watchlist.unreadCount.value" class="button button--secondary" type="button" @click="watchlist.markAllRead">Mark all read</button></div>
    </PageHeading>
    <section class="surface page-surface">
      <div class="table-caption"><span>Watched identities</span><span>{{ watchlist.unreadCount.value }} changed</span></div>
      <div class="evidence-list">
        <article v-for="item in watchlist.items.value" :key="item.key" class="evidence-row watch-row" :class="{ 'watch-row--unread': item.unread }">
          <span class="watch-state"><i></i>{{ item.unread ? 'Changed' : 'Quiet' }}</span>
          <span><RouterLink class="detail-link" :to="item.route" @click="watchlist.markRead(item.key)"><strong>{{ item.label }}</strong></RouterLink><small>{{ item.kind }} · {{ compact(item.identity, 13, 10) }}</small></span>
          <span><small>Last checked</small><strong>{{ item.checkedAt ? formatDate(Math.floor(item.checkedAt / 1000)) : 'Not checked yet' }}</strong></span>
          <span><small>Added</small><strong>{{ formatDate(Math.floor(item.createdAt / 1000)) }}</strong></span>
          <button class="button button--secondary" type="button" @click="watchlist.remove(item.key)">Remove</button>
          <p v-if="errors[item.key]" class="watch-error">{{ errors[item.key] }}</p>
        </article>
        <div v-if="!watchlist.items.value.length" class="empty-state"><strong>Nothing watched yet</strong><span>Open an address, asset, validator, pool or Agent Economy identity and choose Watch.</span></div>
      </div>
    </section>
    <aside class="truth-note"><strong>Private by construction</strong><p>The watchlist, fingerprints and change markers stay in this browser. Refresh compares current evidence only; it does not create an account, send a notification off device or submit a chain transaction.</p></aside>
  </div>
</template>
