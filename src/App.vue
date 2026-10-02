<script setup>
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import Icon from "./components/Icon.vue";
import {
  loadDishes,
  loading,
  loadError,
  toast,
  step,
  maxStep,
  goStep,
} from "./lib/store";
const route = useRoute();
const tabs = [
  ["/", "pot", "今晚吃啥"],
  ["/recipes", "book", "菜谱库"],
  ["/favorites", "heart", "收藏"],
  ["/me", "user", "我的"],
];
onMounted(loadDishes);
</script>
<template>
  <div class="app-shell">
    <template v-if="!route.path.startsWith('/cook/')"
      ><header class="brand">
        <router-link to="/" class="brand-name"
          ><span class="brand-mark"><Icon name="pot" :size="25" /></span
          >今晚吃什么<span class="brand-dot">.</span></router-link
        ><span class="brand-tag">好好吃饭，慢慢生活</span>
      </header>
      <nav class="stepper" aria-label="今晚做饭进度" v-if="route.path === '/'">
        <button
          v-for="(name, i) in ['选搭配', '看菜单', '买菜', '做菜']"
          :key="name"
          :class="{ active: step === i + 1, done: step > i + 1 }"
          :disabled="i + 1 > maxStep"
          :aria-current="step === i + 1 ? 'step' : undefined"
          @click="goStep(i + 1)"
        >
          <span>{{ step > i + 1 ? "✓" : i + 1 }}</span
          >{{ name }}
        </button>
      </nav></template
    >
    <main
      v-if="loading"
      class="page"
      aria-busy="true"
      aria-label="正在准备菜谱"
    >
      <div class="skeleton sk-title"></div>
      <div class="skeleton sk-card"></div>
      <div class="skeleton sk-card"></div>
    </main>
    <main v-else-if="loadError" class="page empty">
      <Icon name="bowl" :size="64" />
      <h1>菜谱还没端上来</h1>
      <p>菜谱没加载出来，点我再试一次。</p>
      <button class="primary" @click="loadDishes">再试一次</button>
    </main>
    <router-view v-else v-slot="{ Component }"
      ><Transition name="page" mode="out-in"
        ><component :is="Component" :key="route.path" /></Transition
    ></router-view>
    <nav
      v-if="!route.path.startsWith('/cook/')"
      class="bottom-nav"
      aria-label="主导航"
    >
      <router-link
        v-for="[url, icon, label] in tabs"
        :key="url"
        :to="url"
        :class="{ active: route.path === url }"
        ><Icon :name="icon" /><span>{{ label }}</span></router-link
      >
    </nav>
    <Transition name="page"
      ><div v-if="toast" class="toast" role="status">
        {{ toast }}
      </div></Transition
    >
  </div>
</template>
