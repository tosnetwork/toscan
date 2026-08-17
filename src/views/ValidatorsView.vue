<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AppIcon from "@/components/AppIcon.vue";
import CopyButton from "@/components/CopyButton.vue";
import ExportButton from "@/components/ExportButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { getProjectedValidators } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatInteger, formatTos, ratioPercent } from "@/utils/format";
import {
  filterAndSortValidators,
  formatRemaining,
  validatorRoundProgress,
  validatorRouteKey,
  validatorRows,
  type ValidatorSort,
} from "@/utils/validators";

const { data, loading, error, refresh } = useAsyncData(getProjectedValidators, [], { refreshInterval: 12_000 });
const setKind = ref<"current" | "next">("current");
const query = ref("");
const sort = ref<ValidatorSort>("weight-desc");
const pageSize = ref(25);
const offset = ref(0);
const now = ref(Math.floor(Date.now() / 1_000));
let clock: ReturnType<typeof setInterval> | undefined;

onMounted(() => { clock = setInterval(() => { now.value = Math.floor(Date.now() / 1_000); }, 1_000); });
onBeforeUnmount(() => { if (clock) clearInterval(clock); });

const activeSet = computed(() => setKind.value === "current" ? data.value?.validator_set : data.value?.next_validator_set);
const currentCount = computed(() => data.value?.validator_set?.total ?? 0);
const nextCount = computed(() => data.value?.next_validator_set?.total ?? 0);
const rows = computed(() => filterAndSortValidators(validatorRows(activeSet.value), query.value, sort.value));
const visibleRows = computed(() => rows.value.slice(offset.value, offset.value + pageSize.value));
const roundProgress = computed(() => validatorRoundProgress(activeSet.value?.utime_since ?? 0, activeSet.value?.utime_until ?? 0, now.value));
const remaining = computed(() => formatRemaining((activeSet.value?.utime_until ?? 0) - now.value));
const staking = computed(() => data.value?.staking ?? null);
const latestCycle = computed(() => staking.value?.latest_cycle ?? null);
const stakeValue = computed(() => staking.value?.current_election_available
  ? staking.value.current_election_stake
  : latestCycle.value?.total_stake);
const stakeLabel = computed(() => staking.value?.current_election_available ? "Current election stake" : "Latest realized stake");
const realizedApy = computed(() => {
  const value = latestCycle.value?.compounded_apy;
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(2)}%`;
});

watch([setKind, query, sort, pageSize], () => { offset.value = 0; });
watch(rows, (value) => {
  if (offset.value >= value.length) offset.value = Math.max(0, Math.floor(Math.max(0, value.length - 1) / pageSize.value) * pageSize.value);
});

function selectSet(kind: "current" | "next"): void {
  setKind.value = kind;
}

async function moveSetFocus(kind: "current" | "next"): Promise<void> {
  selectSet(kind);
  await nextTick();
  document.getElementById(`validator-${kind}-tab`)?.focus();
}
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Validators" description="Current and upcoming validator membership, round timing, voting weight and staking context derived from chain evidence." eyebrow="Consensus evidence">
      <div class="heading-actions">
        <RouterLink class="button button--secondary" to="/staking">Staking</RouterLink>
        <button class="button button--secondary" type="button" @click="refresh"><AppIcon name="refresh" :size="17" />Refresh</button>
      </div>
    </PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="metric-strip validator-metrics" aria-label="Validator network summary">
          <div><small>Active validators</small><strong>{{ formatInteger(currentCount) }}</strong><span>{{ data.validator_set?.main ?? 0 }} masterchain validators</span></div>
          <div><small>{{ stakeLabel }}</small><strong>{{ formatTos(stakeValue) }}</strong><span>{{ staking?.current_election_available ? `${formatInteger(staking.current_participants)} election participants` : latestCycle ? `Election ${latestCycle.election_id}` : 'Elector evidence unavailable' }}</span></div>
          <div><small>Latest realized network APY</small><strong>{{ realizedApy }}</strong><span>{{ latestCycle ? `Completed election ${latestCycle.election_id}` : 'Awaiting a completed reward cycle' }}</span></div>
          <div><small>Observed proof signatures</small><strong>{{ formatInteger(data.signatures.length) }}</strong><span>Masterchain block {{ formatInteger(data.observed_mc_seqno) }}</span></div>
        </section>

        <section class="surface validator-round" aria-labelledby="validator-round-title">
          <header>
            <div>
              <small>{{ setKind === 'current' ? 'Active consensus window' : 'Committed successor window' }}</small>
              <h2 id="validator-round-title">{{ setKind === 'current' ? 'Current validator round' : 'Next validator round' }}</h2>
            </div>
            <StatusBadge :status="setKind === 'current' ? 'active' : activeSet ? 'upcoming' : 'not published'" />
          </header>
          <template v-if="activeSet">
            <div class="validator-round-progress">
              <div><strong>{{ roundProgress.toFixed(1) }}%</strong><span>{{ setKind === 'current' ? `${remaining} remaining` : `${formatInteger(activeSet.total)} validators committed` }}</span></div>
              <div class="round-meter" role="progressbar" :aria-label="`${setKind} validator round progress`" :aria-valuenow="Math.round(roundProgress)" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: `${roundProgress}%` }"></i></div>
              <div><span>{{ formatDate(activeSet.utime_since) }}</span><span>{{ formatDate(activeSet.utime_until) }}</span></div>
            </div>
          </template>
          <p v-else class="inline-empty">The chain has not committed configuration parameter #36 for a next validator set.</p>
        </section>

        <section v-if="staking?.effective_stake" class="surface validator-cap-note" :class="{ 'validator-cap-note--binding': staking.effective_stake.surplus_earns === false }" role="note">
          <div><small>Effective-stake policy</small><strong>{{ staking.effective_stake.surplus_earns === false ? 'Stake above the cap earns no additional reward' : 'Reward-bearing stake policy' }}</strong><span v-if="staking.effective_stake.effective_stake_cap">Current cap {{ formatTos(staking.effective_stake.effective_stake_cap) }} TOS per elected validator</span></div>
          <RouterLink to="/staking">See staking evidence <AppIcon name="chevron" :size="15" /></RouterLink>
        </section>

        <section class="surface page-surface validator-directory">
          <header class="section-heading">
            <div><h2>{{ setKind === 'current' ? 'Current validator set' : 'Next validator set' }}</h2><p>Public keys, ADNL identities and voting weights extracted from proved configuration cells</p></div>
            <ExportButton
              :filename="`toscan-${setKind}-validators`"
              :headers="['Canonical rank','Public key','ADNL','Role','Weight','Weight share','Cumulative weight']"
              :rows="rows.map((row) => [row.rank,row.public_key,row.adnl_address,row.masterchain ? 'masterchain' : 'shard',row.weight,ratioPercent(row.weight,activeSet?.total_weight ?? '0'),row.cumulative_weight])"
            />
          </header>

          <div class="validator-set-tabs" role="tablist" aria-label="Validator set">
            <button id="validator-current-tab" type="button" role="tab" aria-controls="validator-set-panel" :aria-selected="setKind === 'current'" :tabindex="setKind === 'current' ? 0 : -1" @click="selectSet('current')" @keydown.right.prevent="moveSetFocus('next')">Current <span>{{ formatInteger(currentCount) }}</span></button>
            <button id="validator-next-tab" type="button" role="tab" aria-controls="validator-set-panel" :aria-selected="setKind === 'next'" :tabindex="setKind === 'next' ? 0 : -1" @click="selectSet('next')" @keydown.left.prevent="moveSetFocus('current')">Next <span>{{ data.next_validator_set ? formatInteger(nextCount) : '—' }}</span></button>
          </div>

          <div id="validator-set-panel" role="tabpanel" :aria-labelledby="`validator-${setKind}-tab`">
            <div class="validator-toolbar">
              <label class="validator-search"><AppIcon name="search" :size="16" /><span class="sr-only">Search validators</span><input v-model="query" type="search" placeholder="Search public key or ADNL" /></label>
              <label class="select-control">Sort <select v-model="sort" aria-label="Sort validators"><option value="weight-desc">Weight, highest first</option><option value="weight-asc">Weight, lowest first</option><option value="identity-asc">Public key</option></select></label>
              <label class="select-control">Rows <select v-model.number="pageSize" aria-label="Validators per page"><option :value="25">25</option><option :value="50">50</option><option :value="100">100</option></select></label>
            </div>

            <div class="data-table-wrap validator-table-wrap">
              <table class="data-table validator-table">
                <caption class="sr-only">{{ setKind }} validator set</caption>
                <thead><tr><th>Rank</th><th>Validator</th><th>ADNL</th><th>Role</th><th>Weight</th><th>Share</th><th><span class="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  <tr v-for="row in visibleRows" :key="row.public_key">
                    <td><span class="validator-rank">{{ row.rank }}</span></td>
                    <td><RouterLink class="mono validator-table-link" :to="{ name: 'validator', params: { publicKey: validatorRouteKey(row.public_key) } }">{{ compact(row.public_key, 16, 12) }}</RouterLink><small class="validator-cell-note">Proof-extracted public key</small></td>
                    <td class="mono">{{ compact(row.adnl_address, 12, 10) }}</td>
                    <td><StatusBadge :status="row.masterchain ? 'active' : 'shard'" /></td>
                    <td class="mono">{{ formatInteger(row.weight) }}</td>
                    <td><strong>{{ ratioPercent(row.weight, activeSet?.total_weight ?? '0').toFixed(2) }}%</strong></td>
                    <td><div class="validator-row-actions"><CopyButton :value="row.public_key" label="validator public key" /><RouterLink :to="{ name: 'validator', params: { publicKey: validatorRouteKey(row.public_key) } }" :aria-label="`Open validator ${row.rank}`"><AppIcon name="chevron" :size="17" /></RouterLink></div></td>
                  </tr>
                  <tr v-if="!visibleRows.length"><td colspan="7" class="inline-empty">{{ activeSet ? 'No validators match this search.' : 'No validator set has been published.' }}</td></tr>
                </tbody>
              </table>
            </div>
            <PaginationBar :total="rows.length" :offset="offset" :limit="pageSize" :complete="true" @change="offset = $event" />
          </div>
        </section>

        <p class="surface evidence-note"><strong>Evidence boundary.</strong> Membership, ADNL identity, round timing and voting weight come from proof-extracted configuration parameters #34 and #36. Stake and APY are network-level Elector evidence; they are never assigned to an individual validator without an attributable on-chain ledger. Country, software version, operator wallet, uptime and individual rewards are deliberately omitted until the chain or a separately identified telemetry source can prove them.</p>
      </template>
    </LoadState>
  </div>
</template>
