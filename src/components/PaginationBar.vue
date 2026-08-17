<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";

const props = defineProps<{ total: number; offset: number; limit: number; complete?: boolean }>();
const emit = defineEmits<{ change: [offset: number] }>();
const first = computed(() => props.total === 0 ? 0 : props.offset + 1);
const last = computed(() => Math.min(props.offset + props.limit, props.total));
const canPrevious = computed(() => props.offset > 0);
const canNext = computed(() => props.offset + props.limit < props.total);
</script>

<template>
  <nav v-if="total > limit || !complete" class="pagination" aria-label="Pagination">
    <p>
      <span v-if="total">{{ first }}–{{ last }} of {{ total.toLocaleString() }}</span>
      <span v-else>No indexed records</span>
      <small v-if="complete === false">Bounded node window</small>
    </p>
    <div>
      <button type="button" :disabled="!canPrevious" aria-label="Previous page" @click="emit('change', Math.max(0, offset - limit))">
        <AppIcon name="chevron" :size="15" /> Previous
      </button>
      <button type="button" :disabled="!canNext" aria-label="Next page" @click="emit('change', offset + limit)">
        Next <AppIcon name="chevron" :size="15" />
      </button>
    </div>
  </nav>
</template>
