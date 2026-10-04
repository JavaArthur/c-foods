<script setup>
import { ref } from "vue";
import { state, dishById, saveCustomDish, restoreDish } from "../lib/store";
const props = defineProps({ dish: Object });
const emit = defineEmits(["saved", "existing", "cancel"]);
const name = ref(props.dish?.name || ""),
  error = ref(""),
  duplicate = ref(null);
function save() {
  const result = saveCustomDish(name.value, props.dish?.id);
  error.value = result.error || "";
  duplicate.value = result.duplicate || null;
  if (result.id) emit("saved", dishById.value.get(result.id));
}
function check() {
  // Keep the duplicate action mounted when Enter submits from the input.
  if (duplicate.value) return;
  error.value = !name.value.trim()
    ? "请填写菜名。"
    : [...name.value.trim()].length > 50
      ? "菜名最多 50 字。"
      : "";
}
</script>
<template>
  <form class="custom-dish-form" @submit.prevent="save">
    <label for="custom-dish-name">菜名</label>
    <input
      id="custom-dish-name"
      v-model="name"
      autofocus
      placeholder="例如：妈妈的蒸肉饼"
      :aria-invalid="!!error"
      aria-describedby="custom-dish-help custom-dish-error"
      @blur="check"
      @input="
        error = '';
        duplicate = null;
      "
    />
    <p id="custom-dish-help" class="note">
      先记下名字，食材和做法以后慢慢补。最多 50 字。
    </p>
    <p id="custom-dish-error" class="form-error" role="alert">{{ error }}</p>
    <template v-if="duplicate">
      <button
        v-if="state.settings.blacklist.includes(duplicate.id)"
        type="button"
        class="secondary full"
        @click="
          restoreDish(duplicate.id);
          emit('existing', duplicate);
        "
      >
        恢复这道已拉黑的菜
      </button>
      <button
        v-else
        type="button"
        class="secondary full"
        @click="emit('existing', duplicate)"
      >
        查看已有菜品
      </button>
    </template>
    <button class="primary full" type="submit">保存菜名</button>
    <button class="text-button full" type="button" @click="emit('cancel')">
      取消
    </button>
  </form>
</template>
