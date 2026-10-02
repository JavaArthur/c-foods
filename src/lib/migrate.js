// 合并菜谱时迁移用户选项；旧做菜步骤与新菜谱不同，重置其进度和计时。
export function migrateRecipeIds(state, redirects) {
  const id = (value) => redirects[value] || value;
  const ids = (values) => [...new Set((values || []).map(id))];
  state.favorites = ids(state.favorites);
  state.settings.blacklist = ids(state.settings.blacklist);
  if (state.today) state.today.ids = ids(state.today.ids);
  state.history = state.history.map((h) => ({ ...h, ids: ids(h.ids) }));
  for (const [old, current] of Object.entries(redirects)) {
    if (old in state.settings.classification) {
      state.settings.classification[current] ??=
        state.settings.classification[old];
      delete state.settings.classification[old];
    }
    delete state.progress[old];
    for (const key of Object.keys(state.timers)) {
      if (key === old || key.startsWith(old + ":")) delete state.timers[key];
    }
  }
}
