<script setup>
import { computed } from "vue";
import {
  state,
  favorite,
  addDish,
  blacklistDish,
  restoreDish,
} from "../lib/store.js";
import Icon from "./Icon.vue";
const props = defineProps({
  dish: { type: Object, required: true },
  blacklistOnly: Boolean,
});
const emit = defineEmits(["blocked", "added"]);
const blocked = computed(() =>
  state.settings.blacklist.includes(props.dish.id),
);
function block() {
  blacklistDish(props.dish.id);
  emit("blocked");
}
</script>
<template>
  <div class="dish-actions" :class="{ 'blacklist-only': blacklistOnly }">
    <template v-if="!blacklistOnly && !blocked">
      <button
        class="secondary"
        :aria-pressed="state.favorites.includes(dish.id)"
        @click.stop="favorite(dish.id)"
      >
        <Icon name="heart" :size="18" />{{
          state.favorites.includes(dish.id) ? "已收藏" : "想再吃"
        }}
      </button>
      <button class="primary" @click.stop="if (addDish(dish)) emit('added');">
        加入今晚菜单
      </button>
    </template>
    <button
      v-if="blocked"
      class="secondary"
      :aria-label="blacklistOnly ? '恢复' + dish.name : '恢复菜品'"
      @click.stop="restoreDish(dish.id)"
    >
      恢复菜品
    </button>
    <button
      v-else
      class="danger-button"
      :aria-label="blacklistOnly ? '拉黑' + dish.name : '拉黑菜品'"
      @click.stop="block"
    >
      <Icon name="block" :size="17" />拉黑
    </button>
  </div>
</template>
