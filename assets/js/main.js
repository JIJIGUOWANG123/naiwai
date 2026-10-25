/* ==========================================================================
   奶娃启动器 · NaiWa Launcher — 官网脚本
   纯原生 JS，无依赖。只做五件事：下载链接配置、移动端菜单、滚动淡入、
   手风琴、下载弹层。所有逻辑都做了降级：JS 失效时页面内容照常可读。
   ========================================================================== */

(function () {
  "use strict";

  /* ======================================================================
     【集中配置区】部署时只改这两块就够了。
     ====================================================================== */

  /** 当前版本号：会同步到页面上所有 data-version 的位置 */
  var VERSION = "0.5.1";

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

  function hydrateVersion() {
    var nodes = document.querySelectorAll("[data-version]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = VERSION;

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

  /* ---------- 4. 手风琴（FAQ / 更新日志） ---------- */

  function expandPanel(item, panel) {
    item.classList.add("is-open");
    panel.style.maxHeight = panel.scrollHeight + "px";
    panel.addEventListener("transitionend", function handler(event) {
      if (event.propertyName !== "max-height") return;
      panel.removeEventListener("transitionend", handler);
      if (item.classList.contains("is-open")) panel.style.maxHeight = "none";
    });
  }

  function collapsePanel(item, panel) {
    if (panel.style.maxHeight === "none" || !panel.style.maxHeight) {
      panel.style.maxHeight = panel.scrollHeight + "px";
      void panel.offsetHeight;
    }
    item.classList.remove("is-open");
    panel.style.maxHeight = "0px";
  }

  var accButtons = Array.prototype.slice.call(document.querySelectorAll(".acc-btn"));

  accButtons.forEach(function (btn) {
    var item = btn.closest(".acc-item");
    var panel = item ? item.querySelector(".acc-panel") : null;
    if (!item || !panel) return;

    if (item.classList.contains("is-open")) panel.style.maxHeight = "none";
    btn.setAttribute("aria-expanded", item.classList.contains("is-open") ? "true" : "false");

    btn.addEventListener("click", function () {
      var open = !item.classList.contains("is-open");
      if (open) expandPanel(item, panel);
      else collapsePanel(item, panel);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  /* 窗口尺寸变化时，已展开的面板重算高度，避免文字换行后被裁切 */
  window.addEventListener("resize", function () {
    Array.prototype.forEach.call(
      document.querySelectorAll(".acc-item.is-open .acc-panel"),
      function (panel) {
        if (panel.style.maxHeight !== "none") panel.style.maxHeight = panel.scrollHeight + "px";
      }
    );
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

  hydrateVersion();
  hydrateDownloads();
})();