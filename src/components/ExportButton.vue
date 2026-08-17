<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import { downloadCsv, type CsvCell } from "@/utils/csv";
import { useLocale } from "@/i18n";

const props = defineProps<{
  filename: string;
  headers: string[];
  rows: CsvCell[][];
  label?: string;
}>();
const { t } = useLocale();
</script>

<template>
  <button class="button button--secondary export-button" type="button" :disabled="!rows.length" @click="downloadCsv(props.filename, props.headers, props.rows)">
    <AppIcon name="download" :size="16" />{{ t(label ?? "Export CSV") }}
  </button>
</template>
