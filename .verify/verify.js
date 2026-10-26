/* 官网静态站验收脚本：DOM 断言 + 三档整页截图（Electron 跑一次即可）
   用法（仓库根目录）：
     Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
     Start-Process -FilePath "node_modules\electron\dist\electron.exe" -ArgumentList "HTML\.verify\verify.js" -Wait
   结果写进 HTML/.preview/report.json 与 HTML/.preview/progress.log */
const { app, BrowserWindow, clipboard } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

const HTML_DIR = path.join(__dirname, "..");
const OUT = path.join(HTML_DIR, ".preview");
fs.mkdirSync(OUT, { recursive: true });
const LOG = path.join(OUT, "progress.log");
fs.writeFileSync(LOG, "");
const NL = os.EOL;
function log(m) {
  fs.appendFileSync(LOG, "[" + new Date().toISOString().slice(11, 19) + "] " + m + NL);
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("force-device-scale-factor", "1");
/* 不订阅这个事件时，关掉最后一个窗口就会自动退出（后面还要继续开页面，必须拦住） */
app.on("window-all-closed", function () {});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = { pages: {}, console: [], errors: [] };
let win = null;

function watch() {
  const cdp = win.webContents;
  cdp.on("console-message", (_e, level, message, line, source) => {
    results.console.push({ page: path.basename(cdp.getURL() || "?"), level, message, source, line });
    if (level >= 2) log("CONSOLE level=" + level + " " + message);
  });
  cdp.on("render-process-gone", (_e, d) => results.errors.push({ kind: "render-process-gone", detail: d }));
  cdp.on("preload-error", (_e, p, err) => results.errors.push({ kind: "preload-error", detail: String(err) }));
  cdp.on("did-fail-load", (_e, code, desc, url) => results.errors.push({ kind: "did-fail-load", detail: code + " " + desc + " " + url }));
  cdp.setWindowOpenHandler((d) => {
    const at = cdp.getURL();
    results.windowOpen = (results.windowOpen || []).concat([{ url: d.url, from: at, t: new Date().toISOString().slice(11, 23) }]);
    log("window-open " + d.url + " from " + at);
    return { action: "deny" };
  });
}

const js = (code) => win.webContents.executeJavaScript(code, true);

async function go(file, width) {
  win.setContentSize(width, 900);
  await win.loadFile(path.join(HTML_DIR, file));
  await sleep(700);
  /* Electron 按 origin 记住缩放比例（本机的 changelog.html 之前被缩到 0.25），
     不归位的话页面实际是 5760px 宽，截图和点击坐标都会错。 */
  if (Math.abs(win.webContents.getZoomFactor() - 1) > 0.001) {
    log("reset zoom factor " + win.webContents.getZoomFactor() + " on " + file);
    win.webContents.setZoomFactor(1);
    await sleep(400);
  }
}

async function metrics() {
  const s = await js(
    "JSON.stringify({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)})"
  );
  return JSON.parse(s);
}

async function shoot(name, width) {
  win.setContentSize(width, 900);
  await sleep(450);
  const m = await metrics();
  const target = Math.min(m.height, 32000);
  win.setContentSize(width, target);
  await sleep(1000);
  await js("new Promise(function(r){ requestAnimationFrame(function(){ requestAnimationFrame(r); }); })");
  await sleep(250);
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, name), img.toPNG());
  const size = img.getSize();
  log("shot " + path.basename(win.webContents.getURL() || "?") + " -> " + name + " " + size.width + "x" + size.height + " pageHeight=" + m.height + " overflow=" + (m.scroll - m.client));
  return { file: name, width: size.width, height: size.height, pageHeight: m.height, truncated: m.height > target, overflow: m.scroll - m.client };
}

/* 视口截图：不改窗口高度，只截当前一屏（用来对比折叠 / 展开态） */
async function shotViewport(name, width, height) {
  win.setContentSize(width, height);
  await sleep(600);
  await js("new Promise(function(r){ requestAnimationFrame(function(){ requestAnimationFrame(r); }); })");
  await sleep(200);
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, name), img.toPNG());
  const m = await metrics();
  log("shot " + name + " " + width + "x" + height + " overflow=" + (m.scroll - m.client));
  return { file: name, width: width, height: height, overflow: m.scroll - m.client };
}

/* 读一个手风琴条目的状态（aria-expanded + 面板实际高度） */
async function accState(id) {
  return JSON.parse(
    await js(
      "(() => { const b = document.getElementById(" + JSON.stringify(id) + "); if (!b) return JSON.stringify({ missing: true }); const p = document.getElementById(b.getAttribute('aria-controls')); return JSON.stringify({ id: b.id, aria: b.getAttribute('aria-expanded'), height: p ? Math.round(p.getBoundingClientRect().height) : -1 }); })()"
    )
  );
}

/* 真实鼠标点击：先滚到视口中间（卷动是平滑的，等它停），再按视口坐标点下去 */
async function clickSel(sel) {
  const found = await js("(() => { const el = document.querySelector(" + JSON.stringify(sel) + "); if (!el) return false; el.scrollIntoView({ block: 'center' }); return true; })()");
  if (!found) throw new Error("clickSel missing " + sel);
  await sleep(600);
  const r = JSON.parse(
    await js("(() => { const el = document.querySelector(" + JSON.stringify(sel) + "); const b = el.getBoundingClientRect(); return JSON.stringify({ x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2), w: Math.round(b.width), h: Math.round(b.height) }); })()")
  );
  log("click " + sel + " at " + JSON.stringify(r));
  if (r.y < 4 || r.y > 896) throw new Error("clickSel out of viewport " + sel + " " + JSON.stringify(r));
  win.webContents.sendInputEvent({ type: "mouseDown", x: r.x, y: r.y, button: "left", clickCount: 1 });
  win.webContents.sendInputEvent({ type: "mouseUp", x: r.x, y: r.y, button: "left", clickCount: 1 });
  await sleep(550);
  return r;
}

const INDEX_ASSERT = "(() => {" +
  "  const q = (s) => document.querySelector(s);" +
  "  const qa = (s) => Array.prototype.slice.call(document.querySelectorAll(s));" +
  "  const navActions = qa('#primary-nav .nav-actions a');" +
  "  const heroMeta = q('#top .hero-meta');" +
  "  const dlH2 = q('#download h2');" +
  "  const navCl = qa('#primary-nav .nav-list a').filter((a) => a.textContent.trim() === '更新日志')[0];" +
  "  const cards = qa('#community .linkcard');" +
  "  const credits = qa('.credits-list a');" +
  "  const lanzou = q('#lanzou');" +
  "  const verRe = /(^|[^0-9])0[.][0-9]+[.][0-9]+/;" +
  "  const versionLikeText = qa('body *').filter((el) => el.children.length === 0)" +
  "    .map((el) => ({ tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim(), inSection: (el.closest('section') || {}).id || '' }))" +
  "    .filter((o) => verRe.test(o.text) && o.text.length < 60);" +
  "  const note = q('.hero-hint-note');" +
  "  const cta = q('#changelog .cl-cta a');" +
  "  return JSON.stringify({" +
  "    navActionCount: navActions.length," +
  "    navActionHrefs: navActions.map((a) => a.getAttribute('href'))," +
  "    navActionsBtnCount: qa('#primary-nav .nav-actions .btn').length," +
  "    navPrimaryBtnCount: qa('#primary-nav .nav-actions .btn-primary').length," +
  "    navChangelogHref: navCl ? navCl.getAttribute('href') : null," +
  "    navListItems: qa('#primary-nav .nav-list a').map((a) => a.textContent.trim() + ' -> ' + a.getAttribute('href'))," +
  "    dataVersionCount: qa('[data-version]').length," +
  "    heroMetaText: heroMeta ? heroMeta.textContent.trim() : null," +
  "    heroMetaHasVersion: heroMeta ? verRe.test(heroMeta.textContent) : null," +
  "    downloadH2Text: dlH2 ? dlH2.textContent.trim() : null," +
  "    downloadH2HasVersion: dlH2 ? verRe.test(dlH2.textContent) : null," +
  "    versionLikeText: versionLikeText," +
  "    heroButtons: qa('.hero-actions a').map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href'), cls: a.className, target: a.getAttribute('target'), rel: a.getAttribute('rel') }))," +
  "    lanzou: lanzou ? { href: lanzou.getAttribute('href'), target: lanzou.getAttribute('target'), rel: lanzou.getAttribute('rel'), copy: lanzou.getAttribute('data-copy'), cls: lanzou.className } : null," +
  "    lanzouNote: note ? note.textContent.trim() : null," +
  "    communityCardCount: cards.length," +
  "    communityCards: cards.map((c) => ({ title: (c.querySelector('.linkcard-title') || {}).textContent, href: c.getAttribute('href'), target: c.getAttribute('target') }))," +
  "    creditCount: credits.length," +
  "    credits: credits.map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') }))," +
  "    changelogAccordionItems: qa('#changelog .clog-item').length," +
  "    changelogVersions: qa('#changelog .ver-tag').map((s) => s.textContent.trim())," +
  "    changelogCta: cta ? { href: cta.getAttribute('href'), text: cta.textContent.trim() } : null," +
  "    footerChangelogHrefs: qa('.footer-nav a[href*=changelog]').map((a) => a.getAttribute('href'))," +
  "    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth" +
  "  });" +
  "})()";

const CL_ASSERT = `(() => {
  const q = (s) => document.querySelector(s);
  const qa = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
  const activeNav = qa('#primary-nav .nav-list a').filter((a) => a.textContent.trim() === '更新日志')[0];
  const gh = qa('a.inline-link[href*=CHANGELOG]')[0];
  const ver = qa('#clog-list .clog-btn .ver-tag');
  const cta = q('.cl-cta a');
  const cards = qa('#clog-list .clog-item');
  const panels = qa('#clog-list .clog-panel');
  const heights = panels.map((el) => Math.round(el.getBoundingClientRect().height));
  const btns = qa('#clog-list .clog-btn');
  return JSON.stringify({
    title: document.title,
    headerHtml: q('header#site-header') ? q('header#site-header').outerHTML : null,
    entryCount: qa('.clog-item').length,
    cardCount: cards.length,
    groupCount: qa('.clog-group').length,
    itemCount: qa('.clog-list li').length,
    expandedCount: cards.filter((c) => c.classList.contains('is-open')).length,
    ariaTrue: btns.filter((b) => b.getAttribute('aria-expanded') === 'true').length,
    ariaFalse: btns.filter((b) => b.getAttribute('aria-expanded') === 'false').length,
    openIds: cards.map((c, i) => (c.classList.contains('is-open') ? i : -1)).filter((i) => i >= 0),
    firstHeight: heights[0],
    zeroHeightCount: heights.filter((h) => h === 0).length,
    zeroHeightSkippingFirst: heights.filter((h, i) => i > 0 && h === 0).length,
    btnTagNames: Array.from(new Set(btns.map((b) => b.tagName))),
    ariaLinked: btns.every((b) => {
      const panel = document.getElementById(b.getAttribute('aria-controls'));
      return !!panel && panel.classList.contains('clog-panel');
    }),
    panelIds: panels.every((el) => !!el.id),
    firstVersions: ver.slice(0, 4).map((h) => h.textContent.trim()),
    lastVersion: ver.length ? ver[ver.length - 1].textContent.trim() : null,
    has051: /0[.]5[.]1/.test(document.body.innerText),
    has049: /0[.]4[.]9/.test(document.body.innerText),
    has010: /0[.]1[.]0/.test(document.body.innerText),
    ghLink: gh ? gh.getAttribute('href') : null,
    ghTarget: gh ? gh.getAttribute('target') : null,
    ghRel: gh ? gh.getAttribute('rel') : null,
    toolbar: {
      expand: (q('#clog-expand-all') || {}).textContent || null,
      collapse: (q('#clog-collapse-all') || {}).textContent || null
    },
    activeNav: activeNav ? { href: activeNav.getAttribute('href'), cls: activeNav.className, current: activeNav.getAttribute('aria-current') } : null,
    navListItems: qa('#primary-nav .nav-list a').map((a) => a.textContent.trim() + ' -> ' + a.getAttribute('href')),
    imgCount: qa('img').length,
    imagesBroken: qa('img').filter((i) => i.complete && i.naturalWidth === 0).length,
    styleSheetCount: document.styleSheets.length,
    jsClassOn: document.documentElement.classList.contains('js'),
    brandHref: (q('a.brand') || {}).getAttribute ? q('a.brand').getAttribute('href') : null,
    ctaHref: cta ? cta.getAttribute('href') : null,
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  });
})()`;

const INTERACT_ASSERT = `(() => {
  const qa = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
  const cards = qa('#clog-list .clog-item');
  const heights = qa('#clog-list .clog-panel').map((el) => Math.round(el.getBoundingClientRect().height));
  const btns = qa('#clog-list .clog-btn');
  return JSON.stringify({
    cards: cards.length,
    expanded: cards.filter((c) => c.classList.contains('is-open')).length,
    ariaTrue: btns.filter((b) => b.getAttribute('aria-expanded') === 'true').length,
    ariaFalse: btns.filter((b) => b.getAttribute('aria-expanded') === 'false').length,
    openIds: cards.map((c, i) => (c.classList.contains('is-open') ? i : -1)).filter((i) => i >= 0),
    heights: heights,
    secondHeight: heights[1],
    zeroHeightCount: heights.filter((h) => h === 0).length,
    focused: document.activeElement ? document.activeElement.id : null
  });
})()`;

const HINT_ASSERT = "(() => { const h = document.getElementById('copy-hint'); if (!h) return JSON.stringify({ missing: true }); return JSON.stringify({ text: h.textContent.trim(), cls: h.className, opacity: getComputedStyle(h).opacity }); })()";

async function main() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    x: 0,
    y: 0,
    frame: false,
    show: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  watch();

  /* ---------- index.html ---------- */
  await go("index.html", 1440);
  results.pages.index = JSON.parse(await js(INDEX_ASSERT));
  results.pages.index.headerHtml = await js("document.querySelector('header#site-header').outerHTML");
  results.pages.index.shots = [];
  for (const w of [1440, 820, 390]) results.pages.index.shots.push(await shoot("index-" + w + ".png", w));

  /* 手风琴回归：首页「最近三条」与 FAQ 共用同一套 JS，开→关各走一遍 */
  win.setContentSize(1440, 900);
  await sleep(600);
  results.pages.index.accordion = {};
  await clickSel("#cl-b1");
  results.pages.index.accordion.recentOpen = await accState("cl-b1");
  await clickSel("#cl-b1");
  results.pages.index.accordion.recentClosed = await accState("cl-b1");
  await clickSel("#fq-b1");
  results.pages.index.accordion.faqOpen = await accState("fq-b1");
  await clickSel("#fq-b1");
  results.pages.index.accordion.faqClosed = await accState("fq-b1");
  /* 上面的点击把页面滚到了 FAQ；平滑滚动还在路上，先立刻回到顶部，后面的蓝奏云坐标才对得上 */
  await js("(() => { const de = document.documentElement; const prev = de.style.scrollBehavior; de.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); de.style.scrollBehavior = prev; return window.scrollY; })()");
  await sleep(400);

  /* 蓝奏云按钮：真实鼠标点击（带用户激活）→ 断言剪贴板与提示 */
  win.setContentSize(1440, 900);
  await sleep(700);
  await js("window.scrollTo(0, 0)");
  await sleep(400);
  clipboard.writeText("__before__");
  const rect = JSON.parse(
    await js("(() => { const r = document.getElementById('lanzou').getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: innerWidth, h: innerHeight }); })()")
  );
  log("click lanzou at " + JSON.stringify(rect));
  win.webContents.sendInputEvent({ type: "mouseDown", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  win.webContents.sendInputEvent({ type: "mouseUp", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await sleep(900);
  results.pages.index.clipboardAfterClick = clipboard.readText();
  results.pages.index.hintAfterClick = JSON.parse(await js(HINT_ASSERT));
  await sleep(2400);
  results.pages.index.hintAfterFade = JSON.parse(await js(HINT_ASSERT));

  /* ---------- changelog.html：默认只展开最新版 ---------- */
  await go("changelog.html", 1440);
  const clData = JSON.parse(await js(CL_ASSERT));
  results.pages.changelog = clData;
  results.pages.changelog.overflowByWidth = {};
  for (const w of [1440, 820, 390]) {
    win.setContentSize(w, 900);
    await sleep(350);
    const m = await metrics();
    results.pages.changelog.overflowByWidth[w] = m.scroll - m.client;
    log("changelog width " + w + " overflow " + (m.scroll - m.client));
  }
  results.pages.changelog.shots = [await shoot("changelog-1440.png", 1440)];

  /* 折叠态（默认状态）一屏截图 */
  await go("changelog.html", 1440);
  results.pages.changelog.foldedShot = await shotViewport("changelog-folded.png", 1440, 900);

  /* 点第 2 条标题 → 它展开、其它原样 */
  await go("changelog.html", 1440);
  results.pages.changelog.clickSecond = await clickSel("#cl-b1");
  results.pages.changelog.afterClickSecond = JSON.parse(await js(INTERACT_ASSERT));
  results.pages.changelog.expandedShot = await shoot("changelog-expanded.png", 1440);

  /* 全部展开 → 47 条全开；全部收起 → 全部收起（含最新一条） */
  await go("changelog.html", 1440);
  await clickSel("#clog-expand-all");
  results.pages.changelog.afterExpandAll = JSON.parse(await js(INTERACT_ASSERT));
  await clickSel("#clog-collapse-all");
  results.pages.changelog.afterCollapseAll = JSON.parse(await js(INTERACT_ASSERT));

  /* 键盘：聚焦第 2 条标题按 Enter（原生 button 语义，不改键位） */
  await go("changelog.html", 1440);
  win.focus();
  win.webContents.focus();
  await js("(() => { const b = document.querySelector('#cl-b1'); b.focus(); window.scrollTo(0, 0); })()");
  await sleep(250);
  /* 页面加载后先让渲染器拿到焦点，再聚焦第 2 条标题；读回 activeElement 作为「真的聚焦到了」的证据 */
  await sleep(300);
  const focusInfo = JSON.parse(await js("(() => { const b = document.querySelector('#cl-b1'); b.focus(); return JSON.stringify({ id: document.activeElement ? document.activeElement.id : null, tag: document.activeElement ? document.activeElement.tagName : null, page: location.pathname.split('/').pop() }); })()"));
  await sleep(200);
  results.pages.changelog.focusedBeforeEnter = await js("document.activeElement ? document.activeElement.id : null");
  results.pages.changelog.focusPage = focusInfo.page;
  log("keyboard focus id=" + results.pages.changelog.focusedBeforeEnter + " page=" + focusInfo.page);
  win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Return" });
  win.webContents.sendInputEvent({ type: "char", keyCode: "\r" });
  win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Return" });
  await sleep(700);
  results.pages.changelog.afterKeyboardEnter = JSON.parse(await js(INTERACT_ASSERT));
  /* Tab 顺序：每个版本标题都是原生 button，Tab 应该走到下一条 */
  win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Tab" });
  win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Tab" });
  await sleep(300);
  results.pages.changelog.afterTab = await js("document.activeElement ? document.activeElement.id : null");
  const tabbable = JSON.parse(await js("JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('#clog-list .clog-btn')).filter((b) => b.tabIndex >= 0 && !b.disabled).map((b) => b.id))"));
  results.pages.changelog.tabbableCount = tabbable.length;

  /* ---------- header 一致性（去掉锚点改写与高亮差异后逐字节比对） ---------- */
  const normalize = (h) =>
    h
      .replace(/[ \t\r\n]+/g, " ")
      .replace(/ href="index[.]html(#[-\w]+)?"/g, function (_m, anchor) { return ' href="' + (anchor || "#top") + '"'; })
      .replace(/ class="is-active" aria-current="page"/g, "")
      .replace(/>\s+</g, "><")
      .trim();
  results.pages.headerCompare = {
    equalAfterNormalize: normalize(results.pages.index.headerHtml) === normalize(clData.headerHtml),
    indexHeaderLength: results.pages.index.headerHtml.length,
    changelogHeaderLength: (clData.headerHtml || "").length,
    indexNormalized: normalize(results.pages.index.headerHtml),
  };

  results.consoleErrors = results.console.filter((c) => c.level >= 2);
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(results, null, 2), "utf8");
  log("done. consoleErrors=" + results.consoleErrors.length + " loadErrors=" + results.errors.length + " windowOpen=" + JSON.stringify(results.windowOpen || []));
  app.exit(0);
}

app.whenReady().then(function () {
  main().catch(function (err) {
    log("FATAL " + (err && err.stack ? err.stack : String(err)));
    fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ fatal: String((err && err.stack) || err), partial: results }, null, 2), "utf8");
    app.exit(1);
  });
});
