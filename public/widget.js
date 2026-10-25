/* Cencori website widget loader.
 *
 *   <script src="https://cencori.com/widget.js" data-key="cwk_…" async></script>
 *
 * Options (data- attributes on the script tag):
 *   data-mode="inline"     render the chat in the page instead of a launcher
 *   data-target="#chat"    inline only: element to render into (default: after the script)
 *   data-height="600px"    inline only: frame height
 */
(function () {
    "use strict";

    var script = document.currentScript || document.querySelector('script[src*="/widget.js"][data-key]');
    if (!script) return;
    var key = script.getAttribute("data-key");
    if (!key) return;
    window.__cencoriWidgets = window.__cencoriWidgets || {};
    if (window.__cencoriWidgets[key]) return;
    window.__cencoriWidgets[key] = true;

    var base = new URL(script.src, location.href).origin;
    var mode = script.getAttribute("data-mode") === "inline" ? "inline" : "widget";
    var frameUrl = base + "/api/widget/frame/" + encodeURIComponent(key) + "?mode=" + mode;
    var FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif";
    var HIGHLIGHT = "radial-gradient(circle at 32% 26%,rgba(255,255,255,.85) 0%,rgba(255,255,255,.25) 22%,transparent 48%)";
    var CHAT_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';
    var CLOSE_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

    function readableOn(hex) {
        var n = parseInt(String(hex).slice(1), 16);
        if (isNaN(n)) return "#ffffff";
        var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? "#111111" : "#ffffff";
    }

    function prefersDark(look) {
        if (look.theme === "dark") return true;
        if (look.theme === "light") return false;
        return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }

    function makeFrame(title) {
        var frame = document.createElement("iframe");
        frame.src = frameUrl;
        frame.title = title || "Chat";
        frame.setAttribute("allow", "clipboard-write");
        frame.style.cssText = "border:0;width:100%;height:100%;display:block;background:transparent;color-scheme:normal";
        return frame;
    }

    function orb(background, size) {
        var el = document.createElement("span");
        el.setAttribute("aria-hidden", "true");
        el.style.cssText = "position:relative;display:inline-block;flex:none;width:" + size + "px;height:" + size + "px;border-radius:50%;overflow:hidden;background:" + background;
        var gloss = document.createElement("span");
        gloss.style.cssText = "position:absolute;inset:0;border-radius:50%;background:" + HIGHLIGHT + ";box-shadow:inset 0 -2px 4px rgba(0,0,0,.25)";
        el.appendChild(gloss);
        return el;
    }

    function mountInline(look) {
        var target = null;
        try { target = script.getAttribute("data-target") ? document.querySelector(script.getAttribute("data-target")) : null; } catch (err) { target = null; }
        if (!target) {
            target = document.createElement("div");
            script.parentNode.insertBefore(target, script.nextSibling);
        }
        var box = document.createElement("div");
        box.style.cssText = "width:100%;height:" + (script.getAttribute("data-height") || "600px") + ";border:1px solid rgba(0,0,0,.08);border-radius:14px;overflow:hidden";
        box.appendChild(makeFrame(look.title));
        target.appendChild(box);
    }

    function mountLauncher(look, orbBackground) {
        var side = look.position === "left" ? "left" : "right";
        var dark = prefersDark(look);
        var accentFg = readableOn(look.accent);

        var root = document.createElement("div");
        root.setAttribute("data-cencori-widget", key);
        root.style.cssText = "position:fixed;bottom:20px;" + side + ":20px;z-index:2147483000;font:14px/1.3 " + FONT + ";display:flex;flex-direction:column;align-items:" + (side === "left" ? "flex-start" : "flex-end");

        var panel = document.createElement("div");
        panel.style.cssText = "margin-bottom:12px;width:380px;height:min(640px,calc(100vh - 110px));border-radius:16px;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.18),0 0 0 1px " + (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)") + ";display:none;background:transparent";

        // Closed: the card or the pill. Open: a round close button.
        var launcher;
        if (look.launcher_style === "pill") {
            launcher = document.createElement("button");
            launcher.type = "button";
            launcher.setAttribute("aria-label", look.launcher_text);
            launcher.style.cssText = "display:inline-flex;align-items:center;gap:8px;height:48px;padding:0 18px 0 14px;border:0;border-radius:999px;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.18);background:" + look.accent + ";color:" + accentFg + ";font:inherit;font-weight:600";
            launcher.innerHTML = CHAT_ICON;
            var pillLabel = document.createElement("span");
            pillLabel.textContent = look.launcher_text;
            launcher.appendChild(pillLabel);
        } else {
            // Card: the orb and heading in one button.
            launcher = document.createElement("button");
            launcher.type = "button";
            launcher.style.cssText = "display:inline-flex;align-items:center;gap:10px;max-width:calc(100vw - 40px);padding:8px 16px 8px 8px;border:0;border-radius:999px;cursor:pointer;font:inherit;box-shadow:0 8px 32px rgba(0,0,0,.16),0 0 0 1px " + (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)") + ";background:" + (dark ? "#141414" : "#fff") + ";color:" + (dark ? "#f2f2f2" : "#111");
            launcher.appendChild(orb(orbBackground || look.accent, 24));
            var heading = document.createElement("span");
            heading.textContent = look.launcher_text;
            heading.style.cssText = "font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
            launcher.appendChild(heading);
        }

        var close = document.createElement("button");
        close.type = "button";
        close.setAttribute("aria-label", "Close chat");
        close.innerHTML = CLOSE_ICON;
        close.style.cssText = "display:none;width:48px;height:48px;align-items:center;justify-content:center;border:0;border-radius:50%;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.18);background:" + look.accent + ";color:" + accentFg;

        var frame = null;
        var open = false;

        function fit() {
            var small = window.innerWidth < 520;
            panel.style.position = small && open ? "fixed" : "static";
            panel.style.inset = small && open ? "0" : "";
            panel.style.width = small ? "100%" : "380px";
            panel.style.height = small ? "100%" : "min(640px,calc(100vh - 110px))";
            panel.style.borderRadius = small ? "0" : "16px";
            panel.style.marginBottom = small ? "0" : "12px";
            close.style.display = open && !small ? "inline-flex" : "none";
        }
        function toggle(next) {
            open = typeof next === "boolean" ? next : !open;
            if (open && !frame) {
                frame = makeFrame(look.title);
                panel.appendChild(frame);
            }
            panel.style.display = open ? "block" : "none";
            launcher.style.display = open ? "none" : "inline-flex";
            fit();
            if (open && frame && frame.contentWindow) frame.contentWindow.postMessage({ type: "cencori:focus" }, base);
        }

        launcher.addEventListener("click", function () { toggle(true); });
        close.addEventListener("click", function () { toggle(false); });
        window.addEventListener("resize", fit);
        window.addEventListener("keydown", function (e) { if (open && e.key === "Escape") toggle(false); });
        window.addEventListener("message", function (e) {
            if (e.origin !== base || !frame || e.source !== frame.contentWindow) return;
            if (e.data && e.data.type === "cencori:close") toggle(false);
        });

        root.appendChild(panel);
        root.appendChild(launcher);
        root.appendChild(close);
        document.body.appendChild(root);
    }

    function start() {
        fetch(base + "/api/widget/config/" + encodeURIComponent(key))
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (config) {
                if (!config || !config.enabled || !config.appearance) return;
                if (mode === "inline") mountInline(config.appearance);
                else mountLauncher(config.appearance, config.orb);
            })
            .catch(function () { /* the widget stays hidden */ });
    }

    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
})();
