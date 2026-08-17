<script setup lang="ts">
import PageHeading from "@/components/PageHeading.vue";

const endpoints = [
  ["GET", "/explorer/status", "Projection totals, chain head and lag"],
  ["GET", "/explorer/blocks", "Cursor-paginated canonical blocks"],
  ["GET", "/explorer/block?hash=…", "Canonical block by root or file hash"],
  ["GET", "/explorer/transactions", "Cursor-paginated finalized transactions"],
  ["GET", "/explorer/transaction?hash=…", "Finalized transaction detail"],
  ["GET", "/explorer/message?hash=…", "Message occurrences and transaction edges"],
  ["GET", "/explorer/economy", "Agent Economy projection totals"],
  ["GET", "/explorer/search?q=…", "Exact canonical identity resolution"],
  ["GET", "/explorer/search/suggest?q=…", "Typed prefix and label suggestions"],
  ["GET", "/explorer/assets", "Discovered Jetton/NFT contracts"],
  ["GET", "/explorer/assets/activity", "Ownership-position observations"],
  ["GET", "/explorer/assets/{address}", "Asset contract and indexed positions"],
  ["GET", "/explorer/assets/{address}/holders", "Observed asset holder positions"],
  ["GET", "/explorer/assets/{address}/items", "Indexed NFT collection items"],
  ["GET", "/explorer/contracts/{kind}", "Typed Agent Economy contracts"],
  ["GET", "/explorer/contracts/{kind}/{address}", "Typed contract detail"],
  ["GET", "/explorer/labels/{address}", "Reviewed public address labels"],
  ["GET", "/explorer/verifications", "Matched contract build attestations"],
  ["GET", "/explorer/verifications/{address}", "Contract build evidence"],
  ["GET", "/explorer/validators", "Proof-decoded validator sets"],
  ["GET", "/explorer/validators/{publicKey}", "Validator membership history"],
  ["GET", "/explorer/staking", "Elector rewards and canonical pools"],
  ["GET", "/explorer/staking/pools/{address}", "Canonical Nominator Pool detail"],
  ["GET", "/explorer/analytics", "Chain-derived activity buckets"],
  ["GET", "/explorer/governance/history", "Retained configuration snapshots"],
];
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Explorer API" description="Read-only, evidence-bounded HTTP access to the same projection used by TOSCAN." eyebrow="Developers" />
    <section class="surface api-intro"><div><h2>Base path</h2><code>/tos-service-api</code></div><div><h2>OpenAPI</h2><a class="detail-link" href="/openapi.json" target="_blank">Download OpenAPI 3.1 document</a></div><div><h2>Public limit</h2><p>30 requests per second per source, burst 60.</p></div></section>
    <section class="surface page-surface">
      <div class="table-caption"><span>Public read endpoints</span><span>No signing or mutation routes</span></div>
      <div class="api-endpoints"><article v-for="endpoint in endpoints" :key="endpoint[1]"><strong>{{ endpoint[0] }}</strong><code>{{ endpoint[1] }}</code><span>{{ endpoint[2] }}</span></article></div>
    </section>
    <section class="surface evidence-card"><h2>Example</h2><pre>curl --fail \
  'https://explorer.example/tos-service-api/explorer/blocks?limit=20'</pre></section>
    <aside class="truth-note"><strong>Authority model</strong><p>The API is a rebuildable read projection. Finalized TOS state and proof-backed node responses remain authoritative. Operator, mutation and transaction-submission routes are deliberately unavailable from the explorer origin.</p></aside>
  </div>
</template>
