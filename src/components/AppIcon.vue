<script setup lang="ts">
defineProps<{ name: string; size?: number }>();
</script>

<template>
  <svg class="icon" :width="size ?? 20" :height="size ?? 20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path v-if="name === 'search'" d="m21 21-4.3-4.3m2.3-5.2a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
    <path v-else-if="name === 'menu'" d="M4 7h16M4 12h16M4 17h16" />
    <path v-else-if="name === 'close'" d="m6 6 12 12M18 6 6 18" />
    <path v-else-if="name === 'sun'" d="M12 3V1m0 22v-2m9-9h2M1 12h2m16.5-7.5 1.4-1.4M3.1 20.9l1.4-1.4m15 0 1.4 1.4M3.1 3.1l1.4 1.4M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z" />
    <path v-else-if="name === 'copy'" d="M8 8h11v11H8zM5 16H3V3h13v2" />
    <path v-else-if="name === 'chevron'" d="m9 18 6-6-6-6" />
    <path v-else-if="name === 'refresh'" d="M20 6v5h-5M4 18v-5h5m10-2a7 7 0 0 0-12-4L4 11m1 2a7 7 0 0 0 12 4l3-4" />
    <path v-else-if="name === 'arrow-up-right'" d="M7 17 17 7M8 7h9v9" />
    <path v-else-if="name === 'block'" d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5M12 12v9" />
    <path v-else-if="name === 'transaction'" d="M4 8h15m-4-4 4 4-4 4M20 16H5m4 4-4-4 4-4" />
    <path v-else-if="name === 'agent'" d="M9 4h6m-3 0V2M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Zm3 5h.01M15 13h.01M9 17h6" />
    <path v-else-if="name === 'task'" d="M9 5H5a2 2 0 0 0-2 2v12h14v-4M9 5V3h6v2m-6 0h6m-5 8 3 3 8-9" />
    <path v-else-if="name === 'service'" d="M4 6h16v12H4zM8 10h8M8 14h5M7 3v3m10-3v3" />
    <path v-else-if="name === 'network'" d="M12 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM4 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm16 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 24a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0-20v6m-6 2h12m-6 2v6" />
    <path v-else-if="name === 'wallet'" d="M3 6h15a2 2 0 0 1 2 2v11H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h13v3m1 6h4v4h-4a2 2 0 0 1 0-4Z" />
    <path v-else-if="name === 'clock'" d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    <path v-else-if="name === 'download'" d="M12 3v12m0 0 5-5m-5 5-5-5M4 19h16" />
    <path v-else d="M12 3v12m0 5v.01" />
  </svg>
</template>
