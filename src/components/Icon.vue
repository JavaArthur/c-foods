<script setup>
import {
  PhCookingPot,
  PhBookOpen,
  PhHeart,
  PhUser,
  PhArrowLeft,
  PhArrowRight,
  PhArrowsClockwise,
  PhLockSimple,
  PhLockSimpleOpen,
  PhX,
  PhCheck,
  PhClock,
  PhUsers,
  PhSlidersHorizontal,
  PhMagnifyingGlass,
  PhPlus,
  PhMinus,
  PhLeaf,
  PhBowlFood,
  PhProhibit,
} from "@phosphor-icons/vue";
defineProps({ name: String, size: { default: 22 } });
const icons = {
  pot: PhCookingPot,
  book: PhBookOpen,
  heart: PhHeart,
  user: PhUser,
  left: PhArrowLeft,
  right: PhArrowRight,
  refresh: PhArrowsClockwise,
  lock: PhLockSimple,
  unlock: PhLockSimpleOpen,
  close: PhX,
  check: PhCheck,
  clock: PhClock,
  users: PhUsers,
  filter: PhSlidersHorizontal,
  search: PhMagnifyingGlass,
  plus: PhPlus,
  minus: PhMinus,
  leaf: PhLeaf,
  bowl: PhBowlFood,
  block: PhProhibit,
};
</script>
<template>
  <component
    :is="icons[name] || icons.pot"
    :size="size"
    weight="regular"
    aria-hidden="true"
  />
</template>
