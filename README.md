# 今晚吃什么 🍳

给忙碌的家人准备一桌热乎饭：选搭配 → 看菜单 → 买菜 → 做菜。全站简体中文，手机优先，个人数据只存本机，不需要注册或登录。

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

- 六种搭配入口，自定义荤素各 0–5 道，总数至少 1；约 0.6 秒配菜反馈。
- 单道换菜、整桌换菜、锁定、左滑换菜、底部菜谱预览、确认菜单。
- 今日菜单自动恢复，收藏和按日期倒序的历史菜单，可再做一桌。
- 食材按人数缩放，同名合并、来源标注，常备调料默认折叠；勾选持久化和微信纯文本复制。
- 一屏一步的做菜模式、滑动翻步、倒计时、振动与提示音、Screen Wake Lock、做菜进度保存。
- 按烹饪方式和时间推荐做菜顺序；耗时为逐道时间之和，避免承诺并行烹饪一定更快。
- 荤素库、菜名搜索、主料/口味筛选、手动加菜、黑名单、人数、忌口/过敏和辣度设置。
- PWA 离线菜谱、错误重试、骨架屏、空状态、底部安全区、减少动态效果。

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

当前快照 **256 道：164 道荤菜、92 道素菜**。HowToCook 187 道，CookLikeHOC 69 道。同名做法优先 HowToCook，图片优先 CookLikeHOC；即使补充库的做法无法解析，仍可为主库同名菜提供图片。

`data/build-report.json` 保存上游 commit SHA、每道菜的来源路径、缩放比例、未定量原料、合并记录和跳过原因。含参数化计算公式、缺少主料克数等不能可靠转换的条目会跳过，绝不生成臆造做法或份量。更新后应检查报告与 `git diff public/data/dishes.json`。数量不足荤素各 30 道时脚本失败并保留旧 JSON。

### 家庭份量

1. HowToCook 优先读取「计算」里的原料用量，保留原文可识别的基准用餐人数；未声明人数的家庭份量以 2 人作为界面基准，可在 overlays 修正。
2. CookLikeHOC 从步骤提取克数，与原料表对应；只纳入主料均有可核实用量的配方。
3. `缩放比例 = 350g / 原配方肉类与蔬菜主料总克数`，统一为 2 人份。所有质量/体积用量同步缩放；每次下料取到最接近的 5g/5ml，小量最低保留 5，清单按分次下料相加，与步骤一致。调料小量取整会影响风味，实际可少量酌加。
4. 原文未写清的非主料用量用 `amount: null, unit: "适量"` 表示，页面显示「按原文适量」，不会虚构精确值。标准字段名称不变；这是对真实来源中未知用量的显式表示。
5. 同名不同单位如「姜 2片 + 5g」保留并列，因为原文没有每片重量。数量范围取上限用于备料，做法保留原文范围。
6. 商用复合调味料保留原名及供应商，可在详情展开「原文配料及供应商标注」查看；`homeSubstitute` 单独标明「家庭替代建议」，不会写进原文步骤。

步骤里的时间、温度不跟人数缩放。倒计时支持数字、常见中文数字和时间范围；同一步出现多个时长时以最长时长显示按钮。烹饪时间和难度优先读取原文，否则按步骤时间和烹饪方式估算。

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

配菜始终遵守忌口、过敏关键词、辣度与黑名单；首先避开最近 3 天和重复主料，然后依次放宽近期限制、主料限制。候选仍不足时显示可用菜单及说明，不会用禁忌食材凑数。收藏权重为普通菜的 1.35 倍。

### 图片策略

**图片使用 jsDelivr 远程地址**，不把大量图片下载进项目。浏览器缓存最近看过的图片；图片失败或离线没有图片时，显示浅色底和菜名首字。应用外壳和完整菜谱 JSON 会预缓存，第一次在线成功打开后可离线做菜。运行时不请求 GitHub API 或 raw 域名。

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
