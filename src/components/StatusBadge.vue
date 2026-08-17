<script setup lang="ts">
import { statusTone } from "@/utils/format";
const props = defineProps<{ status: string }>();
</script>

<template><span class="status-badge" :data-tone="statusTone(props.status)">{{ status.replaceAll("_", " ") }}</span></template>
