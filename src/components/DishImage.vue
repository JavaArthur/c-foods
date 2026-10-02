<script setup>
import { ref, watch } from "vue";
const props = defineProps({ dish: Object });
const failed = ref(false);
watch(
  () => props.dish.image,
  () => (failed.value = false),
);
</script>
<template>
  <div class="dish-image" :class="{ 'veg-image': !dish.isMeat }">
    <img
      v-if="dish.image && !failed"
      :src="dish.image"
      :alt="dish.name + '成品'"
      loading="lazy"
      @error="failed = true"
    /><span v-else aria-hidden="true">{{ dish.name[0] }}</span>
  </div>
</template>
