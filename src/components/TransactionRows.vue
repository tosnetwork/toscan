<script setup lang="ts">
import type { TransactionSummary } from "@/api/types";
import AppIcon from "./AppIcon.vue";
import { compact, formatTos, timeAgo } from "@/utils/format";

defineProps<{ transactions: TransactionSummary[]; compactRows?: boolean }>();
</script>

<template>
  <div class="entity-list" :class="{ 'entity-list--compact': compactRows }">
    <RouterLink
      v-for="transaction in transactions"
      :key="`${transaction.account}:${transaction.lt}:${transaction.hash}`"
      class="entity-row transaction-row"
      :to="{ name: 'transaction', params: { account: transaction.account, lt: transaction.lt, hash: transaction.hash } }"
    >
      <span class="entity-glyph entity-glyph--transaction"><AppIcon name="transaction" :size="18" /></span>
      <span class="row-primary"><strong class="mono">{{ compact(transaction.hash, 9, 6) }}</strong><small>Transaction</small></span>
      <span class="row-field row-field--hash"><small>Account</small><span class="mono">{{ compact(transaction.account, 10, 7) }}</span></span>
      <span class="row-field"><small>Fee</small><span>{{ transaction.fee ? `${formatTos(transaction.fee)} TOS` : "—" }}</span></span>
      <span class="row-time"><strong>{{ timeAgo(transaction.time) }}</strong><small>LT {{ compact(transaction.lt, 7, 4) }}</small></span>
      <AppIcon class="row-chevron" name="chevron" :size="16" />
    </RouterLink>
  </div>
</template>
