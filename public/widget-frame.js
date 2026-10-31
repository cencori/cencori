/* Cencori website widget: the chat inside the iframe. Served from the same
 * origin as /api/widget/* and /v1/sessions, so every call is same-origin. */
(function () {
    "use strict";

    var cfg = JSON.parse(document.getElementById("cencori-widget-config").textContent);
    var app = document.getElementById("app");
    var look = cfg.appearance;
    var storeKey = "cencori-widget:" + cfg.key + (cfg.preview ? ":preview" : cfg.share ? ":link" : "");

    app.style.setProperty("--accent-fg", readableOn(look.accent));

    function readableOn(hex) {
        var n = parseInt(hex.slice(1), 16);
        var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? "#111111" : "#ffffff";
    }

    // Storage can be blocked (third-party contexts, private windows); the chat still works without it.
    function load() {
        try { return JSON.parse(localStorage.getItem(storeKey) || "null") || {}; } catch (e) { return {}; }
    }
    function save() {
        try { localStorage.setItem(storeKey, JSON.stringify({ visitorId: state.visitorId, sessionId: state.sessionId, messages: state.messages.slice(-50), ownerSince: state.ownerSince, lastActive: state.lastActive })); } catch (e) { /* ignore */ }
    }
    function newVisitorId() {
        var bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return "v_" + Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    }

    var saved = load();
    var state = {
        visitorId: saved.visitorId || newVisitorId(),
        sessionId: saved.sessionId || null,
        messages: Array.isArray(saved.messages) ? saved.messages : [],
        token: null,
        tokenExpires: 0,
        busy: false,
        // Someone from the business stepped into this chat (from Cencori Studio).
        ownerActive: false,
        ownerSince: saved.ownerSince || null,
        lastActive: saved.lastActive || 0,
    };

    function parentOrigin() {
        try {
            if (location.ancestorOrigins && location.ancestorOrigins.length) return location.ancestorOrigins[0];
        } catch (e) { /* ignore */ }
        try { return document.referrer ? new URL(document.referrer).origin : null; } catch (e) { return null; }
    }

    // ── Rendering ─────────────────────────────────────────────────────────
    var ICONS = {
        close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
        // The close X turned 45°, so the two header icons are the same mark.
        reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="transform:rotate(45deg)"><path d="M18 6 6 18M6 6l12 12"/></svg>',
        send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    };

    app.innerHTML =
        '<header class="head"><span class="dot" aria-hidden="true"></span><div class="title"></div>' +
        '<button class="icon reset" type="button" title="New conversation" aria-label="New conversation">' + ICONS.reset + "</button>" +
        '<button class="icon close" type="button" title="Close" aria-label="Close chat">' + ICONS.close + "</button></header>" +
        '<div class="list" role="log" aria-live="polite"></div>' +
        '<form class="composer"><textarea rows="1" placeholder="Type your message…" aria-label="Message"></textarea>' +
        '<button class="send" type="submit" aria-label="Send" disabled>' + ICONS.send + "</button></form>" +
        '<div class="foot">Powered by <a href="https://cencori.com" target="_blank" rel="noopener">Cencori</a></div>';

    var list = app.querySelector(".list");
    var form = app.querySelector(".composer");
    var input = app.querySelector("textarea");
    var sendBtn = app.querySelector(".send");
    app.querySelector(".title").textContent = look.title;
    if (cfg.orb) app.querySelector(".dot").style.background = cfg.orb;

    // Console preview only: unsaved look settings arrive as they're typed.
    function applyLook(next) {
        if (!next || typeof next !== "object") return;
        look = {
            title: typeof next.title === "string" && next.title.trim() ? next.title.slice(0, 60) : look.title,
            greeting: typeof next.greeting === "string" && next.greeting.trim() ? next.greeting.slice(0, 300) : look.greeting,
            accent: typeof next.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(next.accent) ? next.accent : look.accent,
            theme: next.theme === "light" || next.theme === "dark" ? next.theme : "auto",
        };
        app.style.setProperty("--accent", look.accent);
        app.style.setProperty("--accent-fg", readableOn(look.accent));
        if (look.theme === "auto") app.removeAttribute("data-theme"); else app.setAttribute("data-theme", look.theme);
        app.querySelector(".title").textContent = look.title;
        if (!state.busy) render(false);
    }

    function escapeHtml(s) {
        return s.replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
    }

    // A small, safe subset of Markdown: everything is escaped first.
    function inline(s) {
        return s
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>')
            .replace(/\[(\d{1,2})\]/g, "<sup>[$1]</sup>");
    }
    function markdown(text) {
        var blocks = escapeHtml(text.trim()).split(/\n{2,}/);
        return blocks.map(function (block) {
            var lines = block.split("\n");
            if (lines.every(function (l) { return /^\s*[-*] /.test(l); })) {
                return "<ul>" + lines.map(function (l) { return "<li>" + inline(l.replace(/^\s*[-*] /, "")) + "</li>"; }).join("") + "</ul>";
            }
            if (lines.every(function (l) { return /^\s*\d+[.)] /.test(l); })) {
                return "<ol>" + lines.map(function (l) { return "<li>" + inline(l.replace(/^\s*\d+[.)] /, "")) + "</li>"; }).join("") + "</ol>";
            }
            return "<p>" + lines.map(inline).join("<br>") + "</p>";
        }).join("");
    }

    function bubble(message) {
        if (message.role === "error" || message.role === "note") {
            var err = document.createElement("div");
            err.className = message.role;
            err.textContent = message.text;
            return err;
        }
        var el = document.createElement("div");
        el.className = "msg " + (message.role === "user" ? "user" : "bot");
        if (message.role === "user" || message.role === "owner") el.textContent = message.text;
        else el.innerHTML = markdown(message.text);
        return el;
    }

    // typing: "Thinking" until the reply starts; partial: the reply so far, as it streams.
    function render(typing, partial) {
        list.innerHTML = "";
        list.appendChild(bubble({ role: "assistant", text: look.greeting }));
        state.messages.forEach(function (m) { list.appendChild(bubble(m)); });
        if (partial) {
            list.appendChild(bubble({ role: "assistant", text: partial }));
        } else if (typing) {
            var t = document.createElement("div");
            t.className = "msg bot typing";
            t.setAttribute("role", "status");
            t.innerHTML = '<span class="shimmer" data-text="Thinking">Thinking</span>';
            list.appendChild(t);
        }
        list.scrollTop = list.scrollHeight;
    }

    // ── Network ───────────────────────────────────────────────────────────
    function ApiError(status, code, message) { this.status = status; this.code = code; this.message = message; }

    // Routes answer errors as { error: { code, message } } or { error: "message", code }.
    function errorOf(body) {
        if (!body || !body.error) return {};
        if (typeof body.error === "string") return { code: body.code, message: body.error };
        return body.error;
    }

    async function openSession() {
        var res = await fetch("/api/widget/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: cfg.key, visitor_id: state.visitorId, session_id: state.sessionId, parent_origin: parentOrigin(), preview: cfg.preview, share: cfg.share }),
        });
        var body = await res.json().catch(function () { return null; });
        if (!res.ok || !body) {
            var e = errorOf(body);
            throw new ApiError(res.status, e.code || "error", e.message || "This chat is unavailable right now.");
        }
        // A conversation that couldn't be resumed starts fresh: the old messages aren't in it.
        if (state.sessionId && body.session_id !== state.sessionId) state.messages = [];
        state.sessionId = body.session_id;
        state.token = body.token;
        state.tokenExpires = Date.parse(body.expires_at) || 0;
        save();
    }

    async function ensureToken() {
        if (!state.token || state.tokenExpires - Date.now() < 30000) await openSession();
    }

    function parseEvents(buffer, onEvent) {
        var parts = buffer.split("\n\n");
        var rest = parts.pop();
        parts.forEach(function (chunk) {
            var type = "message", data = "";
            chunk.split("\n").forEach(function (line) {
                if (line.indexOf("event:") === 0) type = line.slice(6).trim();
                else if (line.indexOf("data:") === 0) data += line.slice(5).trim();
            });
            if (!data) return;
            try { onEvent(type, JSON.parse(data)); } catch (e) { /* skip malformed */ }
        });
        return rest;
    }

    async function runTurn(text, onText) {
        await ensureToken();
        var res = await fetch("/api/v1/sessions/" + encodeURIComponent(state.sessionId) + "/turns", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + state.token },
            body: JSON.stringify({ input: text }),
        });
        if (!res.ok || !res.body) {
            var body = await res.json().catch(function () { return null; });
            var e = errorOf(body);
            throw new ApiError(res.status, e.code || "error", e.message || "Something went wrong. Try again.");
        }
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "", reply = "", citations = [], failure = null, ended = false, handled = false;
        for (;;) {
            var step = await reader.read();
            if (step.done) break;
            buffer = parseEvents(buffer + decoder.decode(step.value, { stream: true }), function (type, data) {
                // Deltas are pieces of the reply, in order, as it's written.
                if (type === "output_text.delta" && typeof data.delta === "string") {
                    reply += data.delta;
                    if (onText) onText(reply);
                }
                else if (type === "turn.completed") {
                    citations = data.knowledge_citations || [];
                    ended = data.conversation_ended === true;
                }
                else if (type === "turn.failed") failure = (data.output && data.output.error) || "Something went wrong. Try again.";
                // The owner is handling this chat: the message reached them, no assistant reply.
                else if (type === "owner.handling") handled = true;
                else if (type === "turn.paused") failure = "This request needs a person to approve it, which isn't available in this chat.";
            });
        }
        if (failure && !reply) throw new ApiError(500, "turn_failed", failure);
        return { reply: reply, citations: citations, ended: ended, handled: handled };
    }

    function friendly(err) {
        if (err && err.code === "widget_conversation_limit") return err.message + " Use the + button above.";
        if (err && err.message) return err.message;
        return "Couldn't reach the chat. Check your connection and try again.";
    }

    async function send(text) {
        state.busy = true;
        state.messages.push({ role: "user", text: text });
        state.lastActive = Date.now();
        save();
        render(true);
        var streamed = function (partial) { render(true, partial); };
        try {
            var result;
            try {
                result = await runTurn(text, streamed);
            } catch (err) {
                // Expired token or a conversation that closed: reopen once and retry.
                if (err instanceof ApiError && (err.status === 401 || err.code === "session_not_active" || err.code === "session_not_found")) {
                    state.token = null;
                    if (err.code !== "client_token_expired" && err.status !== 401) state.sessionId = null;
                    result = await runTurn(text, streamed);
                } else {
                    throw err;
                }
            }
            if (result.handled) {
                if (!state.ownerActive) joined();
            } else {
                state.messages.push({ role: "assistant", text: result.reply || "…" });
            }
            // The agent closed the conversation: the next message opens a new one.
            if (result.ended) {
                state.messages.push({ role: "note", text: "Conversation ended. Send a message to start a new one." });
                state.sessionId = null;
                state.token = null;
            }
        } catch (err) {
            state.messages.push({ role: "error", text: friendly(err) });
        } finally {
            state.busy = false;
            save();
            render(false);
            updateSend();
            input.focus();
            schedulePoll();
        }
    }

    // ── The owner, live ───────────────────────────────────────────────────
    // While a conversation is recent, check for messages the business sent from
    // Cencori Studio: often while someone from the team is in the chat, slowly
    // otherwise, and not at all once it's been quiet for a couple of hours.
    var POLL_FAST = 4000, POLL_SLOW = 20000, RECENT = 2 * 60 * 60 * 1000;
    var pollTimer = null;

    function joined() {
        state.ownerActive = true;
        state.messages.push({ role: "note", text: "Someone from the team joined the chat." });
    }

    function schedulePoll() {
        clearTimeout(pollTimer);
        if (!state.sessionId || Date.now() - state.lastActive > RECENT) return;
        pollTimer = setTimeout(poll, state.ownerActive ? POLL_FAST : POLL_SLOW);
    }

    async function poll() {
        if (state.busy || document.visibilityState !== "visible" || !state.sessionId) return schedulePoll();
        try {
            await ensureToken();
            var res = await fetch("/api/widget/messages" + (state.ownerSince ? "?since=" + encodeURIComponent(state.ownerSince) : ""), {
                headers: { Authorization: "Bearer " + state.token },
                cache: "no-store",
            });
            var body = res.ok ? await res.json() : null;
            if (body && !state.busy) {
                var fresh = (body.messages || []).filter(function (m) {
                    return !state.messages.some(function (x) { return x.id === m.id; });
                });
                var changed = fresh.length > 0 || body.owner_active !== state.ownerActive;
                // Someone joined only when the owner wrote; the assistant passing something on for them is just the assistant.
                if (fresh.some(function (m) { return m.from !== "assistant"; }) && !state.ownerActive) joined();
                fresh.forEach(function (m) { state.messages.push({ role: m.from === "assistant" ? "assistant" : "owner", id: m.id, text: m.text }); });
                if (fresh.length) {
                    state.ownerSince = fresh[fresh.length - 1].at;
                    state.lastActive = Date.now();
                }
                state.ownerActive = body.owner_active === true;
                if (changed) { save(); render(false); }
            }
        } catch (e) { /* try again next time */ }
        schedulePoll();
    }

    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") schedulePoll(); });

    // ── Wiring ────────────────────────────────────────────────────────────
    function updateSend() { sendBtn.disabled = state.busy || !input.value.trim(); }
    // A pill while it's one line; past that the round ends would cut into the text.
    function grow() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 120) + "px"; input.parentNode.classList.toggle("multiline", input.scrollHeight > 32); }

    input.addEventListener("input", function () { grow(); updateSend(); });
    input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event("submit", { cancelable: true })); }
    });
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        var text = input.value.trim();
        if (!text || state.busy) return;
        input.value = "";
        grow();
        updateSend();
        void send(text.slice(0, 4000));
    });
    app.querySelector(".reset").addEventListener("click", function () {
        if (state.busy) return;
        state.sessionId = null;
        state.token = null;
        state.messages = [];
        state.ownerActive = false;
        state.ownerSince = null;
        clearTimeout(pollTimer);
        save();
        render(false);
        input.focus();
    });
    app.querySelector(".close").addEventListener("click", function () {
        parent.postMessage({ type: "cencori:close", key: cfg.key }, "*");
    });
    window.addEventListener("message", function (e) {
        if (e.source !== parent || !e.data) return;
        if (e.data.type === "cencori:focus") input.focus();
        else if (e.data.type === "cencori:appearance" && cfg.preview) applyLook(e.data.appearance);
    });

    render(false);
    // Coming back to a conversation: catch up once (the owner, or the assistant for them, may have written since), then poll as usual.
    if (state.sessionId) poll(); else schedulePoll();
    parent.postMessage({ type: "cencori:ready", key: cfg.key }, "*");
})();
