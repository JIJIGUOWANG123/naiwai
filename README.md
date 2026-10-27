# 咕咕启动器 · Gugu Launcher 官网

纯静态站点：没有构建步骤、没有 npm 依赖、没有任何 CDN 引用，双击 `index.html` 或丢到任意静态服务器就能跑，完全离线可用。

- 仓库：https://github.com/JIJIGUOWANG123/Gugu-Launcher
- 发布渠道：**只有 GitHub Releases** —— https://github.com/JIJIGUOWANG123/Gugu-Launcher/releases/latest
- 页面：`index.html`（首页）、`changelog.html`（更新日志）

## 目录结构

```
静态网页/
├── index.html            首页：Hero / 特性 / 界面预览 / 下载
├── changelog.html        更新日志（当前只有 v1.0.0 一条，手风琴，最多留 5 条）
├── .nojekyll             GitHub Pages 用：禁用 Jekyll 处理
├── README.md             本文件
└── assets/
    ├── css/style.css      全部样式（主题变量在这里）
    ├── js/main.js         主题切换、手风琴、灯箱、版本号注入（VERSION 在这里）
    └── img/               截图 + logo.png（站内标识）+ favicon.ico（本地副本，不引用站外图片）
```

## 本地预览

直接双击 `index.html` 即可。若想更接近线上环境（相对路径、锚点跳转都一样）：

```powershell
cd "D:\minecraft\静态网页"
python -m http.server 8080
# 打开 http://127.0.0.1:8080/
```

> 提示：用 `file://` 打开时，深色记忆依赖的 localStorage 在部分浏览器里会被限制，站点会自动降级为「当次有效」，不影响功能。

## 加一条更新日志

只改 `changelog.html` 一个文件。当前它只有 **v1.0.0 一条**——这是咕咕启动器的第一个版本，0.x 系列版本并不存在，不要补写历史版本；模板与维护规则写在 `<div class="releases">` 上方的注释里：

1. 复制一段 `<article class="release">` 整体，粘贴到 `<div class="releases">` 的**最前面**。
2. 把 `id="v-x-y-z"`、`id="toggle-x-y-z"`、`aria-controls="rel-x-y-z"` 里的 `x-y-z` 换成版本号（点号写成横线，如 v1.1.0 → `1-1-0`）。三处必须一致。
3. 新版本块加上 `is-open` 类，按钮写 `aria-expanded="true"`；**同时把上一条的 `is-open` 去掉、改成 `aria-expanded="false"`** —— 全站永远只有 1 条默认展开。
4. `<span class="release-tag">` 写「最新」；占位版本写「开发中」，并同时给 `class="release-tag is-planned"`。
5. 数一下版本块：**超过 5 条就把最旧的一条整段删掉**，行数保持恒定，页面永远只展示最近 5 个版本。

## 改版本号

版本号只有一处需要改：`assets/js/main.js` 第一行的

```js
var VERSION = "1.0.0";
```

首页 Hero 徽标、下载标题里的版本号都带 `data-version` 属性，页面加载时由脚本统一填进去（HTML 里保留静态兜底文本，禁用 JS 时也显示得出来）。改完再在 `changelog.html` 里补一条同版本号的记录。

## 改下载链接

下载区只指向 GitHub Releases，没有网盘、没有镜像站。URL 出现在 `index.html` 的以下位置，改的时候全局替换同一个地址即可（搜 `releases/latest`）：

- Hero 的「下载启动器」按钮
- 下载区右上「从 GitHub 下载」按钮
- 下载区的「安装版」卡片（与上面的按钮指向同一个 Releases 地址）
- 页脚与顶栏的仓库链接（搜 `Gugu-Launcher`）

新增下载入口时同理：只能指向 GitHub，不要加第三方网盘、镜像或「其它下载方式」区块，站点自检脚本会拒绝非 github.com 的下载域名。

## 改主题色 / 深浅色

`assets/css/style.css` 顶部：

- `:root` 是浅色，`[data-theme="dark"]` 是深色，两套一起改；
- `--accent` 品牌主色（按钮、图标、徽标）；`--accent-strong` 是**正文级**安全色，换主色时记得同步它，保证浅底正文对比度 ≥ 4.5:1；
- `--bg / --fg / --muted / --line` 两套各自定义。

切换按钮在页面右上角：默认浅色显示月亮，点击切深色显示太阳，选择存在 localStorage 的 `gugu-theme` 键里。

## 部署到 GitHub Pages

产物就是本目录，**把 `静态网页/` 里的全部文件放到仓库根目录**（或放到 `docs/` 再在 Pages 里指定该目录），然后：

1. 确认 `.nojekyll` 已一并提交（否则 Jekyll 会跳过以下划线开头的文件/目录）。
2. 仓库 → Settings → Pages → Build and deployment：Source 选 **Deploy from a branch**，Branch 选 `main`、目录选 `/ (root)`（用了 `docs/` 就选 `/docs`），Save。
3. 等 Actions 跑完，地址形如 `https://jijiguowang123.github.io/<仓库名>/`。
4. 要自定义域名：在同一页面填 Custom domain 并按提示加 DNS 记录；勾选 Enforce HTTPS 后站内没有 http 资源，不会有混合内容告警。

命令行发布（仅供参考，按团队流程来）：

```powershell
git add .
git commit -m "site: 更新官网"
git push origin main
```

## 哪些东西不要上传

本目录是**站点产物目录**，仓库里只应该有它。以下属于本地工作环境，不进仓库，也不要从站内引用：

- `D:\minecraft\图片素材\` —— 原始截图与 UI 素材；只有**复制进 `assets/img/` 的那几张**会随站点发布；
- `D:\minecraft\所有版本备份\`、`D:\minecraft\备份\` —— 旧站与历史版本备份，仅作参考；
- `D:\minecraft\测试代码\` —— 自检脚本，不发布；
- 新工程的 `src/`、`src-tauri/`、`源代码/` 等源码目录；
- 任何 `node_modules/`、`.env`、编辑器缓存。

换截图时：新图压到宽度 ≤ 1200 像素、整站图片总量 ≤ 4 MB，再覆盖 `assets/img/` 里的同名文件，`<img>` 上的 `alt` 与宽高属性要跟着改。

## 自检

静态检查脚本在站点目录之外的 `D:\minecraft\测试代码\html-check.mjs`（纯 Node，无依赖）：

```powershell
& 'C:\Users\JIJIKING\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' "D:\minecraft\测试代码\html-check.mjs"
```

检查内容：标签闭合与 id 唯一、`<img>` 的 alt 与图片是否存在、相对 `href`/`src` 是否有对应文件、锚点能否跳、更新日志条数与手风琴 `aria-controls`、主题变量、两页导航是否一致、外链是否只指向 GitHub（不允许 http 资源与非 GitHub 域名）、深浅两套正文对比度是否 ≥ 4.5:1。
