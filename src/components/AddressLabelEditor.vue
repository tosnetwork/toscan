<script setup lang="ts">
import { ref, watch } from "vue";
import type { AddressLabel } from "@/api/types";
import { useAddressLabels } from "@/composables/useAddressLabels";

const props = defineProps<{ address: string; publicLabel?: AddressLabel | null }>();
const { label, setLabel } = useAddressLabels(() => props.address);
const editing = ref(false);
const draft = ref(label.value);
watch(label, (value) => { if (!editing.value) draft.value = value; });

function save() {
  setLabel(draft.value);
  editing.value = false;
}
</script>

<template>
  <div class="address-labels">
    <span v-if="publicLabel" class="address-label address-label--public" :title="`${publicLabel.source}${publicLabel.verified ? ' · verified' : ''}`">
      {{ publicLabel.label }}<small>{{ publicLabel.category }}</small>
    </span>
    <span v-if="label && !editing" class="address-label address-label--personal">{{ label }}<small>Personal label</small></span>
    <button v-if="!editing" type="button" class="text-button" @click="editing = true">{{ label ? 'Edit label' : 'Add private label' }}</button>
    <form v-else class="address-label-form" @submit.prevent="save">
      <label>Private label<input v-model="draft" maxlength="80" autocomplete="off" /></label>
      <button class="button button--small" type="submit">Save</button>
      <button class="text-button" type="button" @click="editing = false">Cancel</button>
    </form>
  </div>
</template>
