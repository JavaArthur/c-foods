<script setup>
import DishActions from "../components/DishActions.vue";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import Icon from "../components/Icon.vue";
import DishCard from "../components/DishCard.vue";
import DishDetails from "../components/DishDetails.vue";
import MealBalance from "../components/MealBalance.vue";
import Sheet from "../components/Sheet.vue";
import {
  state,
  familyLabel,
  portionLabel,
  dishById,
  recommendationDishes as dishes,
  menu,
  menuIds,
  lockedIds,
  step,
  menuNote,
  goStep,
  confirmMenu,
  invalidate,
  tell,
  removeFromMenu,
} from "../lib/store";
import { isCustomDish } from "../lib/custom-dishes";
import {
  generateMenu,
  shoppingList,
  estimateTime,
  dishTime,
  cookOrder,
  localDate,
  sameDish,
} from "../lib/menu";
const router = useRouter(),
  counts = ref({ meat: 1, veg: 1 }),
  custom = ref(false),
  busy = ref(false),
  preview = ref(null),
  confirm = ref(false),
  copyFallback = ref("");
const presets = [
  ["一荤一素", 1, 1],
  ["一荤两素", 1, 2],
  ["两荤一素", 2, 1],
  ["两荤两素", 2, 2],
  ["三荤两素", 3, 2],
];
const hour = new Date().getHours(),
  greeting =
    hour < 11
      ? "早上好"
      : hour < 14
        ? "中午好"
        : hour < 18
          ? "下午好"
          : "晚上好";
const date = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "long",
}).format(new Date());
const list = computed(() => shoppingList(menu.value, state.settings.servings)),
  time = computed(() => estimateTime(menu.value)),
  groups = [
    ["meat", "🥩 肉禽蛋水产"],
    ["veg", "🥬 蔬菜菌菇"],
    ["seasoning", "🧂 调料"],
    ["pantry", "🏠 家里一般有"],
  ];
const done = computed(
  () => list.value.filter((i) => state.checks[i.key]).length,
);
const customDishes = computed(() => menu.value.filter(isCustomDish));
const recipes = computed(() => menu.value.filter((d) => !isCustomDish(d)));
const pendingIngredients = computed(() =>
  customDishes.value.length
    ? "以下自家菜的食材待补：" +
      customDishes.value.map((d) => d.name).join("、")
    : "",
);
const timeLabel = computed(() =>
  recipes.value.length
    ? `预计 ${time.value} 分钟${customDishes.value.length ? "（不含自录菜）" : ""}`
    : "用时待补",
);
const menuSummary = computed(
  () =>
    `${recipes.value.filter((d) => d.isMeat).length} 荤 ${recipes.value.filter((d) => !d.isMeat).length} 素${customDishes.value.length ? " + " + customDishes.value.length + " 道自家菜" : ""} · ${timeLabel.value} · 备菜约 ${state.settings.servings} 份`,
);
function adjust(key, n) {
  counts.value[key] = Math.max(
    key === "veg" ? 1 : 0,
    Math.min(5, counts.value[key] + n),
  );
  if (counts.value.meat + counts.value.veg === 0) counts.value[key] = 1;
}
function generate() {
  busy.value = true;
  const r = generateMenu(
    dishes.value,
    counts.value,
    state.settings,
    state.history,
    state.favorites,
  );
  menuIds.value = r.menu.map((d) => d.id);
  menuNote.value = r.note;
  lockedIds.value = [];
  invalidate();
  busy.value = false;
  if (!menuIds.value.length) {
    tell(r.note);
    return;
  }
  goStep(2);
  if (r.note) tell(r.note);
}
function replace(id) {
  if (!recipes.value.length) {
    tell("自家菜会为你保留，可以去菜谱库再加一道绿叶菜。");
    return;
  }
  if (id && lockedIds.value.includes(id)) {
    tell("这道已锁住，先解锁再换吧。");
    return;
  }
  const keep = recipes.value.filter((d) =>
    id ? d.id !== id : lockedIds.value.includes(d.id),
  );
  const target = {
    meat: recipes.value.filter((d) => d.isMeat).length,
    veg: recipes.value.filter((d) => !d.isMeat).length,
  };
  const r = generateMenu(
    dishes.value.filter(
      (d) => !customDishes.value.some((other) => sameDish(d, other)),
    ),
    target,
    state.settings,
    state.history,
    state.favorites,
    keep,
    menu.value.filter((d) => !keep.includes(d)).map((d) => d.id),
  );
  if (
    !r.valid ||
    r.menu.length < recipes.value.length ||
    r.menu.length + customDishes.value.length > 10
  ) {
    tell(r.note || "暂时找不到更合适的菜，帮你留住这一桌啦。");
    return;
  }
  menuIds.value = id
    ? menu.value.map((d) =>
        d.id === id
          ? r.menu.find((x) => !keep.some((k) => k.id === x.id)).id
          : d.id,
      )
    : [...r.menu, ...customDishes.value].map((d) => d.id);
  menuNote.value = r.note;
  invalidate();
  if (r.note) tell(r.note);
}
function toggleLock(id) {
  lockedIds.value = lockedIds.value.includes(id)
    ? lockedIds.value.filter((x) => x !== id)
    : [...lockedIds.value, id];
}
function confirmNow() {
  if (confirmMenu()) confirm.value = true;
}
async function copy() {
  const text =
    `今晚的买菜清单（备菜约 ${state.settings.servings} 份）\n${menu.value.map((d) => d.name).join("、")}\n\n` +
    groups
      .map(
        ([g, title]) =>
          `${title}\n${list.value
            .filter((i) => i.group === g)
            .map(
              (i) =>
                `${state.checks[i.key] ? "✓" : "□"} ${i.name} ${i.quantity} · ${i.dishes.join("、")}`,
            )
            .join("\n")}`,
      )
      .join("\n\n") +
    (pendingIngredients.value ? "\n\n" + pendingIngredients.value : "");
  try {
    await navigator.clipboard.writeText(text);
    tell("清单复制好啦，发到微信就能用。");
  } catch {
    copyFallback.value = text;
  }
}
function status(d) {
  const p = state.progress[d.id];
  return p?.done
    ? "已完成 ✅"
    : isCustomDish(d)
      ? "做法待补 · 可直接标记完成"
      : p
        ? `第 ${p.step + 1}/${d.steps.length} 步`
        : "未开始";
}
</script>
<template>
  <div class="page tonight" :class="'step-' + step">
    <template v-if="step === 1"
      ><div class="hello">
        <p class="eyebrow">{{ date }}</p>
        <h1>
          {{ greeting }}～<br />今晚想吃点啥<span class="orange">？</span>
        </h1>
        <p>{{ familyLabel }} · 无辣家常菜</p>
      </div>
      <div v-show="!custom" class="meal-illustration" aria-hidden="true">
        <div class="leaf-deco">✳</div>
        <div class="plate">
          <span class="rice">🍚</span><span class="broccoli">🥦</span
          ><span class="shrimp">🍤</span>
        </div>
        <span class="food-note">简单搭一搭<br />好好吃顿饭</span>
        <div class="chopsticks"></div>
      </div>
      <section class="choose">
        <div class="section-heading">
          <h2>今晚，想做几道？</h2>
          <router-link to="/me" class="people-link"
            ><Icon name="users" :size="18" />两大一小</router-link
          >
        </div>
        <div class="chips">
          <button
            v-for="[name, m, v] in presets"
            :key="name"
            :class="{
              selected: !custom && counts.meat === m && counts.veg === v,
            }"
            :aria-pressed="!custom && counts.meat === m && counts.veg === v"
            @click="
              counts = { meat: m, veg: v };
              custom = false;
            "
          >
            {{ name }}</button
          ><button
            :class="{ selected: custom }"
            :aria-expanded="custom"
            @click="custom = !custom"
          >
            自定义 <span>＋</span>
          </button>
        </div>
        <div v-if="custom" class="custom-count">
          <div
            v-for="[key, label] in [
              ['meat', '荤菜'],
              ['veg', '素菜'],
            ]"
            :key="key"
          >
            <span>{{ label }}</span
            ><button
              :aria-label="'减少' + label"
              :disabled="counts[key] === (key === 'veg' ? 1 : 0)"
              @click="adjust(key, -1)"
            >
              −</button
            ><strong>{{ counts[key] }}</strong
            ><button
              :aria-label="'增加' + label"
              :disabled="counts[key] === 5"
              @click="adjust(key, 1)"
            >
              ＋
            </button>
          </div>
        </div>
      </section>
      <p class="gentle-line">
        <Icon name="leaf" :size="18" />每餐一道绿叶菜，荤菜也多搭点食材。
      </p>
      <div class="action-bar single">
        <button class="primary" :disabled="busy" @click="generate">
          <span v-if="busy" class="rolling">🎲</span
          >{{ busy ? "正在想好吃的…" : "帮我配菜 🍳"
          }}<Icon v-if="!busy" name="right" />
        </button></div
    ></template>
    <template v-else-if="step === 2"
      ><div class="menu-heading">
        <p class="eyebrow">
          {{
            state.today?.date === localDate() && !state.today.needsConfirmation
              ? "今日菜单 · 已为你记好"
              : "搭配刚刚好，美味不重样"
          }}
        </p>
        <h1>今晚的菜单</h1>
        <p>{{ menuSummary }}</p>
      </div>
      <div class="menu-cards" :class="{ 'two-dishes': menu.length === 2 }">
        <DishCard
          v-for="(d, i) in menu"
          :eager="i < 2"
          :key="d.id"
          :dish="d"
          :locked="lockedIds.includes(d.id)"
          @open="preview = d"
          @lock="toggleLock(d.id)"
          @replace="replace(d.id)"
          @remove="removeFromMenu(d.id)"
        />
      </div>
      <MealBalance :menu="menu" :note="menuNote" />
      <div class="action-bar">
        <button class="secondary" @click="replace()">
          <Icon name="refresh" :size="18" />整桌换一换</button
        ><button class="primary" @click="confirmNow">就做这些 ✅</button>
      </div></template
    >
    <template v-else-if="step === 3"
      ><p class="eyebrow">带上清单，顺路买齐</p>
      <h1>今天要买这些</h1>
      <p>{{ portionLabel }} · 已备好 {{ done }} / {{ list.length }} 样</p>
      <p v-if="pendingIngredients" class="note pending-ingredients">
        {{ pendingIngredients }}
      </p>
      <div class="progress-track">
        <div
          :style="{ width: (list.length ? done / list.length : 0) * 100 + '%' }"
        ></div>
      </div>
      <template v-for="[g, title] in groups" :key="g"
        ><details
          v-if="list.some((i) => i.group === g)"
          class="shopping-group"
          open
        >
          <summary>
            {{ title
            }}<span>{{ list.filter((i) => i.group === g).length }} 样</span>
          </summary>
          <label
            v-for="i in list.filter((i) => i.group === g)"
            :key="i.key"
            class="shopping-row"
            :class="{ checked: state.checks[i.key] }"
            ><input type="checkbox" v-model="state.checks[i.key]" /><span
              ><strong>{{ i.name }}</strong
              ><small>{{ i.dishes.join("、") }}</small></span
            ><b>{{ i.quantity }}</b></label
          >
        </details></template
      >
      <p class="note">
        家里有的也勾上，少买一点，刚刚好。不同计量单位会保留，不替你猜重量。
      </p>
      <div class="action-bar">
        <button class="secondary" @click="copy">📋 复制清单</button
        ><button class="primary" @click="goStep(4)">买好了，开做 →</button>
      </div></template
    >
    <template v-else
      ><p class="eyebrow">围裙系好，美味就要上桌</p>
      <h1>一起做顿热乎饭</h1>
      <p>一道一道来，慢慢做也没关系。</p>
      <section v-if="recipes.length > 1" class="order-note">
        <h2><Icon name="clock" :size="20" />推荐做菜顺序</h2>
        <p>先炖煮，再快炒，凉菜最后拌。</p>
        <ol>
          <li v-for="d in cookOrder(recipes)" :key="d.id">
            {{ d.name }}<span>{{ dishTime(d) }} 分钟</span>
          </li>
        </ol>
      </section>
      <article v-for="d in cookOrder(menu)" :key="d.id" class="cook-list-item">
        <button class="cook-list-row" @click="router.push('/cook/' + d.id)">
          <span
            class="badge"
            :class="isCustomDish(d) ? 'custom' : d.isMeat ? 'meat' : 'veg'"
            >{{ isCustomDish(d) ? "自家菜" : d.isMeat ? "荤" : "素" }}</span
          ><span
            ><strong>{{ d.name }}</strong
            ><small>{{ status(d) }}</small></span
          ><Icon name="right" />
        </button>
        <DishActions :dish="d" blacklist-only />
      </article>
      <div
        v-if="menu.every((d) => state.progress[d.id]?.done)"
        class="finished-message"
      >
        🎉 菜齐啦，和家人好好吃顿饭吧。
      </div>
      <div class="action-bar single">
        <button class="secondary" @click="goStep(3)">回看买菜清单</button>
      </div></template
    >
    <DishDetails v-if="preview" :dish="preview" @close="preview = null" />
    <Sheet v-if="confirm" title="今晚就这么吃！" @close="confirm = false"
      ><div class="celebrate" aria-hidden="true">✓</div>
      <h2 class="confirm-title">今晚就做这 {{ menu.length }} 道啦 👇</h2>
      <ul class="confirm-dishes">
        <li v-for="d in menu" :key="d.id">
          {{ isCustomDish(d) ? "自家菜 ·" : d.isMeat ? "🍖" : "🥬" }}
          {{ d.name }}
        </li>
      </ul>
      <p class="confirm-info">
        已记录 <strong>{{ list.length }}</strong> 样食材，<br />
        <strong>{{ timeLabel }}</strong>
      </p>
      <p v-if="pendingIngredients" class="note">{{ pendingIngredients }}</p>
      <p class="note">
        按依次做菜估算，可以穿插操作；提前准备所需的等待时间另算。
      </p>
      <p
        v-for="d in menu.filter((d) => d._meta?.time.preparations?.length)"
        :key="d.id"
        class="note"
      >
        <strong>{{ d.name }}需提前准备：</strong
        >{{ d._meta.time.preparations.join(" ") }}
      </p>
      <button
        class="primary full"
        @click="
          confirm = false;
          goStep(3);
        "
      >
        去看要买啥 →</button
      ><button class="text-button full" @click="confirm = false">
        再改改
      </button></Sheet
    >
    <Sheet
      v-if="copyFallback"
      title="长按全选，也能带走清单"
      @close="copyFallback = ''"
    >
      <textarea
        class="copy-area"
        :value="copyFallback"
        readonly
        @focus="$event.target.select()"
        aria-label="买菜清单纯文本"
      ></textarea>
    </Sheet>
  </div>
</template>
