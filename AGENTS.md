# 项目约定

本文件是本项目规则的 canonical 入口。`AGENT.md` 只保留兼容链接。

## 产品与技术

- 产品是面向家庭做饭的「今晚吃什么」，全站简体中文。主线为选搭配 → 看菜单 → 买菜 → 做菜。
- Vue 3 Composition API、Vite、Tailwind CSS、vue-router hash 路由；纯静态 PWA，无账号、后端或数据库。
- 手机基准 375×667，桌面容器最大 480px；一荤一素两张菜单卡在一屏显示。点击区域至少 44px，正文最小 14px，做菜步骤最小 22px。
- 用户偏好、收藏、历史、菜单、勾选、计时仅保存在 localStorage。去重或改 ID 时必须迁移旧记录。

## 数据契约

- 做法只允许来自 `Anduin2017/HowToCook@master` 和 `Gar-b-age/CookLikeHOC@main`。收录目录以 `scripts/build-data.mjs` 为准，不编造步骤、食材用量。
- `public/data/dishes.json` 保持原有字段结构；图片出处、示意标记、估时依据和旧 ID 映射放在 `public/data/dish-meta.json`。
- `data/overlays.json` 为字段人工覆盖表；`data/recipe-aliases.json` 为确认过的同菜别名；`data/time-overrides.json` 为有依据的用时修正。
- 同名菜保留 HowToCook 做法，优先补充库成品图。相近名称需核对主料和方法，不能仅凭字符串相似度合并。
- 图片必须保存在 `public/images/`；真实图片出处和生成插画提示词见 `data/image-manifest.json`。插画明确标记「示意图」，不冒充菜谱原图。
- 用时是家庭规划估算；区分提前腌制、泡发、解冻等准备，详情保留依据。单步倒计时来自原文，支持中文数词、区间和复合时长。
- 老乡鸡按主料总重缩放为约 350g、两人份；各次下料取整至 5g 后合并。未知用量保留未知。展示出处和非商业用途说明，家庭替代建议单独标记。
- 同桌不能重复菜；忌口、过敏、辣度、黑名单是硬约束。近期吃过、主料相同才允许逐级放宽。

## 文件和验证

- 数据入口：`scripts/build-data.mjs`，解析器：`scripts/recipe-parser.mjs`，估时：`scripts/recipe-time.mjs`。
- 配菜与清单逻辑：`src/lib/menu.js`；本地状态：`src/lib/store.js`。
- 安装启动：`npm install`、`npm run dev`。更新数据：`npm run data:build`。
- 完成改动后运行相称检查：`npm test`、`npm run build`；交互、布局或持久化变更运行 `npm run test:e2e`。
- 图片、源数据变更需检查文件可解码、引用完整、署名完整；菜单与详情需在 375px 宽度验证。
- 不提交缓存、测试输出、临时截图或凭据；保留用户现有文件。

## 部署

- GitHub 仓库：<https://github.com/JavaArthur/c-foods>。
- 当前站点：<https://javaarthur.github.io/c-foods/>，工作流 `.github/workflows/deploy.yml`。
- Cloudflare Pages 构建命令 `npm run build`，产物 `dist`；子目录部署时设置 `BASE_PATH`。
- 部署事实以工作流和线上探测结果为准，不仅凭本地构建成功声称上线。
