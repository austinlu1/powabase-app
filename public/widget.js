(function () {
  "use strict";

  var config = window.PowabaseChat || {};
  var agentId = config.agentId;
  if (!agentId) { console.warn("[PowabaseChat] No agentId configured."); return; }

  // Use explicitly configured origin first, then fall back to script src detection
  var origin = config.origin || "";
  if (!origin) {
    var scripts = document.querySelectorAll("script[src]");
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.indexOf("/widget.js") !== -1) {
        origin = new URL(scripts[i].src).origin;
        break;
      }
    }
  }
  if (!origin) { console.warn("[PowabaseChat] Could not determine app origin. Set window.PowabaseChat.origin."); return; }

  var WIDGET_URL = origin + "/widget?agentId=" + encodeURIComponent(agentId);
  var isOpen = false;
  var iframe = null;
  var panel = null;

  // ── Styles ──────────────────────────────────────────────────────────────────
  var style = document.createElement("style");
  style.textContent = [
    "#pb-widget-btn{position:fixed;bottom:28px;right:28px;width:68px;height:68px;border-radius:50%;background:#2563eb;border:none;cursor:pointer;box-shadow:0 6px 24px rgba(37,99,235,0.5);display:flex;align-items:center;justify-content:center;z-index:2147483647;transition:background 0.2s,transform 0.2s;}",
    "#pb-widget-btn:hover{background:#1d4ed8;transform:scale(1.08);}",
    "#pb-widget-btn svg{width:30px;height:30px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}",
    "#pb-widget-panel{position:fixed;bottom:112px;right:28px;width:390px;height:620px;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.4);z-index:2147483646;border:1px solid rgba(255,255,255,0.1);display:none;transition:opacity 0.2s,transform 0.2s;opacity:0;transform:translateY(16px) scale(0.97);}",
    "#pb-widget-panel.pb-open{display:block;}",
    "#pb-widget-panel.pb-visible{opacity:1;transform:translateY(0) scale(1);}",
    "#pb-widget-panel iframe{width:100%;height:100%;border:none;display:block;}",
    "@media(max-width:460px){#pb-widget-panel{width:calc(100vw - 24px);right:12px;bottom:108px;height:72vh;}}"
  ].join("");
  document.head.appendChild(style);

  // ── Button ───────────────────────────────────────────────────────────────────
  var btn = document.createElement("button");
  btn.id = "pb-widget-btn";
  btn.setAttribute("aria-label", "Open chat");
  btn.innerHTML = chatIcon();
  document.body.appendChild(btn);

  // ── Panel ────────────────────────────────────────────────────────────────────
  panel = document.createElement("div");
  panel.id = "pb-widget-panel";
  document.body.appendChild(panel);

  btn.addEventListener("click", toggle);

  function toggle() { isOpen ? close() : open(); }

  function open() {
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.src = WIDGET_URL;
      iframe.title = "Chat";
      iframe.allow = "clipboard-write";
      panel.appendChild(iframe);
    }
    isOpen = true;
    btn.innerHTML = closeIcon();
    btn.setAttribute("aria-label", "Close chat");
    panel.classList.add("pb-open");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        panel.classList.add("pb-visible");
      });
    });
  }

  function close() {
    isOpen = false;
    btn.innerHTML = chatIcon();
    btn.setAttribute("aria-label", "Open chat");
    panel.classList.remove("pb-visible");
    setTimeout(function () { panel.classList.remove("pb-open"); }, 200);
  }

  function chatIcon() {
    return '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  }

  function closeIcon() {
    return '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  }
})();
