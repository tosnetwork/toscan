<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{
  values: number[];
  labels?: string[];
  title: string;
  valueLabel?: string;
  format?: (value: number) => string;
}>(), { labels: () => [], valueLabel: "Value", format: (value: number) => String(value) });

const width = 720;
const height = 220;
const inset = 18;
const finite = computed(() => props.values.map((value) => Number.isFinite(value) ? value : 0));
const minimum = computed(() => Math.min(...finite.value, 0));
const maximum = computed(() => Math.max(...finite.value, 1));
const range = computed(() => Math.max(1e-9, maximum.value - minimum.value));
const points = computed(() => finite.value.map((value, index) => {
  const x = finite.value.length <= 1 ? width / 2 : inset + index * ((width - inset * 2) / (finite.value.length - 1));
  const y = height - inset - ((value - minimum.value) / range.value) * (height - inset * 2);
  return { x, y, value, label: props.labels[index] ?? String(index + 1) };
}));
const line = computed(() => points.value.map((point) => `${point.x},${point.y}`).join(" "));
const area = computed(() => points.value.length
  ? `${inset},${height - inset} ${line.value} ${width - inset},${height - inset}`
  : "");
</script>

<template>
  <figure class="trend-chart">
    <figcaption><strong>{{ title }}</strong><span>{{ valueLabel }}</span></figcaption>
    <svg :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="`${title}. ${values.length} observations.`">
      <line v-for="step in 5" :key="step" :x1="inset" :x2="width - inset" :y1="inset + (step - 1) * ((height - inset * 2) / 4)" :y2="inset + (step - 1) * ((height - inset * 2) / 4)" class="chart-grid" />
      <polygon v-if="points.length" :points="area" class="chart-area" />
      <polyline v-if="points.length" :points="line" class="chart-line" />
      <g v-for="point in points" :key="`${point.x}-${point.label}`">
        <circle :cx="point.x" :cy="point.y" r="3.5" class="chart-point"><title>{{ point.label }} · {{ format(point.value) }}</title></circle>
      </g>
    </svg>
    <p v-if="!points.length" class="inline-empty">No historical observations are available yet.</p>
  </figure>
</template>
