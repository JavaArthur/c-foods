<script setup>
import { computed, ref, watch } from "vue";
const props = defineProps({ dish: Object, eager: Boolean });
const failed = ref(false);
const src = computed(() =>
  props.dish.image?.startsWith("/")
    ? import.meta.env.BASE_URL + props.dish.image.slice(1)
    : props.dish.image,
);
const illustration = computed(
  () => props.dish._meta?.image.kind === "illustration",
);
watch(
  () => props.dish.image,
  () => (failed.value = false),
);
</script>
<template>
  <div
    class="dish-image"
    :class="{
      'veg-image': dish.isMeat === false,
      'custom-image': dish.source === 'custom',
      'image-placeholder': !dish.image || failed,
    }"
  >
    <img
      v-if="dish.image && !failed"
      :src="src"
      :alt="dish.name + (illustration ? '示意图' : '成品图')"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      width="640"
      height="640"
      @error="failed = true"
    /><span v-else aria-hidden="true">{{ dish.name[0] }}</span>
  </div>
</template>
