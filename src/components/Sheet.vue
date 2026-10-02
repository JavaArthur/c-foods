<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import Icon from "./Icon.vue";
defineProps({ title: String });
const emit = defineEmits(["close"]);
const dialog = ref();
let previous;
onMounted(() => {
  previous = document.activeElement;
  dialog.value.showModal();
});
onBeforeUnmount(() => {
  dialog.value?.close();
  previous?.focus();
});
</script>
<template>
  <dialog
    ref="dialog"
    class="sheet"
    @cancel.prevent="emit('close')"
    @click="
      (e) => {
        if (e.target === dialog) emit('close');
      }
    "
  >
    <div class="sheet-handle"></div>
    <header>
      <h2>{{ title }}</h2>
      <button class="icon-button" aria-label="关闭" @click="emit('close')">
        <Icon name="close" />
      </button>
    </header>
    <div class="sheet-content"><slot /></div>
  </dialog>
</template>
