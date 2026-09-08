/**
 * Porter, on a website or inside the console.
 *
 * <script src="https://cdn.cencori.com/porter.js" data-porter="…" data-key="cpk_…" defer></script>
 *
 * window.CencoriPorter.mount({ target, porterId, apiKey, inline: true })
 * returns { destroy(), reset() }. Console callers supply getSession instead of apiKey.
 */
(function () {
    "use strict";

    var currentScript = document.currentScript;

    function safeUrl(value) {
        try {
            var url = new URL(value);
            return /^(https?:)$/.test(url.protocol) && !url.username && !url.password ? url.href : null;
        } catch (_error) {
            return null;
        }
    }

    function messageOf(body, fallback) {
        var error = body && body.error;
        return (typeof error === "string" ? error : error && error.message) || fallback;
    }

    function tokenLifetime(token) {
        try {
            var payload = token.replace(/^prts_/, "").split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
            return Math.max(0, JSON.parse(atob(payload)).e - Date.now() / 1000);
        } catch (_error) {
            return 1800;
        }
    }

    // A caller-owned session promise may outlive its widget. Stop waiting when the mount is gone.
    function abortable(promise, signal) {
        return new Promise(function (resolve, reject) {
            function aborted() { reject(new DOMException("Request cancelled", "AbortError")); }
            if (signal.aborted) { aborted(); return; }
            signal.addEventListener("abort", aborted, { once: true });
            Promise.resolve(promise).then(resolve, reject).finally(function () {
                signal.removeEventListener("abort", aborted);
            });
        });
    }

    function mount(options) {
        if (!options || !options.target || !options.porterId) {
            throw new Error("Porter needs a target element and porterId.");
        }
        if (!options.apiKey && !options.getSession) {
            throw new Error("Porter needs an apiKey or getSession callback.");
        }
        var base = safeUrl(options.baseUrl || "https://api.cencori.com");
        if (!base) throw new Error("Porter needs an HTTP or HTTPS base URL.");
        base = base.replace(/\/$/, "");
        var inline = options.inline === true;
        var destroyed = false;
        var generation = 0;
        var history = [];
        var credential = null;
        var busy = false;
        var opened = inline;
        var config = null;
        var startup = null;
        var active = null;
        var activeReader = null;
        var timers = new Set();
        var host = document.createElement("div");
        host.setAttribute("data-porter-host", options.porterId);
        host.style.cssText = inline
            ? "display:block;width:100%;height:100%;min-height:0;"
            : "position:fixed;z-index:2147483000;bottom:0;right:0;";
        var root = host.attachShadow({ mode: "open" });
        options.target.appendChild(host);

        function el(tag, className, text) {
            var node = document.createElement(tag);
            if (className) node.className = className;
            if (text != null) node.textContent = text;
            return node;
        }

        var style = el("style");
        style.textContent = [
            ":host{all:initial;--paper:#fbfaf7;--surface:#fff;--ink:#282823;--muted:#797971;--line:#e8e6df;--accent:#77796a;color-scheme:light}",
            "@media(prefers-color-scheme:dark){:host{--paper:#20211e;--surface:#262723;--ink:#eeeee7;--muted:#a4a49a;--line:#3b3c35;color-scheme:dark}}",
            "*{box-sizing:border-box}button,input,a{-webkit-tap-highlight-color:transparent}",
            "button,input{font:inherit}button{cursor:pointer}button:disabled{cursor:default}",
            "button:focus-visible,a:focus-visible{outline:2px solid var(--muted);outline-offset:4px}",
            ".panel,.launcher{font-family:'SF Pro Display','Geist Sans','Helvetica Neue',sans-serif;color:var(--ink);font-size:14px;line-height:1.6}",
            ".launcher{position:fixed;right:24px;bottom:24px;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 48px);padding:13px 18px;",
            "background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:0 6px 24px #00000008;animation:porter-in .4s both}",
            ".launcher-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;font-size:13px}",
            ".mark{width:8px;height:8px;flex:none;border-radius:2px;background:var(--accent)}",
            ".panel{display:flex;flex-direction:column;overflow:hidden;background:var(--surface);border:1px solid var(--line);border-radius:12px;",
            "animation:porter-in .38s cubic-bezier(.16,1,.3,1) both}",
            ".panel.floating{position:fixed;right:24px;bottom:24px;width:min(400px,calc(100vw - 32px));height:min(620px,calc(100dvh - 48px));box-shadow:0 12px 48px #0000000a}",
            ".panel.inline{width:100%;height:100%;min-height:0;border-radius:12px}",
            ".head{display:flex;align-items:center;gap:12px;padding:20px 22px;border-bottom:1px solid var(--line);flex:none}",
            ".logo{width:30px;height:30px;object-fit:contain;border-radius:5px}.identity{flex:1;min-width:0}",
            ".name{display:block;font-size:13px;font-weight:600;letter-spacing:-.015em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
            ".eyebrow{display:block;font-size:10px;letter-spacing:.015em;color:var(--muted)}",
            ".icon{display:flex;align-items:center;justify-content:center;flex:none;width:30px;height:30px;border:0;border-radius:4px;background:transparent;color:var(--muted)}",
            ".icon svg{width:15px;height:15px}.icon:hover{color:var(--ink);background:var(--paper)}",
            ".log{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:28px 22px 20px;display:flex;flex-direction:column;gap:24px;scrollbar-width:thin;scrollbar-color:var(--line) transparent}",
            ".row{animation:porter-in .28s both;flex:none}.row.you{align-self:flex-end;max-width:88%}",
            ".msg{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.65}",
            ".you .msg{padding:10px 14px;background:var(--paper);border:1px solid var(--line);border-radius:8px 8px 2px 8px}",
            ".welcome .msg{font-family:'Newsreader','Iowan Old Style','Palatino Linotype',Georgia,serif;font-size:25px;line-height:1.35;letter-spacing:-.035em;max-width:290px}",
            ".welcome{padding:8px 0 14px}.welcome-note{margin:14px 0 0;color:var(--muted);font-size:11px;line-height:1.6}",
            ".error .msg{color:var(--muted);font-size:13px}.citation{color:inherit;text-underline-offset:3px;font-size:.85em}",
            ".sources{margin-top:16px;padding-top:12px;border-top:1px solid var(--line)}",
            ".sources-label{font-family:'Geist Mono','SF Mono',monospace;font-size:8px;letter-spacing:.14em;color:var(--muted);text-transform:uppercase}",
            ".sources ul{list-style:none;padding:0;margin:6px 0 0;display:flex;flex-direction:column;gap:5px}",
            ".source{display:flex;align-items:baseline;gap:8px;font-size:11px;line-height:1.4;color:var(--muted);text-decoration:none}.source:hover{color:var(--ink)}",
            ".source-number{font-family:'Geist Mono','SF Mono',monospace;font-size:9px;flex:none}.source-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
            ".thinking{display:flex;align-items:center;gap:5px;height:24px;color:var(--muted)}",
            ".thinking i{display:block;width:4px;height:4px;background:currentColor;border-radius:50%;animation:porter-pulse 1.4s infinite}",
            ".thinking i:nth-child(2){animation-delay:.16s}.thinking i:nth-child(3){animation-delay:.32s}",
            ".foot{padding:14px 18px 0;flex:none}.form{display:flex;align-items:center;gap:8px;padding:8px 8px 8px 13px;border:1px solid var(--line);border-radius:7px;background:var(--paper)}",
            ".form:focus-within{border-color:var(--muted)}.form input{flex:1;min-width:0;background:none;border:0;outline:0;font-size:13px;height:28px;color:var(--ink)}",
            ".form input::placeholder{color:var(--muted)}.send{border:0;border-radius:4px;display:flex;align-items:center;justify-content:center;width:30px;height:30px;flex:none;background:var(--ink);color:var(--surface)}",
            ".send:disabled{opacity:.25}.send svg{width:16px;height:16px}.send,.launcher{transition:transform .18s ease}.send:active,.launcher:active{transform:scale(.97)}",
            ".by{padding:12px 0 15px;text-align:center;font-size:9px;letter-spacing:.02em;color:var(--muted)}.by a{color:inherit;text-decoration:none}.by a:hover{text-decoration:underline;text-underline-offset:3px}",
            ".notice{display:flex;flex:1;flex-direction:column;justify-content:center;align-items:flex-start;padding:28px;color:var(--muted);font-size:13px}.notice p{margin:0}.retry{margin-top:14px;background:transparent;border:0;padding:0;color:var(--ink);text-decoration:underline;text-underline-offset:4px}",
            "[hidden]{display:none!important}@keyframes porter-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}",
            "@keyframes porter-pulse{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-2px)}}",
            "@media(max-width:480px){.panel.floating{right:16px;bottom:16px;height:min(620px,calc(100dvh - 32px))}.launcher{right:16px;bottom:16px}}",
            "@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}",
        ].join("");
        root.appendChild(style);
        var accentStyle = el("style");
        root.appendChild(accentStyle);
        var launcher = null;
        if (!inline) {
            launcher = el("button", "launcher");
            launcher.type = "button";
            launcher.hidden = true;
            launcher.setAttribute("aria-haspopup", "dialog");
            launcher.setAttribute("aria-expanded", "false");
            launcher.appendChild(el("span", "mark"));
            launcher.appendChild(el("span", "launcher-label", "Ask a question"));
            launcher.addEventListener("click", toggle);
            root.appendChild(launcher);
        }
        var panel = null;
        var log = null;
        var input = null;
        var send = null;

        function timedController(milliseconds) {
            var controller = new AbortController();
            var timer = setTimeout(function () { controller.abort(); timers.delete(timer); }, milliseconds);
            timers.add(timer);
            controller.signal.addEventListener("abort", function () { clearTimeout(timer); timers.delete(timer); }, { once: true });
            return { controller: controller, finish: function () { clearTimeout(timer); timers.delete(timer); } };
        }

        async function session(signal, renew) {
            if (renew) credential = null;
            if (credential && Date.now() < credential.expiresAt) return credential.token;
            var result;
            if (options.getSession) {
                result = await abortable(options.getSession(), signal);
            } else {
                var response = await fetch(base + "/api/v1/porter/session", {
                    method: "POST", signal: signal,
                    headers: { "Content-Type": "application/json", Authorization: "Bearer " + options.apiKey },
                    body: JSON.stringify({ porterId: options.porterId }),
                });
                result = await response.json();
                if (!response.ok) throw new Error(messageOf(result, "Could not start a conversation."));
            }
            if (signal.aborted) throw new DOMException("Request cancelled", "AbortError");
            if (!result || typeof result.token !== "string" || !result.token) throw new Error("Could not start a conversation.");
            var seconds = typeof result.expiresIn === "number" ? result.expiresIn : 1800;
            if (seconds <= 0) throw new Error("This preview session has expired. Refresh the page to continue.");
            credential = { token: result.token, expiresAt: Date.now() + (seconds - Math.min(60, seconds / 10)) * 1000 };
            return credential.token;
        }

        function scroll() { if (log) log.scrollTop = log.scrollHeight; }

        function addMessage(who, text) {
            var row = el("div", "row " + who);
            row.appendChild(el("p", "msg", text));
            log.appendChild(row);
            scroll();
            return row;
        }

        function welcome() {
            if (!log || !config) return;
            var row = addMessage("them welcome", config.greeting || "How can I help?");
            row.appendChild(el("p", "welcome-note", config.ready ? "A little guidance, straight from the source." : "This assistant has not read its website yet."));
        }

        function iconButton(label, path) {
            var button = el("button", "icon");
            button.type = "button";
            button.setAttribute("aria-label", label);
            button.title = label;
            // The paths are constants in this file; remote content only ever becomes text nodes.
            button.innerHTML = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="' + path + '" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            return button;
        }

        function buildPanel() {
            if (panel) panel.remove();
            panel = el("section", "panel " + (inline ? "inline" : "floating"));
            panel.setAttribute("aria-label", (config ? config.name : "Porter") + " assistant");
            if (!inline) { panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "false"); }
            root.appendChild(panel);
            if (!config) return;
            var head = el("header", "head");
            var logoUrl = safeUrl(config.brand && config.brand.logo);
            if (logoUrl) {
                var logo = el("img", "logo");
                logo.src = logoUrl; logo.alt = "";
                logo.addEventListener("error", function () { logo.remove(); }, { once: true });
                head.appendChild(logo);
            } else {
                head.appendChild(el("span", "mark"));
            }
            var identity = el("div", "identity");
            identity.appendChild(el("span", "name", config.name || "Assistant"));
            identity.appendChild(el("span", "eyebrow", "Answers from this website"));
            head.appendChild(identity);
            var restart = iconButton("Start a new conversation", "M4 7a6 6 0 1 1 0 6M4 3v4h4");
            restart.addEventListener("click", reset);
            head.appendChild(restart);
            if (!inline) {
                var close = iconButton("Close assistant", "M5 5l10 10M15 5L5 15");
                close.addEventListener("click", toggle);
                head.appendChild(close);
            }
            panel.appendChild(head);
            log = el("div", "log");
            log.setAttribute("role", "log"); log.setAttribute("aria-live", "polite");
            panel.appendChild(log);
            welcome();
            var foot = el("div", "foot");
            var form = el("form", "form");
            input = el("input"); input.type = "text"; input.maxLength = 4000;
            input.placeholder = config.ready ? "Ask a question…" : "Not ready yet";
            input.setAttribute("aria-label", "Your question"); input.disabled = !config.ready;
            send = el("button", "send"); send.type = "submit";
            send.setAttribute("aria-label", "Send message"); send.disabled = true;
            send.innerHTML = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 15V5M5 10l5-5 5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            input.addEventListener("input", function () { send.disabled = busy || !config.ready || !input.value.trim(); });
            form.addEventListener("submit", function (event) { event.preventDefault(); void ask(); });
            form.appendChild(input); form.appendChild(send); foot.appendChild(form); panel.appendChild(foot);
            var by = el("div", "by", "Powered by ");
            var link = el("a", null, "Cencori"); link.href = "https://cencori.com"; link.target = "_blank"; link.rel = "noopener noreferrer";
            by.appendChild(link); panel.appendChild(by);
        }

        function toggle() {
            if (!config || destroyed || inline) return;
            opened = !opened;
            if (opened && !panel) buildPanel();
            if (panel) panel.hidden = !opened;
            launcher.hidden = opened;
            launcher.setAttribute("aria-expanded", String(opened));
            if (opened && input && !input.disabled) input.focus();
            if (!opened) launcher.focus();
        }

        function escape(event) { if (event.key === "Escape" && opened && !inline) toggle(); }
        if (!inline) document.addEventListener("keydown", escape);

        function sourcesOf(response) {
            try {
                var encoded = response.headers.get("X-Porter-Sources");
                if (!encoded) return [];
                var bytes = Uint8Array.from(atob(encoded), function (character) { return character.charCodeAt(0); });
                var sources = JSON.parse(new TextDecoder().decode(bytes));
                if (!Array.isArray(sources)) return [];
                return sources.slice(0, 30).map(function (source) {
                    var url = source && typeof source.url === "string" && safeUrl(source.url);
                    return url ? { url: url, title: typeof source.title === "string" ? source.title.slice(0, 300) : new URL(url).hostname } : null;
                });
            } catch (_error) { return []; }
        }

        function renderAnswer(row, answer, sources) {
            var message = row.querySelector(".msg");
            message.textContent = "";
            var pattern = /\[(\d+)\]/g;
            var match;
            var cursor = 0;
            var cited = new Set();
            while ((match = pattern.exec(answer))) {
                message.appendChild(document.createTextNode(answer.slice(cursor, match.index)));
                var index = Number(match[1]) - 1;
                var source = sources[index];
                if (source) {
                    var citation = el("a", "citation", match[0]);
                    citation.href = source.url; citation.target = "_blank"; citation.rel = "noopener noreferrer";
                    citation.setAttribute("aria-label", "Source " + (index + 1) + ": " + source.title);
                    message.appendChild(citation); cited.add(index);
                } else { message.appendChild(document.createTextNode(match[0])); }
                cursor = pattern.lastIndex;
            }
            message.appendChild(document.createTextNode(answer.slice(cursor)));
            if (!cited.size) return;
            var sourceBlock = el("div", "sources");
            sourceBlock.appendChild(el("span", "sources-label", "Sources"));
            var list = el("ul");
            cited.forEach(function (index) {
                var item = el("li");
                var link = el("a", "source"); link.href = sources[index].url; link.target = "_blank"; link.rel = "noopener noreferrer";
                link.appendChild(el("span", "source-number", String(index + 1).padStart(2, "0")));
                link.appendChild(el("span", "source-title", sources[index].title || new URL(sources[index].url).hostname));
                item.appendChild(link); list.appendChild(item);
            });
            sourceBlock.appendChild(list); row.appendChild(sourceBlock);
        }

        async function readAnswer(response, row, signal) {
            if (!(response.headers.get("Content-Type") || "").includes("text/event-stream")) {
                var body = await response.json();
                if (body.error) throw new Error(messageOf(body, "Could not finish this answer."));
                var choice = body.choices && body.choices[0];
                if (choice && choice.finish_reason && choice.finish_reason !== "stop") throw new Error("The answer was cut short. Please try again.");
                var content = choice && choice.message && choice.message.content;
                if (typeof content !== "string" || !content.trim()) throw new Error("No answer came back. Please try again.");
                return content;
            }
            var reader = response.body && response.body.getReader();
            if (!reader) throw new Error("This browser could not read the answer. Please try again.");
            activeReader = reader;
            var decoder = new TextDecoder();
            var buffer = "";
            var data = [];
            var answer = "";
            var completed = false;
            function frame() {
                if (!data.length) return;
                var payload = data.join("\n"); data = [];
                if (payload.trim() === "[DONE]") { completed = true; return; }
                var chunk;
                try { chunk = JSON.parse(payload); } catch (_error) { throw new Error("The answer was interrupted. Please try again."); }
                if (chunk.error) throw new Error(messageOf(chunk, "Could not finish this answer. Please try again."));
                var choice = chunk.choices && chunk.choices[0];
                if (choice && choice.finish_reason && choice.finish_reason !== "stop") throw new Error("The answer was cut short. Please try again.");
                var piece = choice && choice.delta && choice.delta.content;
                if (typeof piece === "string") {
                    answer += piece;
                    row.querySelector(".msg").textContent = answer;
                    scroll();
                }
            }
            function line(value) {
                value = value.replace(/\r$/, "");
                if (!value) { frame(); return; }
                if (value.indexOf("data:") === 0) data.push(value.slice(5).replace(/^ /, ""));
            }
            try {
                while (!completed) {
                    var result = await abortable(reader.read(), signal);
                    if (result.done) {
                        buffer += decoder.decode();
                        if (buffer) line(buffer);
                        frame();
                        break;
                    }
                    buffer += decoder.decode(result.value, { stream: true });
                    var end;
                    while ((end = buffer.indexOf("\n")) !== -1) {
                        line(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
                        if (completed) break;
                    }
                }
                if (!completed) throw new Error("The answer was interrupted. Please try again.");
                if (!answer.trim()) throw new Error("No answer came back. Please try again.");
                return answer;
            } finally {
                void reader.cancel().catch(function () {});
                if (activeReader === reader) activeReader = null;
            }
        }

        async function ask() {
            if (destroyed || busy || !config || !config.ready || !input || !input.value.trim()) return;
            var question = input.value.trim();
            var turnGeneration = generation;
            input.value = ""; input.disabled = true; send.disabled = true; busy = true;
            log.setAttribute("aria-busy", "true");
            addMessage("you", question);
            var reply = addMessage("them", "");
            var dots = el("span", "thinking");
            dots.setAttribute("aria-label", "Preparing an answer");
            dots.innerHTML = "<i></i><i></i><i></i>"; reply.querySelector(".msg").appendChild(dots);
            var task = timedController(120000); active = task.controller;
            var signal = task.controller.signal;
            try {
                var response;
                for (var attempt = 0; attempt < 2; attempt++) {
                    var token = await session(signal, attempt > 0);
                    response = await fetch(base + "/api/v1/porter/chat", {
                        method: "POST", signal: signal,
                        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
                        body: JSON.stringify({ message: question, history: history, stream: true }),
                    });
                    if (response.status !== 401 || attempt === 1) break;
                    if (response.body) void response.body.cancel().catch(function () {});
                }
                if (!response.ok) {
                    var errorBody = await response.json().catch(function () { return null; });
                    throw new Error(messageOf(errorBody, "Could not send your question. Please try again."));
                }
                var sources = sourcesOf(response);
                var answer = await readAnswer(response, reply, signal);
                if (destroyed || turnGeneration !== generation) return;
                renderAnswer(reply, answer, sources);
                history.push({ role: "user", content: question }, { role: "assistant", content: answer });
                history = history.slice(-20);
                scroll();
            } catch (error) {
                if (destroyed || turnGeneration !== generation) return;
                reply.remove();
                addMessage("them error", signal.aborted ? "That took too long. Please try again." : error.message || "Could not finish this answer. Please try again.");
                input.value = question;
            } finally {
                task.finish();
                if (active === task.controller) active = null;
                if (!destroyed && turnGeneration === generation) {
                    busy = false; input.disabled = !config.ready; send.disabled = !config.ready || !input.value.trim();
                    log.setAttribute("aria-busy", "false");
                    if (opened && !input.disabled) input.focus();
                }
            }
        }

        function reset() {
            if (destroyed) return;
            generation += 1;
            if (active) active.abort();
            if (activeReader) void activeReader.cancel().catch(function () {});
            history = []; credential = null; busy = false;
            if (log) { log.textContent = ""; log.setAttribute("aria-busy", "false"); welcome(); }
            if (input) { input.value = ""; input.disabled = !config.ready; send.disabled = true; }
        }

        function destroy() {
            if (destroyed) return;
            destroyed = true; generation += 1;
            if (startup) startup.abort();
            if (active) active.abort();
            if (activeReader) void activeReader.cancel().catch(function () {});
            timers.forEach(function (timer) { clearTimeout(timer); }); timers.clear();
            document.removeEventListener("keydown", escape);
            host.remove(); history = []; credential = null;
        }

        async function load() {
            var task = timedController(20000); startup = task.controller;
            if (inline) {
                buildPanel();
                var loading = el("div", "notice"); loading.setAttribute("role", "status");
                loading.appendChild(el("p", null, "Getting your assistant ready…")); panel.appendChild(loading);
            }
            try {
                var auth = options.apiKey || await session(task.controller.signal, false);
                var response = await fetch(base + "/api/v1/porter/config?porter=" + encodeURIComponent(options.porterId), {
                    signal: task.controller.signal, headers: { Authorization: "Bearer " + auth },
                });
                if (response.status === 401 && !options.apiKey) {
                    auth = await session(task.controller.signal, true);
                    response = await fetch(base + "/api/v1/porter/config?porter=" + encodeURIComponent(options.porterId), {
                        signal: task.controller.signal, headers: { Authorization: "Bearer " + auth },
                    });
                }
                var body = await response.json();
                if (!response.ok) throw new Error(messageOf(body, "This assistant is unavailable right now."));
                if (destroyed) return;
                config = body;
                var color = body.brand && body.brand.color;
                if (typeof color === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) accentStyle.textContent = ":host{--accent:" + color + "}";
                if (inline) buildPanel();
                else {
                    var name = typeof body.name === "string" ? body.name : "";
                    launcher.querySelector(".launcher-label").textContent = name && name.length <= 18 ? "Ask " + name : "Ask a question";
                    launcher.setAttribute("aria-label", name ? "Ask " + name : "Ask a question");
                    launcher.hidden = false;
                }
            } catch (error) {
                if (destroyed) return;
                if (!inline) { destroy(); return; }
                buildPanel();
                var notice = el("div", "notice"); notice.setAttribute("role", "alert");
                notice.appendChild(el("p", null, task.controller.signal.aborted ? "The assistant took too long to load." : error.message || "This assistant is unavailable right now."));
                var retry = el("button", "retry", "Try again"); retry.type = "button";
                retry.addEventListener("click", function () { void load(); }, { once: true });
                notice.appendChild(retry); panel.appendChild(notice);
            } finally {
                task.finish(); if (startup === task.controller) startup = null;
            }
        }

        void load();
        return { destroy: destroy, reset: reset };
    }

    if (!window.CencoriPorter) window.CencoriPorter = { mount: mount };

    // Loading this file without data attributes registers the library for a framework-owned mount.
    if (currentScript && currentScript.getAttribute("data-porter")) {
        var apiKey = currentScript.getAttribute("data-key");
        var givenSession = currentScript.getAttribute("data-session");
        var porterId = currentScript.getAttribute("data-porter");
        var baseUrl = currentScript.getAttribute("data-base") || "https://api.cencori.com";
        var getSession;
        if (givenSession && !apiKey) {
            var firstSession = givenSession;
            getSession = async function () {
                if (firstSession) {
                    var token = firstSession; firstSession = null;
                    return { token: token, expiresIn: tokenLifetime(token) };
                }
                // Older same-origin preview snippets can renew through their membership check.
                if (new URL(baseUrl).origin !== window.location.origin) throw new Error("This preview session has expired. Refresh the page to continue.");
                var response = await fetch(baseUrl.replace(/\/$/, "") + "/api/porter/" + encodeURIComponent(porterId) + "/preview-session", { method: "POST" });
                var body = await response.json();
                if (!response.ok) throw new Error(messageOf(body, "Could not renew the preview."));
                return body;
            };
        }
        function boot() {
            if (!apiKey && !getSession) return;
            window.CencoriPorter.mount({ target: document.body, porterId: porterId, apiKey: apiKey, getSession: getSession, baseUrl: baseUrl });
        }
        if (document.body) boot();
        else document.addEventListener("DOMContentLoaded", boot, { once: true });
    }
})();
