/**
 * Porter — an agent that answers on the site it was built from.
 *
 *   <script src="https://cdn.cencori.com/porter.js"
 *           data-porter="prtr_…" data-key="pk_live_…" defer></script>
 *
 * Everything renders inside a shadow root, so the host page's CSS cannot reach in and none of this
 * leaks out. That is what makes the same line work on a WordPress theme and inside a React app.
 *
 * The script carries no opinion about what the Porter says. It sends an id and a message; the
 * server decides the model, the prompt and the pages, because anything named here is editable by
 * anyone with devtools on a page whose source already contains the key.
 */
(function () {
    "use strict";

    var script = document.currentScript;
    if (!script) return;

    var porterId = script.getAttribute("data-porter");
    var apiKey = script.getAttribute("data-key");
    if (!porterId || !apiKey) {
        console.warn("[Porter] data-porter and data-key are both required");
        return;
    }

    var base = script.getAttribute("data-base") || "https://api.cencori.com";
    var accent = "#111111";
    var history = [];
    var busy = false;
    var opened = false;

    // ── shadow root ──────────────────────────────────────────────────────────
    var host = document.createElement("div");
    host.setAttribute("data-porter-host", "");
    // The host page may have z-index wars; sit above them without joining in.
    host.style.cssText = "position:fixed;z-index:2147483000;bottom:0;right:0;";
    var root = host.attachShadow({ mode: "open" });
    document.body.appendChild(host);

    // Kept separate so the accent can be replaced once config arrives: :host{all:initial} below
    // resets custom properties, so the variable has to be declared inside the shadow styles.
    var vars = document.createElement("style");
    vars.textContent = ":host{--accent:#111111;--accent-ink:#ffffff}";
    root.appendChild(vars);

    /**
     * Pick text that can be read on the brand colour. A customer whose site is bright yellow should
     * not get white-on-yellow because the fallback assumed a dark accent.
     */
    function inkFor(hex) {
        var value = String(hex || "").replace("#", "");
        if (value.length === 3) {
            value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
        }
        if (!/^[0-9a-f]{6}$/i.test(value)) return "#ffffff";
        var r = parseInt(value.slice(0, 2), 16) / 255;
        var g = parseInt(value.slice(2, 4), 16) / 255;
        var b = parseInt(value.slice(4, 6), 16) / 255;
        var lin = function (c) {
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        var luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        return luminance > 0.45 ? "#0a0a0a" : "#ffffff";
    }

    var style = document.createElement("style");
    style.textContent = [
        // Tokens mirror the scaffold: a message from the visitor is the foreground colour inverted,
        // and a reply is plain text, because bubbles on both sides read like a toy.
        ":host{all:initial;--bg:#ffffff;--fg:#0a0a0a;--card:#ffffff;--border:#e4e4e8;--muted:#8a8a93}",
        "@media (prefers-color-scheme:dark){:host{--bg:#0a0a0a;--fg:#fafafa;--card:#1a1a1a;--border:#2a2a30;--muted:#8a8a93}}",
        "*{box-sizing:border-box;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}",

        ".launcher{position:fixed;right:20px;bottom:20px;height:52px;max-width:min(280px,calc(100vw - 40px));",
        "padding:0 20px;border:0;border-radius:26px;background:var(--accent);color:var(--accent-ink);",
        "font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.22);",
        "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}",
        ".launcher:focus-visible{outline:2px solid var(--accent);outline-offset:3px}",

        ".panel{position:fixed;right:20px;bottom:20px;width:min(400px,calc(100vw - 40px));height:min(580px,calc(100vh - 40px));",
        "display:flex;flex-direction:column;background:var(--bg);color:var(--fg);border-radius:16px;overflow:hidden;",
        "box-shadow:0 18px 60px rgba(0,0,0,.28);border:1px solid var(--border)}",

        ".head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border)}",
        ".head img{width:24px;height:24px;border-radius:6px;object-fit:cover}",
        ".head .name{font-size:14px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".head button{border:0;background:none;font-size:20px;line-height:1;color:var(--muted);cursor:pointer;padding:4px;border-radius:6px}",
        ".head button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}",

        ".log{flex:1;overflow-y:auto;padding:20px 16px;display:flex;flex-direction:column;gap:1.5rem}",
        ".row{display:flex;flex-direction:column}",
        ".row.you{align-items:flex-end}",
        ".row.them{align-items:flex-start}",
        ".msg{max-width:85%;padding:.4rem .75rem;line-height:1.4;font-size:.875rem;white-space:pre-wrap;",
        "word-wrap:break-word;border-radius:.875rem}",
        ".msg.you{background:var(--fg);color:var(--bg);border-bottom-right-radius:.25rem}",
        ".msg.them{background:transparent;color:var(--fg);padding:0;max-width:100%}",

        ".dots{display:flex;align-items:center;gap:4px;color:var(--muted);padding:0}",
        ".dots i{width:4px;height:4px;border-radius:50%;background:currentColor;animation:pulse 1.4s infinite ease-in-out both}",
        ".dots i:nth-child(1){animation-delay:-.32s}.dots i:nth-child(2){animation-delay:-.16s}",
        "@keyframes pulse{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1.2)}}",
        "@media (prefers-reduced-motion:reduce){.dots i{animation:none;opacity:.5}}",

        ".foot{padding:12px 16px 0}",
        ".form{display:flex;align-items:center;gap:.5rem;background:var(--card);border:1px solid var(--border);",
        "border-radius:9999px;padding:.5rem .5rem .5rem 1rem;transition:border-color .2s ease}",
        ".form:focus-within{border-color:var(--accent)}",
        ".form input{flex:1;min-width:0;background:transparent;border:none;outline:none;color:var(--fg);",
        "font-size:.95rem;height:24px;line-height:24px}",
        ".form input::placeholder{color:var(--muted)}",
        ".form button{display:flex;align-items:center;justify-content:center;width:32px;height:32px;flex:none;",
        "border-radius:50%;background:var(--fg);color:var(--bg);border:none;cursor:pointer;",
        "transition:transform .1s ease,background-color .2s ease}",
        ".form button:not(:disabled):hover{transform:scale(1.05)}",
        ".form button:disabled{background:var(--border);color:var(--muted);cursor:not-allowed}",
        ".form button svg{width:16px;height:16px}",

        ".by{padding:10px 0 12px;font-size:.7rem;color:var(--muted);text-align:center}",
        ".by a{color:var(--muted);text-decoration:none}",
        ".by a:hover{text-decoration:underline}",
    ].join("");
    root.appendChild(style);

    var launcher = document.createElement("button");
    launcher.className = "launcher";
    launcher.type = "button";
    launcher.setAttribute("aria-haspopup", "dialog");
    launcher.textContent = "Ask a question";
    root.appendChild(launcher);

    var panel = null;
    var log = null;
    var input = null;
    var send = null;
    var config = { name: "Assistant", greeting: "", ready: false, brand: {} };

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function scroll() {
        if (log) log.scrollTop = log.scrollHeight;
    }

    function addMessage(who, text) {
        var row = el("div", "row " + who);
        var node = el("div", "msg " + who, text);
        row.appendChild(node);
        log.appendChild(row);
        scroll();
        return node;
    }

    function buildPanel() {
        panel = el("div", "panel");
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "false");
        panel.setAttribute("aria-label", config.name + " assistant");

        var head = el("div", "head");
        if (config.brand && config.brand.logo) {
            var logo = document.createElement("img");
            logo.src = config.brand.logo;
            logo.alt = "";
            head.appendChild(logo);
        }
        head.appendChild(el("div", "name", config.name));
        var close = el("button", null, "×");
        close.type = "button";
        close.setAttribute("aria-label", "Close");
        close.addEventListener("click", toggle);
        head.appendChild(close);
        panel.appendChild(head);

        log = el("div", "log");
        // Answers arrive a token at a time; announcing politely stops a screen reader
        // interrupting itself on every chunk.
        log.setAttribute("role", "log");
        log.setAttribute("aria-live", "polite");
        panel.appendChild(log);

        var foot = el("div", "foot");
        var form = el("div", "form");
        input = document.createElement("input");
        input.type = "text";
        input.placeholder = config.ready ? "Ask a question..." : "Not ready yet";
        input.setAttribute("aria-label", "Your question");
        input.disabled = !config.ready;
        input.addEventListener("keydown", function (event) {
            if (event.key === "Enter") ask();
        });
        send = el("button");
        send.type = "button";
        send.disabled = !config.ready;
        send.setAttribute("aria-label", "Send message");
        send.innerHTML =
            '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
            '<path d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" stroke-width="1.75" ' +
            'stroke-linecap="round" stroke-linejoin="round"/></svg>';
        send.addEventListener("click", ask);
        form.appendChild(input);
        form.appendChild(send);
        foot.appendChild(form);
        panel.appendChild(foot);

        var by = el("div", "by");
        var link = document.createElement("a");
        link.href = "https://cencori.com";
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Powered by Cencori";
        by.appendChild(link);
        panel.appendChild(by);

        root.appendChild(panel);
        addMessage("them", config.greeting);
        if (!config.ready) addMessage("them", "This assistant has not read its website yet.");
    }

    function toggle() {
        opened = !opened;
        if (opened) {
            if (!panel) buildPanel();
            panel.style.display = "flex";
            launcher.style.display = "none";
            if (input && !input.disabled) input.focus();
        } else {
            if (panel) panel.style.display = "none";
            launcher.style.display = "";
            launcher.focus();
        }
    }

    launcher.addEventListener("click", toggle);
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && opened) toggle();
    });

    /** Keep the exchange, bounded: the server caps it too, and an unbounded array is a slow leak. */
    function remember(question, answer) {
        history.push({ role: "user", content: question });
        history.push({ role: "assistant", content: answer });
        while (history.length > 20) history.shift();
    }

    function ask() {
        if (busy || !input || !input.value.trim()) return;
        var question = input.value.trim();
        input.value = "";
        addMessage("you", question);

        busy = true;
        send.disabled = true;

        var thinkingRow = el("div", "row them");
        var thinking = el("div", "msg them dots");
        thinking.innerHTML = "<i></i><i></i><i></i>";
        thinkingRow.appendChild(thinking);
        log.appendChild(thinkingRow);
        scroll();

        fetch(base + "/api/v1/porter/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
            body: JSON.stringify({ porterId: porterId, message: question, history: history, stream: true }),
        })
            .then(function (response) {
                if (!response.ok) {
                    return response.json().then(function (body) {
                        throw new Error((body && body.error && body.error.message) || "Something went wrong.");
                    });
                }
                return stream(response, thinkingRow).then(function (answer) {
                    remember(question, answer);
                });
            })
            .catch(function (error) {
                thinkingRow.remove();
                addMessage("them", error.message || "Something went wrong.");
            })
            .then(function () {
                busy = false;
                if (send) send.disabled = false;
                if (input) input.focus();
            });
    }

    /** Read an OpenAI-shaped SSE body and paint it as it arrives. */
    function stream(response, placeholder) {
        var reader = response.body && response.body.getReader();
        if (!reader) {
            return response.json().then(function (body) {
                placeholder.remove();
                var choice = body && body.choices && body.choices[0];
                var content = (choice && choice.message && choice.message.content) || "";
                addMessage("them", content);
                return content;
            });
        }

        var decoder = new TextDecoder();
        var buffer = "";
        var answer = "";
        var node = null;

        function pump() {
            return reader.read().then(function (result) {
                if (result.done) return;
                buffer += decoder.decode(result.value, { stream: true });
                var lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i].trim();
                    if (line.indexOf("data:") !== 0) continue;
                    var payload = line.slice(5).trim();
                    if (!payload || payload === "[DONE]") continue;
                    try {
                        var chunk = JSON.parse(payload);
                        var delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
                        var piece = delta && delta.content;
                        if (!piece) continue;
                        if (!node) {
                            placeholder.remove();
                            node = addMessage("them", "");
                        }
                        answer += piece;
                        node.textContent = answer;
                        scroll();
                    } catch (error) {
                        /* a partial frame; the next read completes it */
                    }
                }
                return pump();
            });
        }

        return pump().then(function () {
            if (!node) {
                placeholder.remove();
                addMessage("them", answer || "No answer came back.");
            }
            return answer;
        });
    }

    // ── config, then show the launcher ───────────────────────────────────────
    fetch(base + "/api/v1/porter/config?porter=" + encodeURIComponent(porterId), {
        headers: { Authorization: "Bearer " + apiKey },
    })
        .then(function (response) {
            if (!response.ok) throw new Error("config");
            return response.json();
        })
        .then(function (body) {
            config = body;
            accent = (body.brand && body.brand.color) || accent;
            vars.textContent =
                ":host{--accent:" + accent + ";--accent-ink:" + inkFor(accent) + "}";

            // "Ask Northern Rivers Mutual Insurance Group" truncates to nonsense. Past a length a
            // button can hold, the generic label says the same thing and still fits.
            var name = body.name || "";
            launcher.textContent = name && name.length <= 18 ? "Ask " + name : "Ask a question";
            launcher.setAttribute("aria-label", name ? "Ask " + name : "Ask a question");
        })
        .catch(function () {
            // A Porter that cannot describe itself should not put a broken button on someone's site.
            host.remove();
        });
})();
