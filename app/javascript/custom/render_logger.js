/* c8 ignore file */

/* eslint-env browser */
(function () {
  if (window.__renderLoggerBooted) return;
  window.__renderLoggerBooted = true;

  // ===== 強制OFFスイッチ（どれかが真なら完全停止）=====
  // 1) 本番ドメインならOFF
  // 2) <meta name="render-debug-off" content="1">
  // 3) window.__renderLoggerOff = true
  const FORCE_OFF =
    /(^|\.)moriappli-emotion\.com$/i.test(location.hostname) ||
    document.querySelector('meta[name="render-debug-off"]')?.content === "1" ||
    window.__renderLoggerOff === true;

  if (FORCE_OFF) return;

  // ===== iOS自動起動は廃止（常時OFFの原因を排除）=====
  // const isIOS = (() => {
  //   try {
  //     const ua = navigator.userAgent || "";
  //     return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  //   } catch (_) { return false; }
  // })();

  // ===== 明示起動のみ（URL ?debug=1 or localStorage）=====
  const enabled =
    /[?&]debug=1\b/.test(location.search) ||
    (typeof localStorage !== "undefined" && localStorage.getItem("debug-sc-player") === "1");
    // ← ここから isIOS を削除

  if (!enabled) return;

  const remoteUrl = document.querySelector('meta[name="remote-debug-url"]')?.content || null;
  const tag = "global-player";

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    position: "fixed", left: "6px", right: "6px", bottom: "6px",
    maxHeight: "40vh", overflow: "auto", background: "rgba(0,0,0,.85)",
    color: "#0f0", font: "12px/1.4 ui-monospace,monospace",
    padding: "8px 10px", borderRadius: "10px", zIndex: 100000,
    boxShadow: "0 6px 16px rgba(0,0,0,.35)", backdropFilter: "blur(3px)"
  });
  panel.id = "mlog-panel";
  const bar = document.createElement("div");
  bar.style.marginBottom = "6px";
  bar.innerHTML = `
    <strong style="color:#fff">Debug</strong>
    <button id="mlog-clear" style="margin-left:8px">clear</button>
    <button id="mlog-hide"  style="margin-left:6px">hide</button>
    <span style="color:#aaa;margin-left:8px">${tag}</span>
  `;
  const pre = document.createElement("pre");
  pre.style.whiteSpace = "pre-wrap"; pre.style.margin = "0";
  panel.appendChild(bar); panel.appendChild(pre);

  const mountOverlay = () => { if (!document.getElementById("mlog-panel")) document.body.appendChild(panel); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountOverlay, { once: true }); else mountOverlay();

  let renderLog = null;
  const ensureRenderLog = () => {
    let r = document.getElementById("render-log");
    if (!r) {
      r = document.createElement("pre");
      r.id = "render-log";
      r.setAttribute("aria-live", "polite");
      Object.assign(r.style, {
        maxHeight: "50vh", overflow: "auto", border: "1px solid #ccc", padding: "8px",
        margin: "8px 0", background: "#111", color: "#0f0",
        font: "12px/1.4 ui-monospace,monospace"
      });
      (document.querySelector("main") || document.body).prepend(r);
    }
    return r;
  };
  const mountRenderLog = () => { renderLog = ensureRenderLog(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountRenderLog, { once: true }); else mountRenderLog();

  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.id === "mlog-clear") { pre.textContent = ""; renderLog && (renderLog.textContent = ""); }
    if (t.id === "mlog-hide")  { try { panel.remove(); } catch(_) {} }
  });

  const buf = [];
  let flushTimer = null;
  const maxInDom = 500;

  function write(level, args) {
    const ts = new Date().toISOString().split("T")[1].replace("Z","");
    const line = `[${ts}] ${level.toUpperCase()} ${args.map(a => {
      try { return (typeof a === "string") ? a : JSON.stringify(a); } catch { return String(a); }
    }).join(" ")}`;

    if (pre) {
      if (pre.childNodes.length > maxInDom) pre.textContent = "";
      pre.appendChild(document.createTextNode(line + "\n"));
      pre.scrollTop = pre.scrollHeight;
    }
    if (renderLog) {
      if (renderLog.childNodes.length > maxInDom) renderLog.textContent = "";
      renderLog.appendChild(document.createTextNode(line + "\n"));
      renderLog.scrollTop = renderLog.scrollHeight;
    }

    buf.push({ t: Date.now(), level, msg: line, tag, ua: navigator.userAgent });
    if (!flushTimer) flushTimer = setTimeout(flush, 1200);
  }

  function flush() {
    flushTimer = null;
    if (!remoteUrl || !buf.length) return;
    const payload = JSON.stringify({ tag, logs: buf.splice(0) });
    try {
      if (navigator.sendBeacon) {
        const ok = navigator.sendBeacon(remoteUrl, new Blob([payload], { type: "application/json" }));
        if (!ok) fetch(remoteUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
      } else {
        fetch(remoteUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
      }
    } catch(_) {}
  }

  const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  ["log","info","warn","error"].forEach(level => {
    console[level] = (...args) => { try { write(level, args); } catch(_) {} try { orig[level].apply(console, args); } catch(_) {} };
  });

  window.addEventListener("error", (e) => write("error", [e.message, `${e.filename}:${e.lineno}:${e.colno}`]));
  window.addEventListener("unhandledrejection", (e) => write("error", ["unhandledrejection", String(e.reason && e.reason.stack || e.reason)]));

  console.info("[render-logger] boot ok");
})();
