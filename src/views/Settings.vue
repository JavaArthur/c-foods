<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import {
  state,
  familyLabel,
  dishes,
  restoreDish,
  resetAll,
  tell,
} from "../lib/store";
import Sheet from "../components/Sheet.vue";
const extra = ref(""),
  clear = ref(false),
  installEvent = ref(null),
  classQuery = ref("");
const avoids = [
  "猪肉",
  "牛肉",
  "羊肉",
  "鸡肉",
  "鱼虾",
  "蛋",
  "大豆",
  "花生",
  "坚果",
  "牛奶",
  "小麦",
  "香菜",
];
const blacklisted = computed(() =>
  dishes.value.filter((d) => state.settings.blacklist.includes(d.id)),
);
const adjustable = computed(() =>
  dishes.value
    .filter(
      (d) =>
        ["egg", "tofu"].includes(d.proteinType) &&
        d.name.includes(classQuery.value),
    )
    .slice(0, 30),
);
function toggle(a) {
  state.settings.avoids = state.settings.avoids.includes(a)
    ? state.settings.avoids.filter((x) => x !== a)
    : [...state.settings.avoids, a];
}
function addAvoid() {
  for (const a of extra.value.split(/[,，、\s]+/).filter(Boolean))
    if (!state.settings.avoids.includes(a)) state.settings.avoids.push(a);
  extra.value = "";
}
function prompt(e) {
  e.preventDefault();
  installEvent.value = e;
}
async function install() {
  if (installEvent.value) {
    await installEvent.value.prompt();
    installEvent.value = null;
  } else
    tell(
      "iPhone：点浏览器「分享」→「添加到主屏幕」；安卓：浏览器菜单 →「安装应用」。",
    );
}
onMounted(() => window.addEventListener("beforeinstallprompt", prompt));
onBeforeUnmount(() =>
  window.removeEventListener("beforeinstallprompt", prompt),
);
</script>
<template>
  <div class="page settings">
    <p class="eyebrow">多懂你一点，配得更合心意</p>
    <h1>我家的口味</h1>
    <section class="setting-card">
      <h2>{{ familyLabel }}</h2>
      <p>
        以两人份配方为备菜起点，按食量调整；宝宝不直接折算为成人。清单和步骤同步换算。
      </p>
      <div class="servings">
        <button
          aria-label="减少备菜份量"
          :disabled="state.settings.servings === 1"
          @click="state.settings.servings--"
        >
          −</button
        ><strong>{{ state.settings.servings }} <small>份</small></strong
        ><button
          aria-label="增加备菜份量"
          :disabled="state.settings.servings === 6"
          @click="state.settings.servings++"
        >
          ＋
        </button>
      </div>
    </section>
    <section class="setting-card">
      <h2>不吃什么？</h2>
      <p>忌口和过敏的食材，配菜时都会避开。</p>
      <div class="chips small">
        <button
          v-for="a in [...new Set([...avoids, ...state.settings.avoids])]"
          :key="a"
          :class="{ selected: state.settings.avoids.includes(a) }"
          :aria-pressed="state.settings.avoids.includes(a)"
          @click="toggle(a)"
        >
          {{ a }}
        </button>
      </div>
      <form class="extra-avoid" @submit.prevent="addAvoid">
        <input
          v-model="extra"
          aria-label="其他忌口或过敏食材"
          placeholder="还有别的？填在这里"
        /><button class="secondary" type="submit">添加</button>
      </form>
    </section>
    <section class="setting-card">
      <h2>全家无辣</h2>
      <p>已排除辣椒、花椒、胡椒、芥末等刺激调味。每餐保留一道绿叶菜。</p>
    </section>
    <details class="setting-card">
      <summary>鸡蛋、豆腐算荤还是素？</summary>
      <p>默认算素菜，也可以按你家的习惯改。</p>
      <input
        v-model="classQuery"
        aria-label="搜索要调整分类的菜"
        placeholder="搜索菜名"
      /><label v-for="d in adjustable" :key="d.id" class="class-row"
        ><span>{{ d.name }}</span
        ><select
          :value="d.isMeat ? 'meat' : 'veg'"
          :aria-label="d.name + '分类'"
          @change="
            state.settings.classification[d.id] = $event.target.value === 'meat'
          "
        >
          <option value="veg">素菜</option>
          <option value="meat">荤菜</option>
        </select></label
      >
    </details>
    <details class="setting-card">
      <summary>已拉黑菜品 · {{ blacklisted.length }}</summary>
      <p v-if="!blacklisted.length">还没有屏蔽的菜。在菜谱详情里可以添加。</p>
      <div v-for="d in blacklisted" :key="d.id" class="class-row">
        <span>{{ d.name }}</span
        ><button
          class="text-button"
          :aria-label="'恢复' + d.name"
          @click="restoreDish(d.id)"
        >
          恢复
        </button>
      </div>
    </details>
    <button class="secondary full" @click="install">添加到手机桌面</button>
    <p class="privacy-note">
      不用注册，也不用登录。<br />偏好、收藏和菜单，只存在你的这台设备上。
    </p>
    <button class="text-button full danger" @click="clear = true">
      清除本地数据
    </button>
    <footer class="source">
      做法整理自
      <a
        href="https://github.com/Gar-b-age/CookLikeHOC"
        target="_blank"
        rel="noopener noreferrer"
        >CookLikeHOC（老乡鸡菜品溯源报告）</a
      ><br />仅供非商业学习
    </footer>
    <Sheet v-if="clear" title="和旧记录说再见？" @close="clear = false"
      ><p>
        会清空这台设备上的偏好、收藏、自录菜品、黑名单、历史菜单和做菜进度。
      </p>
      <button
        class="primary full"
        @click="
          resetAll();
          clear = false;
        "
      >
        确认清空</button
      ><button class="text-button full" @click="clear = false">
        先留着
      </button></Sheet
    >
  </div>
</template>
