<script setup lang="ts">
import type { BlockSummary } from "@/api/types";
import AppIcon from "./AppIcon.vue";
import { compact, formatInteger, timeAgo } from "@/utils/format";

defineProps<{ blocks: BlockSummary[]; compactRows?: boolean }>();
</script>

<template>
  <div class="entity-list" :class="{ 'entity-list--compact': compactRows }">
    <RouterLink
      v-for="block in blocks"
      :key="`${block.workchain}:${block.shard}:${block.seqno}`"
      class="entity-row block-row"
      :to="{ name: 'block', params: { workchain: block.workchain, shard: block.shard, seqno: block.seqno } }"
    >
      <span class="entity-glyph"><AppIcon name="block" :size="19" /></span>
      <span class="row-primary"><strong>{{ formatInteger(block.seqno) }}</strong><small>Masterchain block</small></span>
      <span class="row-field row-field--hash"><small>Root hash</small><span class="mono">{{ compact(block.root_hash) }}</span></span>
      <span class="row-field"><small>Transactions</small><span>{{ formatInteger(block.txCount) }}<em v-if="block.incomplete"> sampled</em></span></span>
      <span class="row-time"><strong>{{ timeAgo(block.time) }}</strong><small>{{ block.keyBlock ? "Key block" : "Finalized" }}</small></span>
      <AppIcon class="row-chevron" name="chevron" :size="16" />
    </RouterLink>
  </div>
</template>
