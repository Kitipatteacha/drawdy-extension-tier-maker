import { defaultConfig, MAX_LABEL_LENGTH, MAX_ROWS } from "../table/config";
import { TIER_COLORS } from "../table/palette";

const CONFIG = JSON.stringify({
  colours: TIER_COLORS,
  fallback: defaultConfig(),
  maxRows: MAX_ROWS,
  maxLabel: MAX_LABEL_LENGTH,
});

const BODY = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style id="styling">:root{/*__DRAWDY_STYLING__*/}</style>
<style>
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 12px;
    background: var(--drawdy-background, #fff);
    color: var(--drawdy-foreground, #111);
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
}
button { font: inherit; }

/* ---- shell ---------------------------------------------------------- */
.icon-btn {
    appearance: none;
    width: 26px;
    height: 26px;
    flex: none;
    padding: 0;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--drawdy-radius-md, 8px);
    background: transparent;
    color: var(--drawdy-muted-foreground, #888);
    cursor: pointer;
}
.icon-btn:hover { background: var(--drawdy-surface, #f4f4f4); color: var(--drawdy-foreground, #111); }
.icon-btn:disabled { opacity: 0.35; cursor: default; }
.icon-btn svg { width: 15px; height: 15px; }

main { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 14px; }

section { display: flex; flex-direction: column; gap: 8px; }
h2 {
    margin: 0;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--drawdy-muted-foreground, #888);
}

/* ---- fields --------------------------------------------------------- */
input[type="text"] {
    width: 100%;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    font: inherit;
    color: inherit;
    border: 1px solid var(--drawdy-border, #e5e5e5);
    border-radius: var(--drawdy-radius-md, 8px);
    background: var(--drawdy-surface, #f6f6f6);
}
input[type="text"]:focus-visible {
    outline: 2px solid var(--drawdy-ring, #6366f1);
    outline-offset: -1px;
}

/* ---- rows ----------------------------------------------------------- */
.rows { display: flex; flex-direction: column; gap: 4px; }
.row {
    display: flex;
    align-items: center;
    gap: 5px;
}
.row input[type="color"] {
    appearance: none;
    flex: none;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 1px solid var(--drawdy-border, #e5e5e5);
    border-radius: var(--drawdy-radius-md, 6px);
    background: none;
    cursor: pointer;
}
.row input[type="color"]::-webkit-color-swatch-wrapper { padding: 2px; }
.row input[type="color"]::-webkit-color-swatch { border: 0; border-radius: 3px; }
.row input[type="text"] { height: 26px; flex: 1; }
.row .count {
    flex: none;
    min-width: 20px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 10.5px;
    color: var(--drawdy-muted-foreground, #888);
}
.row .icon-btn { width: 22px; height: 22px; margin-left: 0; }
.row .icon-btn svg { width: 12px; height: 12px; }

.ghost {
    appearance: none;
    width: 100%;
    height: 28px;
    border: 1px dashed var(--drawdy-border, #d5d5d5);
    border-radius: var(--drawdy-radius-md, 8px);
    background: transparent;
    color: var(--drawdy-muted-foreground, #888);
    cursor: pointer;
}
.ghost:hover:not(:disabled) { color: var(--drawdy-foreground, #111); border-color: var(--drawdy-foreground, #111); }
.ghost:disabled { opacity: 0.4; cursor: default; }


/* ---- image drop zone ------------------------------------------------ */
.dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 14px 10px;
    text-align: center;
    border: 1px dashed var(--drawdy-border, #d5d5d5);
    border-radius: var(--drawdy-radius-lg, 12px);
    color: var(--drawdy-muted-foreground, #888);
    cursor: pointer;
}
.dropzone:hover, .dropzone.over {
    border-color: var(--drawdy-primary, #6366f1);
    color: var(--drawdy-primary, #6366f1);
}
.dropzone strong { font-size: 11.5px; font-weight: 600; }
.dropzone span { font-size: 10.5px; line-height: 1.45; }
.dropzone input { display: none; }
.dropzone svg { width: 22px; height: 22px; margin-bottom: 2px; }

/* ---- footer --------------------------------------------------------- */
footer {
    flex: none;
    display: flex;
    flex-direction: column;
    padding: 0 12px 12px;
    background: var(--drawdy-background, #fff);
}
/* Only takes up room while there is something to say, so the resting footer
   is exactly the hairline and the button. */
#status { font-size: 10.5px; line-height: 1.3; padding-bottom: 8px; color: var(--drawdy-muted-foreground, #888); }
#status:empty { display: none; }
#status.error { color: var(--drawdy-destructive, #e5484d); }
.actions {
    display: flex;
    padding-top: 8px;
    border-top: 1px solid var(--drawdy-border, #e5e5e5);
}
/* Lemma's primary button (variant "primary", style "fill", size "md"),
   carried over from frontend/app/globals.css. The lime is the same in both
   themes; border, hover, ring and disabled tones follow the host's
   color-scheme via light-dark(), with the light value as the fallback. */
.btn {
    appearance: none;
    flex: 1;
    height: 36px;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 600;
    line-height: 20px;
    white-space: nowrap;
    user-select: none;
    border: 1px solid #b3e000;
    border-color: light-dark(#b3e000, transparent);
    border-radius: 10px;
    background: #c5f601;
    background-clip: padding-box;
    color: #090909;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.06);
    cursor: pointer;
    transition: background-color 150ms, border-color 150ms, box-shadow 150ms, color 150ms;
}
.btn:hover:not(:disabled) {
    background-color: #e1ff6d;
    background-color: light-dark(#e1ff6d, #d4ff2e);
}
.btn:focus-visible {
    outline: none;
    background-color: #b3e000;
    background-color: light-dark(#b3e000, #c5f601);
    box-shadow: 0 0 0 2px var(--drawdy-background, #fff), 0 0 0 4px #9cc400;
    box-shadow: 0 0 0 2px var(--drawdy-background, #fff), 0 0 0 4px light-dark(#9cc400, #b3e000);
}
.btn:active:not(:disabled) { background-color: #9cc400; }
.btn:disabled {
    pointer-events: none;
    border-color: transparent;
    background-color: #0000000f;
    background-color: light-dark(#0000000f, #ffffff0f);
    color: #09090b4d;
    color: light-dark(#09090b4d, #ffffff4d);
    box-shadow: none;
}
</style>
</head>
<body>

<main>
    <section>
        <h2>Tiers</h2>
        <div class="rows" id="rows"></div>
        <button class="ghost" id="add-row" type="button">+ Add a tier</button>
    </section>

    <section>
        <h2>Images</h2>
        <label class="dropzone" id="dropzone">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15.5V4.5M8 8.5l4-4 4 4"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>
            <strong>Drop images here</strong>
            <span>or click to choose files &mdash; they land in the pool, or loose on the canvas if there is no tier list yet.</span>
            <input type="file" id="files" accept="image/*" multiple />
        </label>
        <button class="ghost" id="normalize" type="button" disabled>Fit images to image height</button>
        <button class="ghost" id="reset" type="button" disabled>Send everything back to the pool</button>
    </section>
</main>

<footer>
    <div id="status"></div>
    <div class="actions">
        <button class="btn" id="place" type="button">Create Table</button>
    </div>
</footer>

<script>
(function () {
    var CONFIG = ${CONFIG};
    var api = acquireDrawdyApi();

    var SAVE_DEBOUNCE_MS = 600;
    var STATUS_MS = 4000;

    var $ = function (id) { return document.getElementById(id); };
    var rowsWrap = $("rows");
    var placeBtn = $("place");
    var statusEl = $("status");
    var dropzone = $("dropzone");

    var seq = 0;
    var newRowId = function () {
        return "r" + Date.now().toString(36) + (seq++).toString(36);
    };

    var state = {
        config: clone(CONFIG.fallback),
        tableId: null,
        counts: {},
        busy: false
    };
    var saveTimer = null;
    var statusTimer = null;

    function clone(value) { return JSON.parse(JSON.stringify(value)); }

    /* ---- status ---------------------------------------------------- */

    function say(text, tone) {
        statusEl.textContent = text;
        statusEl.className = tone === "error" ? "error" : "";
        if (statusTimer) clearTimeout(statusTimer);
        if (text) statusTimer = setTimeout(function () { say(""); }, STATUS_MS);
    }

    /* ---- the tier list editor --------------------------------------- */

    function svgIcon(path) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + path + "</svg>";
    }

    function iconButton(title, path, onClick, disabled) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "icon-btn";
        button.title = title;
        button.setAttribute("aria-label", title);
        button.innerHTML = svgIcon(path);
        button.disabled = !!disabled;
        button.addEventListener("click", onClick);
        return button;
    }

    function renderRows() {
        rowsWrap.innerHTML = "";
        var rows = state.config.rows;
        for (var i = 0; i < rows.length; i++) {
            rowsWrap.appendChild(renderRow(rows[i], i, rows.length));
        }
        $("add-row").disabled = rows.length >= CONFIG.maxRows;
    }

    function renderRow(row, index, total) {
        var el = document.createElement("div");
        el.className = "row";

        var colour = document.createElement("input");
        colour.type = "color";
        colour.value = /^#[0-9a-fA-F]{6}$/.test(row.color) ? row.color : "#ff7f7f";
        colour.title = "Tier colour";
        colour.addEventListener("input", function () {
            row.color = colour.value;
            changed(false);
        });

        var label = document.createElement("input");
        label.type = "text";
        label.value = row.label;
        label.maxLength = CONFIG.maxLabel;
        label.placeholder = "Tier " + (index + 1);
        label.addEventListener("input", function () {
            row.label = label.value;
            changed(false);
        });

        var count = document.createElement("span");
        count.className = "count";
        var n = state.counts[row.id] || 0;
        count.textContent = state.tableId === null ? "" : String(n);
        count.title = n + " item" + (n === 1 ? "" : "s") + " in this tier";

        el.appendChild(colour);
        el.appendChild(label);
        el.appendChild(count);
        el.appendChild(iconButton("Move up", '<path d="M12 19V5M5 12l7-7 7 7"/>', function () {
            swapRows(index, index - 1);
        }, index === 0));
        el.appendChild(iconButton("Move down", '<path d="M12 5v14M19 12l-7 7-7-7"/>', function () {
            swapRows(index, index + 1);
        }, index === total - 1));
        el.appendChild(iconButton("Remove tier", '<path d="M6 6l12 12M18 6L6 18"/>', function () {
            state.config.rows.splice(index, 1);
            changed(true);
        }, total <= 1));
        return el;
    }

    function swapRows(from, to) {
        var rows = state.config.rows;
        if (to < 0 || to >= rows.length) return;
        var moved = rows[from];
        rows[from] = rows[to];
        rows[to] = moved;
        changed(true);
    }

    /* ---- change plumbing -------------------------------------------- */

    // A structural change redraws the tier list editor too; a keystroke in a label
    // must not, or the caret would jump to the end of the box.
    function changed(structural) {
        if (structural) renderRows();
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            api.postMessage({ type: "save-config", config: state.config });
        }, SAVE_DEBOUNCE_MS);
    }

    function applyConfig(config) {
        state.config = config;
        renderRows();
    }

    function setEditing(tableId, counts) {
        state.tableId = tableId;
        state.counts = counts || {};
        placeBtn.textContent = tableId === null ? "Create Table" : "Update Table";
        $("normalize").disabled = tableId === null;
        $("reset").disabled = tableId === null;
    }

    /* ---- controls ---------------------------------------------------- */

    $("add-row").addEventListener("click", function () {
        var rows = state.config.rows;
        if (rows.length >= CONFIG.maxRows) return;
        var colours = CONFIG.colours;
        rows.push({
            id: newRowId(),
            label: String(rows.length + 1),
            color: colours[rows.length % colours.length]
        });
        changed(true);
    });

    /* ---- placing and editing ---------------------------------------- */

    function place() {
        if (state.busy) return;
        if (state.tableId !== null) {
            api.postMessage({ type: "update", tableId: state.tableId, config: state.config });
        } else {
            api.postMessage({ type: "insert", config: state.config });
        }
    }

    placeBtn.addEventListener("click", place);
    $("normalize").addEventListener("click", function () {
        api.postMessage({ type: "normalize", tableId: state.tableId });
    });
    $("reset").addEventListener("click", function () {
        api.postMessage({ type: "reset", tableId: state.tableId });
    });


    document.addEventListener("keydown", function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            place();
        }
    });

    /* ---- images ------------------------------------------------------ */

    // Natural size travels with the bytes so the driver can keep the aspect
    // ratio without ever decoding the file itself.
    function readImage(file) {
        return new Promise(function (resolve) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
                var width = img.naturalWidth;
                var height = img.naturalHeight;
                URL.revokeObjectURL(url);
                if (!width || !height) { resolve(null); return; }
                file.arrayBuffer().then(function (bytes) {
                    resolve({
                        name: file.name,
                        mime: file.type || "image/png",
                        bytes: bytes,
                        width: width,
                        height: height
                    });
                }, function () { resolve(null); });
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                resolve(null);
            };
            img.src = url;
        });
    }

    function sendImages(fileList) {
        var files = [];
        for (var i = 0; i < fileList.length; i++) {
            if (/^image\\//.test(fileList[i].type)) files.push(fileList[i]);
        }
        if (files.length === 0) {
            say("Those files are not images.", "error");
            return;
        }
        say("Reading " + files.length + " image" + (files.length === 1 ? "" : "s") + "\\u2026");
        Promise.all(files.map(readImage)).then(function (images) {
            var usable = images.filter(function (image) { return image !== null; });
            if (usable.length === 0) {
                say("None of those images could be read.", "error");
                return;
            }
            api.postMessage(
                { type: "add-images", tableId: state.tableId, images: usable },
                usable.map(function (image) { return image.bytes; })
            );
        });
    }

    $("files").addEventListener("change", function (e) {
        sendImages(e.currentTarget.files);
        e.currentTarget.value = "";
    });

    ["dragenter", "dragover"].forEach(function (type) {
        dropzone.addEventListener(type, function (e) {
            e.preventDefault();
            dropzone.classList.add("over");
        });
    });
    ["dragleave", "dragend"].forEach(function (type) {
        dropzone.addEventListener(type, function () { dropzone.classList.remove("over"); });
    });
    dropzone.addEventListener("drop", function (e) {
        e.preventDefault();
        dropzone.classList.remove("over");
        if (e.dataTransfer && e.dataTransfer.files.length > 0) sendImages(e.dataTransfer.files);
    });
    // A file missing the drop zone would otherwise navigate the panel away.
    ["dragover", "drop"].forEach(function (type) {
        document.addEventListener(type, function (e) { e.preventDefault(); });
    });

    /* ---- driver messages --------------------------------------------- */

    api.onMessage(function (raw) {
        if (!raw) return;
        if (raw.type === "init") {
            if (raw.css) $("styling").textContent = ":root{" + raw.css + "}";
            applyConfig(raw.config || clone(CONFIG.fallback));
        } else if (raw.type === "styling") {
            $("styling").textContent = ":root{" + raw.css + "}";
        } else if (raw.type === "edit") {
            setEditing(raw.tableId, raw.counts);
            applyConfig(raw.config);
        } else if (raw.type === "edit-cleared") {
            setEditing(null, {});
            renderRows();
        } else if (raw.type === "counts") {
            if (raw.tableId !== state.tableId) return;
            state.counts = raw.counts || {};
            renderRows();
        } else if (raw.type === "status") {
            say(raw.text, raw.tone);
        } else if (raw.type === "busy") {
            state.busy = !!raw.busy;
            placeBtn.disabled = state.busy;
            $("normalize").disabled = state.busy || state.tableId === null;
            $("reset").disabled = state.busy || state.tableId === null;
        }
    });

    setEditing(null, {});
    applyConfig(state.config);
    api.postMessage({ type: "ready" });
})();
</script>
</body>
</html>`;

export const WEBVIEW_HTML = BODY;
