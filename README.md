# 今晚吃什么 🍳

给忙碌的家人准备一桌热乎饭：选搭配 → 看菜单 → 买菜 → 做菜。全站简体中文，手机优先，个人数据只存本机，不需要注册或登录。

首页还可切换「早餐」「饮品」：早餐初始为空，添加名称后支持随机、改名和删除；饮品提供18款有出处的家常配方，可分类、搜索、随机选一杯及查看做法。两个模块独立保存，不进入晚餐菜单及营养统计。饮品按完整食材匹配忌口，早餐只按已录名称匹配。

饮品源数据位于 `data/drink-recipes.json`，可用 `node scripts/drink-data.mjs` 单独编译，或随 `npm run data:build` 一起生成。配方保留原方份量，不随晚餐人数缩放；离线安装后仍可使用早餐和饮品模块。

**在线体验：[今晚吃什么](https://javaarthur.github.io/c-foods/)** · **[GitHub 仓库](https://github.com/JavaArthur/c-foods)**

**技术栈：** Vue 3 Composition API、Vite、Tailwind CSS 4、vue-router hash 路由。没有后端或数据库，没有付费接口。

## 本地运行

需要 Node.js 22（建议使用当前维护的 22.x）和 npm。

```bash
npm install
npm run dev
```

访问终端显示的地址，默认 `http://localhost:5173`。已经提交生成好的 `public/data/dishes.json`，本地运行和部署构建都不用下载 GitHub 菜谱。

```bash
npm run build     # 生成 dist，包含 manifest、图标和 service worker
npm run preview   # 本地预览生产包
npm test          # 数据、份量、配菜规则测试
npx playwright install chromium
npm run test:e2e  # 375×667 浏览器交互测试
```

生产包验证（先在一个终端启动 `npx vite preview --host 127.0.0.1 --port 4173`）：

```bash
node scripts/check-production.mjs
```

PowerShell 5 不支持 `&&` 时，把安装和启动命令分两行执行即可。

## 已有功能

- 六种搭配入口，自定义荤菜 0–5 道、素菜 1–5 道；每餐保留一道绿叶菜，配菜即点即出。
- 单道换菜、整桌换菜、锁定、左滑换菜、底部菜谱预览、确认菜单。
- 今日菜单自动恢复，收藏和按日期倒序的历史菜单，可再做一桌。
- 食材按备菜份量缩放，同名合并、来源标注，买菜分组默认展开；勾选持久化和微信纯文本复制。
- 当前菜的食材、准备事项和全部步骤同页展开，支持标记当前步骤、步骤计时、Screen Wake Lock 和进度保存。
- 底栏厨房计时器支持多个独立倒计时；新启动或点选的计时立即显示在顶部大卡片，其他计时紧凑列出。支持分钟秒数输入、暂停续计、加时和自定义常用时长，切页和刷新后恢复。
- 计时到期使用增强双音提醒，重复约 15 秒；全站提示条可提前停止响铃，计时页可试听。锁屏或浏览器挂起可能延迟提醒，实际响度取决于设备媒体音量。
- 按烹饪方式和时间推荐做菜顺序；耗时为逐道时间之和，避免承诺并行烹饪一定更快。
- 荤素库、菜名搜索、主料/口味筛选、手动加菜、黑名单、备菜份量、忌口/过敏设置；全库无辣，默认两大一小（宝宝3岁）。
- 可折叠的这餐搭配、宝宝分餐提示、近七天晚餐食材多样性；全天安排参照中国居民膳食指南，不显示未经计算的营养达标分数。
- 菜库每批 24 道，非首页路由按需加载；PWA 离线菜谱、错误重试、骨架屏、空状态、底部安全区、减少动态效果。
- 菜单、菜库、收藏、做菜列表及详情都有拉黑入口，从展示和推荐中立即隐藏；在「我的 → 已拉黑菜品」恢复。拉黑会移出今晚菜单并要求重新确认，历史记录和收藏关系仍保留。
- 130 道无辣菜谱，新增 50 道署名公开配方及本地示意插画。菜库支持「蒸菜」「减脂友好」叠加筛选，人工审核理由保存在 `data/dish-tags.json`；减脂分类仅供成人选菜参考。
- 「菜谱库 → 录入菜品」只需填写菜名，在「我录入的」中查看、改名或删除。自录菜可手动加入今晚、收藏和标记做完；食材、做法和用时待补，不参与自动配菜或营养统计，不能代替已确认的绿叶菜。整桌换菜保留自录菜，买菜清单会列出待补食材的菜名。
- 自录菜与黑名单保存在本设备的 `dinner-v1`，刷新及离线可用；删除自录菜仍保留历史菜名。清除本地数据会一并清除这些记录。

## 更新真实菜谱

```bash
npm run data:build
npm test
npm run build
```

构建脚本在本地或 CI **主动更新数据时**访问以下 API：

- `https://api.github.com/repos/Anduin2017/HowToCook/git/trees/master?recursive=1`
- `https://api.github.com/repos/Gar-b-age/CookLikeHOC/git/trees/main?recursive=1`

Markdown 优先走 `raw.githubusercontent.com`，失败/限流后重试 jsDelivr。六路并发下载，按文件 SHA 缓存在 `.cache/md`。公共 API 无需登录；如遇 API 配额限制，可选用 `GITHUB_TOKEN`，脚本只把它发给 GitHub API，不会写入前端或仓库。

### 目录范围与解析

HowToCook 仅收录 `dishes/meat_dish`、`dishes/aquatic`、`dishes/vegetable_dish`。CookLikeHOC 仅检查 `炒菜`、`蒸菜`、`炖菜`、`凉拌`、`汤`、`卤菜`、`烫菜`、`煮锅`、`砂锅菜`，并排除误放在这些目录里的饭、米线等主食。

编写解析器前实际阅读了 HowToCook 的宫保鸡丁、蒜蓉西兰花、徽派红烧肉，以及 CookLikeHOC 的农家小炒肉、什锦蛋炒饭、西红柿炒鸡蛋。解析同时兼容「配料 / 原料」「步骤 / 步骤：」、带序号的无序列表、嵌套供应商括号、分数和数量范围。

当前家庭无辣快照 **80 道：43 道荤菜、37 道素菜**。HowToCook 50 道、CookLikeHOC 20 道、经查证整理的家庭配方 10 道（其中 1 道为 HowToCook 的明确无辣改编）。绿叶素菜覆盖 14 个食材标签；按烹饪选用名称计，部分属于同类叶菜的不同品种。同名做法优先 HowToCook，图片优先 CookLikeHOC。已合并 7 个确认过的别名或设备版本，映射见 `data/recipe-aliases.json`；旧收藏、黑名单和历史 ID 会自动迁移。不同地区的红烧肉等做法保留，但 `data/recipe-families.json` 中的同款菜不会同时出现在一桌，放宽主料限制时也遵守。

`data/build-report.json` 保存上游 commit SHA、每道菜的来源路径、缩放比例、未定量原料、合并记录和跳过原因。含参数化计算公式、缺少主料克数等不能可靠转换的条目会跳过，绝不生成臆造做法或份量。更新后应检查报告与 `git diff public/data/dishes.json`。数量不足 20 道荤菜、30 道素菜或 8 个绿叶菜标签时脚本失败并保留旧 JSON。

### 家庭份量

1. HowToCook 优先读取「计算」里的原料用量，保留原文可识别的基准用餐人数；未声明人数的家庭份量以 2 人作为界面基准，可在 overlays 修正。
2. CookLikeHOC 从步骤提取克数，与原料表对应；只纳入主料均有可核实用量的配方。
3. `缩放比例 = 350g / 原配方肉类与蔬菜主料总克数`，统一为 2 人份。所有质量/体积用量同步缩放；每次下料取到最接近的 5g/5ml，小量最低保留 5，清单按分次下料相加，与步骤一致。调料小量取整会影响风味，实际可少量酌加。
4. 原文未写清的非主料用量用 `amount: null, unit: "适量"` 表示，页面显示「按原文适量」，不会虚构精确值。标准字段名称不变；这是对真实来源中未知用量的显式表示。
5. 同名不同单位如「姜 2片 + 5g」保留并列，因为原文没有每片重量。数量范围取上限用于备料，做法保留原文范围。
6. 不发布含辣椒、花椒、胡椒、芥末等刺激调味以及成分不明专用调味料的配方。标准调味品和加工肉仍需按详情提示选择无刺激配料产品。原材料供应商可在详情展开查看；家庭改编内容单列，不冒充原文。

步骤里的时间、温度不跟人数缩放。倒计时支持完整中文数词、范围和复合时间（如“三十分钟”“两个半小时”“3分40秒”）；同一步出现多个独立时长时以最长时长显示按钮。页面用时是**家庭预计范围**，并非实测承诺。`scripts/recipe-time.mjs` 对照原文概述与步骤，预留切配和烧水时间；复杂、累计或替代分支的计时由 `data/time-overrides.json` 修正并记录依据。泡发、腌制、冷藏等提前准备在卡片、详情和确认弹层中提示。整桌按依次制作相加，前置等待另算。

`public/data/dishes.json` 保持既定字段结构，`cookTimeMinutes` 保存估时上限以便排序；范围、依据、图片出处与旧 ID 映射放在 `public/data/dish-meta.json`。用时覆盖请编辑 `data/time-overrides.json`，不要只修改 `overlays.json` 中的旧用时字段。

### 人工修正

编辑 `data/overlays.json` 后重新运行 `npm run data:build`：

```json
{
  "proteinDefaults": { "egg": false, "tofu": false },
  "dishes": {
    "蒜蓉西兰花": {
      "isMeat": false,
      "servings": 2,
      "cookTimeMinutes": 15,
      "mainIngredients": ["西兰花"]
    }
  }
}
```

`dishes` 按菜名覆盖标准字段。鸡蛋、豆腐默认算素，也可在网站「我的」里逐道调整，只改变本机偏好。补齐被跳过的复杂菜谱时，需要先让解析器可靠识别其原文配方，再用覆盖表校准字段。

配菜始终遵守无辣、忌口/过敏、黑名单、至少一道绿叶菜和同桌不重复；先避开最近 3 天和重复主料，再依次放宽近期限制、主料限制。优先肉配蔬菜/菌菇/豆制品、鱼禽和蒸煮炖，并按近七天已确认菜单降低重复蛋白、食材、做法权重。收藏权重为同条件普通菜的 1.2 倍。候选不足给出说明，锁定菜不会被擅自替换。

### 图片策略

**80 道发布菜谱全部使用项目内的 WebP 图片**，保存于 `public/images/`。其中 47 张取自指定原仓库，33 张为逐道生成的菜品插画，图片不叠加文字角标，详情底部说明 AI 生成；详情图片按原比例完整显示。原图 URL、生成工具和每张插画的完整提示词保存在 `data/image-manifest.json`。插画不作为做法或成品真实性依据。

原图下载脚本为 `node scripts/download-images.mjs`，优先 raw、失败重试 jsDelivr，缩放至最长边 640px。Markdown 图片解析兼容括号文件名，优先命名成品图，避免把第一张备料图当成菜图。更新菜库遇到新增图片记录或文件缺失时，`data:build` 会中止，需先补齐图片和来源记录，防止发布空图。

应用外壳、完整菜谱和元数据预缓存；图片同源按需缓存，收藏和已确认菜单图片后台补缓存。首次在线完成缓存后，离线可看全部文字做法和已缓存图片；未缓存图片显示首字兜底。版本激活时清理旧图片缓存。正常使用不请求 GitHub 或图片 CDN。

新增家庭配方见 `data/family-recipes.json`，记录作者、链接、整理日期、实际步骤和改编。增删及分类修正清单见 `data/family-report.json`；来源元数据、下架名称和原因在 `public/data/dish-meta.json`。旧收藏和当前菜单移除下架菜，历史保留名称；受影响菜单必须重新确认。重新构建不会恢复被筛除的菜谱。

生产构建后可运行 `node scripts/verify-offline.mjs` 验证子目录离线主流程；传入旧版产物路径可验证真实升级与缓存清理：`node scripts/verify-offline.mjs path/to/previous/dist`。性能测量运行 `node scripts/measure-performance.mjs`。

项目维护规则见 [AGENTS.md](AGENTS.md)，[AGENT.md](AGENT.md) 是兼容入口。

## 家庭无辣版检查结果（2026-10-04）

从原库下架 179 道含刺激调味或无法确认复合配料的菜，新增 8 道复合荤菜和茼蒿、芥蓝两道叶菜。全部保留来源及改编记录。19 项单元/数据检查、9 项手机流程、生产构建、真实旧版升级及离线主流程均通过；375×667 的两张菜单卡与搭配说明入口完整可见。

本机同设备、10 Mbps / 40 ms 延迟，三次冷启动的中位数：

| 指标 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 首页可操作 | 1,728 ms | 1,211 ms |
| 点击配菜到菜单出现 | 828 ms | 16 ms |
| 菜库打开 | 326 ms | 295 ms |
| 首屏资源下载量（未压缩） | 1.26 MiB | 0.57 MiB |
| PWA 预缓存 | 12.50 MiB | 0.60 MiB |

原始测量、验证范围见 [检查记录](docs/family-verification-2026-10-04.json)，完整增删清单见 [菜库变更](data/family-report.json)。以上为 2026-10-04 的本地生产包验证记录，当时尚未发布；后续版本变化见 [更新记录](CHANGELOG.md)。

## 首选：Cloudflare Pages

1. 把项目推送到 GitHub，或使用本项目仓库。
2. Cloudflare 控制台 → Workers & Pages → Create application → Pages → Import an existing Git repository。
3. 连接 GitHub 仓库，生产分支选择 `main`。
4. 构建命令 **`npm run build`**，输出目录 **`dist`**。Node.js 版本设为 22。
5. 根域部署无需设置 `BASE_PATH`。如部署到子目录，把 `BASE_PATH` 设置成 `/目录名/`。
6. 部署后打开 HTTPS 的 `*.pages.dev` 地址即可，不需要登录网站。

纯静态站点用 Cloudflare 免费版就够了。以后如果要做云同步等动态功能，可使用 Pages Functions / KV / D1；先评估免费额度，再按需升级 **5 美元/月起的 Workers 付费套餐**，用量超过套餐额度会另外计费。本项目未开通任何付费服务。

依据：[Cloudflare Vue 部署文档](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vue-site/)、[Pages Functions 计费](https://developers.cloudflare.com/pages/functions/pricing/)、[Workers 计费](https://developers.cloudflare.com/workers/platform/pricing/)。

## 备选：GitHub Pages

项目自带 `.github/workflows/deploy.yml`：测试 → 构建 → 上传静态产物 → 部署。

1. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
2. 推送 `main`，或在 Actions 手动运行 Deploy GitHub Pages。
3. 访问 `https://<用户名>.github.io/<仓库名>/`。

工作流自动设置 `BASE_PATH=/<仓库名>/`。hash 路由的地址形如 `/#/recipes`，刷新不会走服务器子路径，也不会 404。使用根域、自定义域或 `<用户名>.github.io` 仓库时，把工作流的 `BASE_PATH` 改为 `/`。

本项目已部署到 **https://javaarthur.github.io/c-foods/**，可直接打开体验。Cloudflare Pages 尚未连接，按上面的首选方案连接此仓库即可部署到自己的 Cloudflare 账户。

## 添加到手机桌面

- iPhone Safari：分享 → 添加到主屏幕。
- 安卓 Chrome：浏览器菜单 → 安装应用 / 添加到主屏幕；支持安装提示的浏览器也可从「我的」进入。
- PWA、复制和 Wake Lock 需要 HTTPS 或 localhost。Wake Lock 不支持/被系统拒绝时静默跳过；设备支持振动时才会振动。声音需浏览器允许播放，计时按钮会在用户手势中启动音频上下文。
- 手机系统可能在应用进入后台后暂停页面；计时使用绝对结束时间，回到做菜模式会校准，不用逐秒递减来计算剩余时间。

## 目录

```text
src/
  components/      # 菜卡、抽屉、成品图、图标
  views/           # 四步主线、菜谱库、收藏、我的、厨房
  lib/menu.js      # 配菜、合并清单、份量、推荐顺序
  lib/store.js     # 本地状态、今日菜单、历史记录
scripts/
  build-data.mjs   # GitHub API + Markdown 构建入口
  recipe-parser.mjs
  check-production.mjs
data/
  overlays.json
  build-report.json
public/
  data/dishes.json
  icons/           # 192px / 512px 占位图标
tests/             # 规则测试 + Playwright 浏览器测试
.github/workflows/deploy.yml
```

## 数据来源与版权

- **HowToCook**：[Anduin2017/HowToCook](https://github.com/Anduin2017/HowToCook)，`master`。遵循上游 [Unlicense](https://github.com/Anduin2017/HowToCook/blob/master/LICENSE)，允许商业使用。
- **CookLikeHOC**：[Gar-b-age/CookLikeHOC](https://github.com/Gar-b-age/CookLikeHOC)，`main`。做法整理自 CookLikeHOC（老乡鸡菜品溯源报告）。它是非官方整理仓库，未声明开源许可证。本项目包含该来源的数据和图片引用，**仅按非商业学习用途交付**；无许可证不等于授予商业或其他再使用许可。商业版本须移除该来源内容或取得相应授权。
- 所有菜谱保留 `sourceUrl`，详情可打开原文；家庭替代建议与原做法分开。界面代码与两库内容的权利归属分开，不能把第三方菜谱当作本项目原创。
- 无账户、无分析埋点。个人数据只存在当前浏览器的 `localStorage`。清除浏览器站点数据会一起清除记录。

## 验收记录

见 [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)。截图来自实际运行的生产包，保存在 `docs/screenshots/`。
