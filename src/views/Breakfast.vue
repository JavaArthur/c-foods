<script setup>
import { computed, ref } from "vue";
import { state, tell } from "../lib/store.js";
import {
  extraAllowed,
  pickRandom,
  saveBreakfast,
  removeBreakfast,
} from "../lib/meal-extras.js";
import Icon from "../components/Icon.vue";
import Sheet from "../components/Sheet.vue";
const form = ref(null),
  name = ref(""),
  error = ref(""),
  deleting = ref(null);
const items = computed(() => state.breakfast.items);
const pool = computed(() =>
  items.value.filter((i) => extraAllowed(i, state.settings)),
);
const selected = computed(() =>
  pool.value.find((i) => i.id === state.breakfast.lastPickedId),
);
function edit(item) {
  form.value = item ? { id: item.id } : {};
  name.value = item?.name || "";
  error.value = "";
}
function save() {
  const result = saveBreakfast(state.breakfast, name.value, form.value.id);
  if (result.error) {
    error.value = result.error;
    return;
  }
  form.value = null;
  tell("早餐已保存。");
}
function choose() {
  const item = pickRandom(pool.value, state.breakfast.lastPickedId);
  if (!item) return;
  state.breakfast.lastPickedId = item.id;
  if (pool.value.length === 1)
    tell("目前只有这一份可选早餐，再添几个就能换着吃啦。");
}
</script>
<template>
  <div class="page extras-page">
    <p class="eyebrow">从容一点，开始新的一天</p>
    <h1>早餐吃什么<span class="orange">？</span></h1>
    <p class="extras-intro">记下常吃的早餐，把早上的小纠结交给随机。</p>
    <section class="random-panel breakfast-panel" aria-label="早餐随机结果">
      <Icon name="bowl" :size="36" />
      <div role="status" aria-live="polite">
        <template v-if="selected"
          ><p>这次吃</p>
          <h2>{{ selected.name }}</h2></template
        >
        <template v-else-if="!items.length"
          ><h2>早餐清单还是空的</h2>
          <p>还没有早餐，先添加几个常吃的吧</p></template
        >
        <template v-else
          ><h2>
            {{ pool.length ? "今天，从哪一份开始？" : "暂时没有合适的早餐" }}
          </h2>
          <p>
            {{
              pool.length
                ? `${pool.length} 份早餐等你选`
                : "现有早餐名称与忌口匹配，可以添加其他早餐。"
            }}
          </p></template
        >
      </div>
      <button class="primary full" :disabled="!pool.length" @click="choose">
        <Icon name="refresh" />{{ selected ? "换一个" : "随机选早餐" }}
      </button>
      <button v-if="!items.length" class="text-button full" @click="edit()">
        添加第一份早餐
      </button>
    </section>
    <div class="section-heading extras-heading">
      <h2>
        我的早餐 <span class="extras-count">{{ items.length }}</span>
      </h2>
      <button class="text-button" @click="edit()">
        <Icon name="plus" :size="18" />添加早餐
      </button>
    </div>
    <p class="note">
      这里只记录名称，未记录完整食材；随机时仅按名称匹配已设置的忌口。
    </p>
    <ul class="breakfast-list">
      <li v-for="item in items" :key="item.id">
        <div>
          <strong>{{ item.name }}</strong>
          <p v-if="!extraAllowed(item, state.settings)" class="note">
              命中忌口关键词，暂不参与随机
          </p>
        </div>
        <div class="breakfast-actions">
          <button
            class="text-button"
            :aria-label="'修改' + item.name"
            @click="edit(item)"
          >
            改名</button
          ><button
            class="text-button danger"
            :aria-label="'删除' + item.name"
            @click="deleting = item"
          >
            删除
          </button>
        </div>
      </li>
    </ul>
    <Sheet
      v-if="form"
      :title="form.id ? '修改早餐名称' : '添加早餐'"
      @close="form = null"
    >
      <form class="extras-form" @submit.prevent="save">
        <label for="breakfast-name">早餐名称</label>
        <input
          id="breakfast-name"
          v-model="name"
          autofocus
          maxlength="100"
          placeholder="例如：小米粥、鸡蛋三明治"
          :aria-invalid="!!error"
          :aria-describedby="error ? 'breakfast-error' : undefined"
        />
        <p v-if="error" id="breakfast-error" class="danger" role="alert">
          {{ error }}
        </p>
        <button class="primary full" type="submit">保存早餐</button>
      </form>
    </Sheet>
    <Sheet v-if="deleting" title="删除早餐" @close="deleting = null">
      <p>删除「{{ deleting.name }}」后，它将不再参与随机。</p>
      <button
        class="primary full extras-space"
        @click="
          removeBreakfast(state.breakfast, deleting.id);
          deleting = null;
          tell('早餐已删除。');
        "
      >
        确认删除
      </button>
    </Sheet>
  </div>
</template>
