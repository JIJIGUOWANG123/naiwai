/* ==========================================================================
   咕咕启动器 · Gugu Launcher —— 官网脚本（原生 JS，无依赖，无网络请求）
   只做四件事：深浅色切换、更新日志手风琴、截图灯箱、版本号注入/导航高亮。
   ========================================================================== */

/* 【唯一版本号来源】发版时只改这一行，页面上所有 data-version 会一起更新。 */
var VERSION = "1.0.1";

(function () {
  "use strict";

  var THEME_KEY = "gugu-theme";
  var root = document.documentElement;

  /* ------------------------------------------------------------ 主题 ---- */

  function readStoredTheme() {
    try {
      return window.localStorage.getItem(THEME_KEY);
    } catch (err) {
      return null;
    }
  }

  function storeTheme(value) {
    try {
      window.localStorage.setItem(THEME_KEY, value);
    } catch (err) {
      /* 无痕模式或禁用存储时静默降级：只影响记忆，不影响切换 */
    }
  }

  function paintTheme(theme) {
    var isDark = theme === "dark";
    if (isDark) {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }

    var btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.setAttribute("aria-pressed", isDark ? "true" : "false");
      btn.setAttribute("aria-label", isDark ? "切换到浅色模式" : "切换到深色模式");
      btn.setAttribute("title", isDark ? "切换到浅色模式" : "切换到深色模式");
    }
  }

  function currentTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  /* 尽早应用，避免深色用户看到白屏闪烁（本脚本在 head 里同步加载） */
  paintTheme(readStoredTheme() === "dark" ? "dark" : "light");

  /* --------------------------------------------------------- 页面逻辑 ---- */

  function initThemeToggle() {
    var btn = document.getElementById("theme-toggle");
    if (!btn) {
      return;
    }
    paintTheme(currentTheme());
    btn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      paintTheme(next);
      storeTheme(next);
    });
  }

  function initVersion() {
    var nodes = document.querySelectorAll("[data-version]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = VERSION;
    }
  }

  function initNav() {
    var page = window.location.pathname.split("/").pop();
    if (!page) {
      page = "index.html";
    }

    var links = document.querySelectorAll(".nav-list a[data-page]");
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var isCurrent = link.getAttribute("data-page") === page;
      link.classList.toggle("is-active", isCurrent);
      if (isCurrent) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  }

  function initAccordion() {
    var toggles = document.querySelectorAll(".release-toggle");
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].addEventListener("click", function () {
        var article = this.closest(".release");
        if (!article) {
          return;
        }
        var open = article.classList.toggle("is-open");
        this.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
  }

  function initLightbox() {
    var box = document.getElementById("lightbox");
    if (!box) {
      return;
    }

    var full = document.getElementById("lightbox-img");
    var caption = document.getElementById("lightbox-caption");
    var closeBtn = document.getElementById("lightbox-close");
    var triggers = document.querySelectorAll(".shot-btn");
    var lastFocused = null;

    function open(btn) {
      lastFocused = document.activeElement;
      full.setAttribute("src", btn.getAttribute("data-full"));
      full.setAttribute("alt", btn.getAttribute("data-alt") || "界面截图放大预览");
      caption.textContent = btn.getAttribute("data-caption") || "";
      box.hidden = false;
      document.body.style.overflow = "hidden";
      if (closeBtn) {
        closeBtn.focus();
      }
    }

    function close() {
      box.hidden = true;
      document.body.style.overflow = "";
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      }
    }

    for (var i = 0; i < triggers.length; i++) {
      triggers[i].addEventListener("click", function () {
        open(this);
      });
    }

    box.addEventListener("click", function (event) {
      if (event.target === box) {
        close();
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", close);
    }

    document.addEventListener("keydown", function (event) {
      if (!box.hidden && (event.key === "Escape" || event.key === "Esc")) {
        close();
      }
    });
  }

  function boot() {
    initThemeToggle();
    initVersion();
    initNav();
    initAccordion();
    initLightbox();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
