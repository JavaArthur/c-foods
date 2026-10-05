import { isCustomDish } from "./custom-dishes.js";
export function matchesDiscovery(
  dish,
  { steamed = false, weightFriendly = false } = {},
) {
  if (isCustomDish(dish)) return !steamed && !weightFriendly;
  return (
    (!steamed || dish._meta?.discovery?.steamed === true) &&
    (!weightFriendly || dish._meta?.discovery?.weightFriendly === true)
  );
}
