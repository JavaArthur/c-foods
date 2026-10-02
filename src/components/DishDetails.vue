<script setup>
import Sheet from "./Sheet.vue";
import DishImage from "./DishImage.vue";
import { state, favorite, addDish } from "../lib/store";
import { shoppingList, portionText } from "../lib/menu";
defineProps({ dish: Object, ingredientsOnly: Boolean });
defineEmits(["close"]);
</script>
<template>
  <Sheet
    :title="ingredientsOnly ? '这道菜的食材' : dish.name"
    @close="$emit('close')"
    ><template v-if="!ingredientsOnly"
      ><DishImage :dish="dish" />
      <div class="detail-actions">
        <button class="secondary" @click="favorite(dish.id)">
          {{
            state.favorites.includes(dish.id) ? "♥ 已收藏" : "♡ 想再吃"
          }}</button
        ><button
          class="primary"
          @click="
            addDish(dish);
            $emit('close');
          "
        >
          加入今晚菜单
        </button>
      </div></template
    >
    <h3>{{ state.settings.servings }} 人份 · 备好这些</h3>
    <ul class="ingredient-detail">
      <li
        v-for="i in shoppingList([dish], state.settings.servings)"
        :key="i.key"
      >
        <span>{{ i.name }}</span
        ><strong>{{ i.quantity }}</strong>
      </li>
    </ul>
    <template v-if="!ingredientsOnly"
      ><details
        v-if="dish.source === 'cooklikehoc'"
        class="original-seasonings"
      >
        <summary class="text-button">原文配料及供应商标注</summary>
        <p v-for="i in dish.ingredients" :key="i.name">{{ i.name }}</p>
      </details>
      <h3>跟着这样做</h3>
      <div v-if="dish._meta?.time" class="time-explanation">
        <strong
          >预计 {{ dish._meta.time.min }}–{{ dish._meta.time.max }} 分钟</strong
        >
        <p>{{ dish._meta.time.basis }}</p>
        <p v-if="dish._meta.time.note">{{ dish._meta.time.note }}</p>
        <template v-if="dish._meta.time.preparations?.length">
          <strong>提前准备</strong>
          <p v-for="text in dish._meta.time.preparations" :key="text">
            {{ text }}
          </p>
        </template>
      </div>
      <ol class="preview-steps">
        <li v-for="(s, i) in dish.steps" :key="i">
          {{ portionText(s.text, state.settings.servings / dish.servings) }}
        </li>
      </ol>
      <p v-if="dish.tips" class="note">{{ dish.tips }}</p>
      <p v-if="dish.homeSubstitute" class="note">{{ dish.homeSubstitute }}</p>
      <button
        class="text-button"
        @click="
          state.settings.blacklist.push(dish.id);
          $emit('close');
        "
      >
        这道暂时不推荐给我
      </button></template
    >
    <p class="source">
      <a :href="dish.sourceUrl" target="_blank" rel="noopener noreferrer"
        >{{
          dish.source === "cooklikehoc"
            ? "做法整理自 CookLikeHOC（老乡鸡菜品溯源报告）"
            : "做法来自 HowToCook"
        }}
        ↗</a
      ><br /><span v-if="dish._meta?.image.kind === 'illustration'"
        >配图为 AI 生成的菜品示意插画，仅用于辨认菜品。</span
      >
      <a
        v-else-if="dish._meta?.image.sourceUrl"
        :href="dish._meta.image.sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{
          dish._meta.image.sourceUrl.includes("CookLikeHOC")
            ? "图片来自 CookLikeHOC · 仅供非商业学习"
            : "图片来自 HowToCook"
        }}
        ↗
      </a>
      <span v-if="dish.source === 'cooklikehoc'"
        >已按主料约 350g 换算为 2 人份基础配方，当前按人数显示。</span
      >
    </p></Sheet
  >
</template>
