<script setup>
import { computed, ref } from "vue";
import Sheet from "./Sheet.vue";
import DishImage from "./DishImage.vue";
import DishActions from "./DishActions.vue";
import CustomDishForm from "./CustomDishForm.vue";
import { state, dishById, portionLabel, deleteCustomDish } from "../lib/store";
import { isCustomDish } from "../lib/custom-dishes";
import { shoppingList, portionText } from "../lib/menu";
const props = defineProps({ dish: Object, ingredientsOnly: Boolean });
const emit = defineEmits(["close"]);
const mode = ref("view"),
  other = ref(null);
const dish = computed(
  () => dishById.value.get(other.value?.id || props.dish.id) || props.dish,
);
</script>
<template>
  <Sheet
    :title="ingredientsOnly ? '这道菜的食材' : dish.name"
    @close="$emit('close')"
  >
    <CustomDishForm
      v-if="mode === 'edit'"
      :dish="dish"
      @saved="mode = 'view'"
      @cancel="mode = 'view'"
      @existing="
        other = $event;
        mode = 'view';
      "
    />
    <div v-else-if="mode === 'delete'">
      <h3>删除「{{ dish.name }}」？</h3>
      <p>会移除这道自录菜和今晚菜单中的记录，过去的菜单仍保留菜名。</p>
      <button
        class="primary full"
        @click="
          deleteCustomDish(dish.id);
          emit('close');
        "
      >
        确认删除
      </button>
      <button class="text-button full" @click="mode = 'view'">先留着</button>
    </div>
    <template v-else>
      <template v-if="!ingredientsOnly"
        ><DishImage :dish="dish" eager />
      </template>
      <DishActions
        :dish="dish"
        @blocked="emit('close')"
        @added="emit('close')"
      />
      <template v-if="!ingredientsOnly">
        <div class="dish-management">
          <template v-if="isCustomDish(dish)">
            <button class="text-button" @click="mode = 'edit'">修改菜名</button>
            <button class="text-button danger" @click="mode = 'delete'">
              删除菜品
            </button>
          </template>
        </div></template
      >
      <div v-if="isCustomDish(dish)" class="custom-detail">
        <h3>自家菜 · 详情待补</h3>
        <p>目前只记下了菜名，食材、做法和用时还没填写。</p>
        <p class="note">
          可手动加入今晚菜单；暂不参与自动配菜和营养统计，无法核对完整食材的忌口信息。
        </p>
      </div>
      <template v-else>
        <div
          v-if="!ingredientsOnly && dish._meta?.discovery?.weightFriendly"
          class="discovery-note"
        >
          <strong>减脂友好</strong>
          <p>{{ dish._meta.discovery.reason }}</p>
          <p class="note">供成人选菜参考；宝宝仍按家庭分餐建议进食。</p>
        </div>
        <h3>{{ portionLabel }} · 备好这些</h3>
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
            open
          >
            <summary class="text-button">原文配料及供应商标注</summary>
            <p v-for="i in dish.ingredients" :key="i.name">{{ i.name }}</p>
          </details>
          <p class="note">
            购买酱油、蚝油、鸡精及加工肉等调味品或食材时，检查配料表并选择不含辣椒、花椒、胡椒、芥末的产品。
          </p>
          <h3>给宝宝分餐</h3>
          <p
            v-for="text in dish._meta?.nutrition.childNotes"
            :key="text"
            class="note"
          >
            {{ text }}
          </p>
          <p v-if="dish._meta?.recipe" class="note">
            {{ dish._meta.recipe.adaptation }}
          </p>
          <h3>跟着这样做</h3>
          <div v-if="dish._meta?.time" class="time-explanation">
            <strong
              >预计 {{ dish._meta.time.min }}–{{
                dish._meta.time.max
              }}
              分钟</strong
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
          <p v-if="dish.homeSubstitute" class="note">
            {{ dish.homeSubstitute }}
          </p>
        </template>
        <p class="source">
          <a :href="dish.sourceUrl" target="_blank" rel="noopener noreferrer"
            >{{
              dish.source === "cooklikehoc"
                ? "做法整理自 CookLikeHOC（老乡鸡菜品溯源报告）"
                : dish.source === "family"
                  ? "做法整理自公开菜谱 · " + dish._meta.recipe.author
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
          <span v-if="dish._meta?.recipe"
            >整理日期：{{ dish._meta.recipe.reviewedAt }}。{{
              dish._meta.recipe.portionBasis
            }}</span
          >
          <span v-if="dish.source === 'cooklikehoc'"
            >已按主料约 350g 换算为 2 人份基础配方，当前按备菜份量显示。</span
          >
        </p></template
      ></template
    ></Sheet
  >
</template>
