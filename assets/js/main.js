/* ==========================================================================
   奶娃启动器 · NaiWa Launcher — 官网脚本
   纯原生 JS，无依赖。只做这些事：下载链接配置、移动端菜单、滚动淡入、
   手风琴、蓝奏云按钮复制访问密码。所有逻辑都做了降级：JS 失效时页面内容照常可读。
   ========================================================================== */

(function () {
  "use strict";

  /* ======================================================================
     【集中配置区】部署时只改这两块就够了。
     ====================================================================== */

  /**
   * 当前版本号。页面上**不显示**版本号（用户要求不标注版本），
   * 这里只用于拼免安装包的文件名：NaiWaLauncher-<VERSION>-portable-x64.zip
   */
  var VERSION = "0.5.4";

  /**
   * 下载地址。留 "#" 或空字符串时，对应按钮会自动禁用并显示「即将上线」，
   * 不会把用户送到 404 页面。填好之后按钮自动恢复可用。
   *   setup    —— 安装版  NaiWaLauncher-Setup.exe
   *   single   —— 单文件版 NaiWaLauncher.exe
   *   portable —— 便携版  NaiWaLauncher-<VERSION>-portable-x64.zip
   *   source   —— GitHub Releases 页面
   *   repo     —— 仓库首页
   */
  var REPO_URL = "https://github.com/JIJIGUOWANG123/NaiWaLauncher";
  var RELEASES_URL = REPO_URL + "/releases";
  /** Releases 里两个「固定文件名」的资产：永远指向最新版，不用随版本号改。 */
  var LATEST_DOWNLOAD = RELEASES_URL + "/latest/download";

  // 用户要求：下载统一走 GitHub Releases（不再自建下载页）。
  var DOWNLOAD = {
    setup: LATEST_DOWNLOAD + "/NaiWaLauncher-Setup.exe",
    single: LATEST_DOWNLOAD + "/NaiWaLauncher.exe",
    portable: LATEST_DOWNLOAD + "/NaiWaLauncher-" + VERSION + "-portable-x64.zip",
    source: RELEASES_URL,
    repo: REPO_URL
  };

  /* ====================================================================== */

  var docEl = document.documentElement;
  docEl.classList.add("js");

  var reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function isConfigured(url) {
    return typeof url === "string" && url.trim() !== "" && url.trim() !== "#";
  }

  function isExternal(url) {
    return /^https?:\/\//i.test(url);
  }

  /* ---------- 1. 版本号与下载链接 ---------- */

  function fileName(key, explicit) {
    if (explicit && explicit !== "portable") return explicit;
    if (key === "portable") return "NaiWaLauncher-" + VERSION + "-portable-x64.zip";
    return explicit || "";
  }

  /* 版本号不再渲染到页面（站点不标注版本），只留给下载文件名用 */
  function hydrateVersion() {
    var portableName = document.querySelector('[data-dl-file-name="portable"]');
    if (portableName) portableName.textContent = fileName("portable");
  }

  function hydrateDownloads() {
    var nodes = document.querySelectorAll("[data-dl]");
    var pending = 0;

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute("data-dl");
      var url = DOWNLOAD[key];
      var label = el.hasAttribute("data-dl-text")
        ? el
        : el.querySelector("[data-dl-text]");
      var keepLabel = el.hasAttribute("data-dl-keep-label");

      if (isConfigured(url)) {
        el.setAttribute("href", url.trim());
        el.classList.add("is-ready");
        if (isExternal(url) && key !== "setup" && key !== "single" && key !== "portable") {
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
        } else if (isExternal(url)) {
          el.setAttribute("rel", "noopener noreferrer");
        }
        var name = fileName(key, el.getAttribute("data-dl-file"));
        if (name && (key === "setup" || key === "single" || key === "portable")) {
          el.setAttribute("download", name);
        }
      } else {
        pending++;
        el.classList.add("is-off");
        el.setAttribute("aria-disabled", "true");
        el.setAttribute("href", "#");
        el.setAttribute("tabindex", "-1");
        el.removeAttribute("target");
        el.setAttribute("title", "下载地址尚未配置");
        if (label && !keepLabel) {
          el.setAttribute("data-dl-original", (el.textContent || "").trim());
          label.textContent = "即将上线";
        }
      }
    }

    return pending;
  }

  document.addEventListener(
    "click",
    function (event) {
      var el = event.target.closest ? event.target.closest("[data-dl].is-off") : null;
      if (el) {
        event.preventDefault();
        return;
      }
      var link = event.target.closest ? event.target.closest('a[href="#"]') : null;
      if (link && link.getAttribute("href") === "#") {
        event.preventDefault();
      }
    },
    false
  );

  /* ---------- 2. 顶部导航：滚动状态 / 移动端开关 / 当前分区 ---------- */

  var header = document.getElementById("site-header");
  var toggle = document.getElementById("nav-toggle");
  var nav = document.getElementById("primary-nav");
  var navOpen = false;

  function onScroll() {
    if (!header) return;
    if (window.scrollY > 8) header.classList.add("is-stuck");
    else header.classList.remove("is-stuck");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  function setNav(open) {
    if (!nav || !toggle) return;
    navOpen = open;
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
    document.body.classList.toggle("nav-open", open);
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      setNav(!navOpen);
    });
  }

  if (nav) {
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a") && navOpen) setNav(false);
    });
  }

  window.addEventListener("resize", function () {
    if (navOpen && window.innerWidth > 1024) setNav(false);
  });

  /* 当前分区高亮 */
  var navLinks = nav ? Array.prototype.slice.call(nav.querySelectorAll('.nav-list a[href^="#"]')) : [];
  var sections = navLinks
    .map(function (a) {
      var id = a.getAttribute("href").slice(1);
      return id ? document.getElementById(id) : null;
    })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    var activeIds = [];

    function paintActive() {
      navLinks.forEach(function (a) {
        var on = activeIds.indexOf(a.getAttribute("href").slice(1)) !== -1;
        a.classList.toggle("is-active", on);
        if (on) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }

    var currentObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var id = entry.target.id;
          var at = activeIds.indexOf(id);
          if (entry.isIntersecting && at === -1) activeIds.push(id);
          else if (!entry.isIntersecting && at !== -1) activeIds.splice(at, 1);
        });
        /* 按文档顺序取第一个进入视野中线的分区；都不在就清空高亮（回到顶部时不留残影） */
        activeIds = sections
          .map(function (s) { return s.id; })
          .filter(function (id) { return activeIds.indexOf(id) !== -1; });
        paintActive();
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach(function (section) {
      currentObserver.observe(section);
    });
  }

  /* ---------- 3. 滚动到视口淡入 ---------- */

  var revealNodes = Array.prototype.slice.call(document.querySelectorAll(".reveal"));

  function showNode(el) {
    el.classList.add("is-visible");
  }

  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealNodes.forEach(showNode);
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          showNode(entry.target);
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    revealNodes.forEach(function (el) {
      revealObserver.observe(el);
    });

    /* 兜底：快速滚动 / 用锚点直接跳转时，IntersectionObserver 可能整段漏触发，
       这里在滚动时再补一遍「已经翻过头顶」的元素，避免内容停留在透明状态。 */
    var pendingReveal = revealNodes.slice();
    var sweepQueued = false;

    function revealSweep() {
      sweepQueued = false;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      pendingReveal = pendingReveal.filter(function (el) {
        if (el.classList.contains("is-visible")) return false;
        if (el.getBoundingClientRect().top < vh * 1.05) {
          showNode(el);
          revealObserver.unobserve(el);
          return false;
        }
        return true;
      });
    }

    function queueSweep() {
      if (sweepQueued || !pendingReveal.length) return;
      sweepQueued = true;
      if (window.requestAnimationFrame) window.requestAnimationFrame(revealSweep);
      else window.setTimeout(revealSweep, 16);
    }

    window.addEventListener("scroll", queueSweep, { passive: true });
    window.addEventListener("resize", queueSweep);
    window.addEventListener("load", queueSweep);
    queueSweep();
  }

  /* ---------- 4. 折叠卡片 / 手风琴（更新日志卡片 + 常见问题） ---------- */

  /* 一套实现同时服务 .clog-item（更新日志页、首页「最近三条」）与 .acc-item（常见问题）：
     面板靠标题按钮的 aria-controls 定位；收起态是 max-height:0，展开时先量 scrollHeight
     再设像素值（0 → 像素可插值），过渡结束改回 none，窗口变宽后文字换行才不会被裁。 */
  var accordionItems = [];

  function panelOf(item) {
    var btn = item.querySelector("button[aria-controls]");
    var panel = btn ? document.getElementById(btn.getAttribute("aria-controls")) : null;
    return btn && panel ? { btn: btn, panel: panel } : null;
  }

  function openItem(item, ref) {
    /* 顺序要紧：先量（面板还是收起态）→ 设像素高度 → 再加 is-open，
       中间不触发强制布局，过渡才会真的从 0 走到目标高度。 */
    ref.panel.style.maxHeight = ref.panel.scrollHeight + "px";
    item.classList.add("is-open");
    ref.btn.setAttribute("aria-expanded", "true");

    var timer = 0;
    function settle() {
      if (!timer) return;
      window.clearTimeout(timer);
      timer = 0;
      ref.panel.removeEventListener("transitionend", onEnd);
      if (item.classList.contains("is-open")) ref.panel.style.maxHeight = "none";
    }
    function onEnd(event) {
      if (event.propertyName === "max-height") settle();
    }
    timer = window.setTimeout(settle, 320);
    ref.panel.addEventListener("transitionend", onEnd);
  }

  function closeItem(item, ref) {
    if (ref.panel.style.maxHeight === "none" || !ref.panel.style.maxHeight) {
      ref.panel.style.maxHeight = ref.panel.scrollHeight + "px";
      void ref.panel.offsetHeight;
    }
    item.classList.remove("is-open");
    ref.btn.setAttribute("aria-expanded", "false");
    ref.panel.style.maxHeight = "0px";
  }

  function collectAccordions(selector) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (item) {
      var ref = panelOf(item);
      if (!ref) return;
      if (item.classList.contains("is-open")) {
        ref.panel.style.maxHeight = "none";
        ref.btn.setAttribute("aria-expanded", "true");
      }
      ref.btn.addEventListener("click", function () {
        if (item.classList.contains("is-open")) closeItem(item, ref);
        else openItem(item, ref);
      });
      accordionItems.push({ item: item, ref: ref });
    });
  }

  collectAccordions(".clog-item");
  collectAccordions(".acc-item");

  /* 更新日志页右上角：全部展开 / 全部收起（只作用于 .clog-item 卡片） */
  function clogCards() {
    return accordionItems.filter(function (rec) {
      return rec.item.classList.contains("clog-item");
    });
  }

  var expandAllBtn = document.getElementById("clog-expand-all");
  var collapseAllBtn = document.getElementById("clog-collapse-all");

  if (expandAllBtn) {
    expandAllBtn.addEventListener("click", function () {
      clogCards().forEach(function (rec) {
        if (!rec.item.classList.contains("is-open")) openItem(rec.item, rec.ref);
      });
    });
  }
  if (collapseAllBtn) {
    collapseAllBtn.addEventListener("click", function () {
      clogCards().forEach(function (rec) {
        if (rec.item.classList.contains("is-open")) closeItem(rec.item, rec.ref);
      });
    });
  }

  /* 窗口尺寸变化时，已展开的面板重算高度，避免文字换行后被裁切 */
  window.addEventListener("resize", function () {
    accordionItems.forEach(function (rec) {
      if (!rec.item.classList.contains("is-open")) return;
      if (rec.ref.panel.style.maxHeight !== "none") {
        rec.ref.panel.style.maxHeight = rec.ref.panel.scrollHeight + "px";
      }
    });
  });

  /* ---------- 5. 键盘：Esc 收起移动端菜单 ---------- */

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" && event.key !== "Esc") return;
    if (!navOpen) return;
    setNav(false);
    if (toggle) toggle.focus();
  });

  /* ---------- 6. 杂项 ---------- */

  var yearNode = document.getElementById("year");
  if (yearNode) yearNode.textContent = String(new Date().getFullYear());

  var anchors = Array.prototype.slice.call(document.querySelectorAll('a[href^="#"]'));
  anchors.forEach(function (a) {
    a.addEventListener("click", function () {
      if (navOpen) setNav(false);
    });
  });

  /* ---------- 7. 蓝奏云：点击下载按钮时顺手复制访问密码 ---------- */

  var copyButtons = Array.prototype.slice.call(document.querySelectorAll("[data-copy]"));
  var copyHint = document.getElementById("copy-hint");
  var hintTimer = 0;

  function showCopyHint(text, isError) {
    if (!copyHint) return;
    copyHint.textContent = text;
    copyHint.classList.toggle("is-error", !!isError);
    copyHint.classList.add("is-on");
    if (hintTimer) window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(
      function () {
        copyHint.classList.remove("is-on");
      },
      isError ? 10000 : 2000
    );
  }

  /* 剪贴板 API 不可用（非安全上下文 / 无权限）时的兜底：临时 textarea + execCommand */
  function legacyCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  function copyPassword(btn) {
    var text = btn.getAttribute("data-copy") || "";
    if (!text) return;

    function done() {
      showCopyHint("已复制访问密码 " + text, false);
    }
    function failed() {
      /* 不静默失败：直接告诉用户复制失败，并把密码明文放出来自己选 */
      showCopyHint("自动复制失败，请手动复制访问密码 " + text, true);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        if (legacyCopy(text)) done();
        else failed();
      });
      return;
    }
    if (legacyCopy(text)) done();
    else failed();
  }

  copyButtons.forEach(function (btn) {
    /* 不拦截默认行为：链接照常在新标签页打开 */
    btn.addEventListener("click", function () {
      copyPassword(btn);
    });
  });

  hydrateVersion();
  hydrateDownloads();
})();