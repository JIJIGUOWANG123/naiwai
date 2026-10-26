# 奶娃启动器 · 官网静态站（HTML/）

纯静态产品站：没有框架、没有构建步骤、没有外部依赖。双击 `index.html` 就能看，
丢到任意静态托管（GitHub Pages / Cloudflare Pages / Vercel / Nginx / 对象存储）就能上线。

```
HTML/
├── index.html              页面结构（单页，含 Hero / 功能 / 分区展示 / 下载 / 更新日志 / FAQ / 社区）
├── changelog.html          更新日志独立页（页头/导航/页脚与首页同源，内容为 CHANGELOG.md 的静态镜像）
├── README.md               本文件
├── assets/
│   ├── css/style.css       全部样式（设计令牌 + 组件 + 三档断点 + 深色偏好）
│   ├── js/main.js          全部交互（下载链接配置、汉堡菜单、滚动淡入、手风琴）
│   └── img/                站点素材：logo.png + 五张应用截图（1440×900）
└── .preview/               验收截图与报告（可整目录删除，不参与线上部署）
```

---

## 一、改下载地址与版本号

**只改 `assets/js/main.js` 顶部这一块**，页面上所有下载按钮都由它渲染
（`VERSION` 只用来拼免安装包文件名，**不会渲染到页面**；页面上显示的版本号是 HTML 里静态写的 `.ver-tag`）：

```js
/** 当前版本号：只用于拼免安装包文件名，不渲染到页面 */
var VERSION = "0.5.4";

var REPO_URL      = "https://github.com/JIJIGUOWANG123/NaiWaLauncher";
var RELEASES_URL  = REPO_URL + "/releases";
var LATEST_DOWNLOAD = RELEASES_URL + "/latest/download";

var DOWNLOAD = {
  setup:    LATEST_DOWNLOAD + "/NaiWaLauncher-Setup.exe",                        // 安装版
  single:   LATEST_DOWNLOAD + "/NaiWaLauncher.exe",                              // 单文件版
  portable: LATEST_DOWNLOAD + "/NaiWaLauncher-" + VERSION + "-portable-x64.zip", // 便携版
  source:   RELEASES_URL,                                                        // Releases 页
  repo:     REPO_URL                                                             // 仓库首页
};
```

- 站点上**只有一个下载入口**：Hero 主按钮、导航「下载」、下载区按钮、页脚「下载」全部指向
  `https://github.com/JIJIGUOWANG123/NaiWaLauncher/releases`（即 `DOWNLOAD.source`）。
- 想换成自己的下载站？把 `DOWNLOAD.source` 换成你的地址即可，其余按钮跟着变。
- 把某一项留成 `"#"` 或空字符串，对应按钮会自动禁用并显示「即将上线」，**不会把用户送到 404**。
- 版本号：`VERSION` 只拼便携包文件名，**不渲染到页面**；站上显示的版本号（首页「最近三条」与
  `changelog.html` 里的 `.ver-tag`）是 **HTML 里静态写死**的，发版要手动改，两处都要同步。
  不要再加 `data-version` 元素——`hydrateVersion()` 只往 `[data-dl-file-name="portable"]` 写文件名。

### 页面里链接是怎么来的

HTML 上带 `data-dl="source|repo"` 的元素会被 `hydrateDownloads()` 补齐 `href`
（外部链接自动加 `target="_blank" rel="noopener noreferrer"`）。
新增一个下载按钮 = 在 HTML 里写 `<a class="btn" data-dl="source" href="#">…</a>`，不用改 JS。

---

## 二、本地预览

三种方式，任选一种：

1. **直接双击** `index.html`（file:// 也能跑，图标、字体、交互都正常）。
2. **起一个静态服务器**（推荐，行为最接近线上）：

   ```bash
   cd HTML
   npx serve .          # 或 python -m http.server 8080
   ```

   然后打开 http://localhost:8080/ 。

3. 已经装了 Node 的环境也可以 `npx http-server . -p 8080`。

---

## 三、部署

### 1. 任意静态托管

把 `HTML/` 里的内容（`index.html`、`assets/`）整体上传到站点根目录即可。
`.preview/` 与 `.verify/` 是本地验收产物，**不要上传**。

### 2. GitHub Pages

```bash
# 在仓库根目录
git subtree push --prefix HTML origin gh-pages
```

或在仓库 **Settings → Pages** 里把 Source 选成 `gh-pages` 分支 / 根目录。
发布后访问 `https://<用户名>.github.io/<仓库名>/`。

> 注意：站点里的下载链接指向 GitHub Releases，与 Pages 站点同域无关，不需要额外配置。

### 3. Nginx

```nginx
server {
    listen 80;
    server_name launcher.example.com;
    root /var/www/naiwa-html;      # HTML/ 里的内容
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源长缓存，HTML 不缓存（改了立即生效）
    location ~* \.(css|js|png|jpg|svg|webp|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }
    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    gzip on;
    gzip_types text/css application/javascript image/svg+xml;
}
```

### 4. 对象存储 / CDN

OSS / COS / R2 这类直接上传目录、把 `index.html` 设为默认首页即可，不需要服务端渲染。

---

## 四、更新日志页（`changelog.html`）

这一页与 `index.html` 共用同一套页头、导航、页脚和 `assets/js/main.js`，
内容区是**静态写死的 HTML**（来源：仓库根目录的 `CHANGELOG.md`）。

- 转换规则：`## 版本号` → 一张版本卡片、`###` → 卡片内小标题、`- ` → 列表项；只做转义，**不改内容**。
- 卡片结构：`article.clog-item` → `h2.clog-head > button.clog-btn`（`aria-expanded` + `aria-controls`）
  → `div.clog-panel > div.clog-body`。版本号在 `.ver-tag`，标题行副标题 `.clog-sub` 取该版本第一个小标题；
  小标题与副标题重复时给那个 `h3.clog-group` 加 `is-echo`，展开后不再重复显示。首页「最近三条」用同一套类名。
- **默认只展开第一条**（最新版）：只有它带 `is-open` + `aria-expanded="true"`，其余收起（`max-height:0`）。
  点标题行展开/收起，高度由 `main.js` 量 `scrollHeight` 设 `max-height`
  （Chromium 140 上 `grid-template-rows: 0fr→1fr` 实测不生效，不要换回去）。
- 右上角「全部展开 / 全部收起」（`#clog-expand-all` / `#clog-collapse-all`），只作用于 `.clog-item`。
- 页面顶部有一行「完整历史见 GitHub：CHANGELOG.md」，指向仓库里的原文。
- **为什么不做动态拉取**：本站 CSP 是 `default-src 'self'`，页面自己也承诺不发外部请求；
  用 `fetch()` 去拉 GitHub 会同时踩 CSP、CORS 与国内网络不稳三个坑，静态写入一次最稳。
- 如果以后确实要改成运行时拉取，需要**同时**放宽两处：
  1. `<meta http-equiv="Content-Security-Policy">` 的 `connect-src` 放行目标域名
     （例如 `connect-src 'self' https://raw.githubusercontent.com`，当前只有 `'self'`）；
  2. 目标地址要允许跨域（raw.githubusercontent.com 允许；api.github.com 有速率限制）。
- 改完 `CHANGELOG.md` 后要重新生成这一页：替换 `<div class="clog" id="clog-list">…</div>` 里的内容即可，
  导航与页脚不用动（导航里的「更新日志」在首页是指向 `changelog.html` 的链接，在本页高亮自己）。

---

## 五、内容与配置清单（部署前逐项确认）

| 位置 | 内容 | 状态 |
| --- | --- | --- |
| `main.js` → `DOWNLOAD.source` | GitHub Releases 地址 | 已配置 |
| `main.js` → `REPO_URL` | `https://github.com/JIJIGUOWANG123/NaiWaLauncher` | 已配置 |
| `main.js` → `VERSION` | `0.5.4`（只用于便携包文件名，不渲染到页面） | 已配置 |
| 页脚 | ICP 备案号 / 公网安备 | **待填写**（`<span class="beian-placeholder">`） |
| 社区区 | GitHub 仓库 / Releases / 交流群（QQ 群 619915692） | 已配置（麦块社区卡片已按要求移除） |
| `<head>` | `og:image` 用的是相对路径 `assets/img/home.png` | 建议上线后改成绝对 URL |

> `og:image` 必须是**绝对 URL**（`https://你的域名/assets/img/home.png`），部分平台不解析相对路径。

---

## 六、设计说明

- **配色**：主色玫红 `#cb2245` / `#ed4661`，点缀暖金 `#ecb85d` / `#f2d495`；
  底色近白 `#fffdfc`，正文 `#17151a`，次要文字 `#6c6772`。全部收敛在 `style.css` 顶部的 CSS 变量里。
- **字体**：默认走系统字体栈（`Inter → Segoe UI → PingFang SC → Microsoft YaHei`），离线也好看。
  想用 Inter CDN，在 `index.html` `<head>` 里取消那一行注释即可；
  **记得同时把 Content-Security-Policy 的 `style-src` / `font-src` 加上 `https://fonts.googleapis.com https://fonts.gstatic.com`**，否则会被 CSP 拦掉。
- **布局**：容器最大 1160px；Hero 居中 + 叠层截图；功能为 9 张编号卡片（3×3）；
  分区展示左右交替；下载区单按钮居中；更新日志用折叠卡片、FAQ 用手风琴（同一套 JS）；社区为链接卡。
- **断点**：`>1024px` 桌面三栏、`≤1024px` 两栏 + 汉堡菜单、`≤768px` 单栏、`≤480px` 紧凑排版。
  任意宽度都保证 `scrollWidth ≤ clientWidth`（无横向滚动）。
- **深色偏好**：`@media (prefers-color-scheme: dark)` 覆盖一套配色；浅色始终是默认且优先。
- **无障碍**：`lang="zh-CN"`、语义标签、跳转到主内容的 skip link、`:focus-visible` 焦点环、
  手风琴用 `aria-expanded`/`aria-controls`、汉堡按钮 `aria-expanded`、Esc 可收起菜单。
- **动效**：滚动到视口淡入（IntersectionObserver，带滚动兜底扫描）、
  `prefers-reduced-motion: reduce` 时全部关闭。

---

## 七、验收脚本（可选，仅本地用）

`.verify/verify.js` 是一个无头 Electron 脚本：加载 `index.html` 与 `changelog.html`、收集控制台输出、
跑 DOM 断言、按 1440 / 820 / 390 三档整页截图到 `.preview/`（另出一张 `changelog.html` 的整页图）。

```powershell
# 在仓库根目录
Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Start-Process -FilePath "node_modules\electron\dist\electron.exe" `
  -ArgumentList "HTML\.verify\verify.js" -Wait
Get-Content "HTML\.preview\report.json"
```

要点：脚本会把 `scroll-behavior` 临时改成 `auto`，否则程序化滚动会被平滑动画拖住，
导致整页没滚到底、误判「内容没淡入」。Electron 是 GUI 子系统，stdout 不可靠，
所以结果写进 `.preview/report.json` 与 `.preview/progress.log`。
