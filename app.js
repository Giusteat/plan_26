// ======================= REGOLE (si possono modificare) =======================
// 1) Correzioni di categoria, solo nell'interfaccia: vale la prima regola che combacia col titolo.
const CATEGORY_RULES = [
    [/reformer/i, "Pilates Reformer"],
    [/pilates/i, "Pilates"],
    [/\bpole\b/i, "Pole Dance"],
    [/\bballet+\b|\bjazz\b/i, "Dance"],
    [/cyclica/i, "Fitness"]
];
// 2) Voci del filtro: [nome mostrato, categorie dentro]
const GROUPS = [
    ["Pilates & Barre", ["Pilates", "Barre"]], ["Pilates Reformer", ["Pilates Reformer"]], ["Pole Dance", ["Pole Dance"]],
    ["Yoga & Meditation", ["Yoga", "Meditation", "Aerial"]], ["Fitness", ["Fitness"]], ["Dance", ["Dance"]],
    ["Functional Training", ["Functional Training"]]
];
// 3) Colori per categoria: [sfondo, testo]
const COLORS = {
    "Pilates": ["#e0f2fe", "#0369a1"], "Barre": ["#fee2e2", "#b91c1c"], "Pilates Reformer": ["#fce7f3", "#be185d"],
    "Pole Dance": ["#f3e8ff", "#6b21a8"], "Yoga": ["#dcfce7", "#15803d"], "Meditation": ["#e0e7ff", "#4338ca"],
    "Aerial": ["#ecfccb", "#4d7c0f"], "Fitness": ["#ffedd5", "#c2410c"], "Dance": ["#fef08a", "#854d0e"],
    "Functional Training": ["#ccfbf1", "#0f766e"]
};
// 4) Titoli: parole che restano tutte maiuscole
const KEEP_CAPS = ["USC", "HIIT", "TRX", "DJ", "FLINTA", "HALO"];
// ==============================================================================

const PLANS = [["M", "Classic"], ["L", "Premium"], ["XL", "Max"]];
const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const HOUR_H = 60;
const GROUP_OF = {};
GROUPS.forEach(([g, cats]) => cats.forEach(c => { GROUP_OF[c] = g; }));

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const pad = n => String(n).padStart(2, "0");
const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = d => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
const todayDate = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
const fmt = d => d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
const dayName = d => DAYS[(d.getDay() + 6) % 7];
const store = {
    get(k, f) { try { const v = localStorage.getItem(k); return v === null ? f : JSON.parse(v); } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};

// Titolo ordinato per la visualizzazione (il titolo originale resta nei dati)
function formatTitle(t) {
    let s = t.replace(/\s+\|\s+/g, " · ");
    s = s.replace(/\s*·\s*in English\b/i, " (EN)").replace(/\bin English\b/i, "(EN)");
    s = s.replace(/\b(DE|EN)\s*\/\s*(DE|EN)\b/g, "$1/$2");
    s = s.replace(/\s*NEW ?TIME!*/i, "");
    s = s.replace(/\s*\b\d{2,3}\s*Mi(?:n(?:utes?)?)?\b/i, "");
    s = s.trim().split(/\s+/).map(w => {
        const m = w.match(/^\(?((?:DE|EN)(?:\/(?:DE|EN))?)\)?$/);
        if (m) return `(${m[1]})`;
        const core = w.replace(/[.:!*,]+$/, "");
        if (/^[A-ZÄÖÜ]{2,}$/.test(core) && !KEEP_CAPS.includes(core)) return core[0] + core.slice(1).toLowerCase() + w.slice(core.length);
        return w;
    }).join(" ");
    return s.replace(/\s*[·\-–]\s*$/, "").trim();
}
function effectiveCategory(c) {
    for (const [re, cat] of CATEGORY_RULES) if (re.test(c.title)) return cat;
    return (c.category || {}).name || "-";
}

let classes = [], venues = {}, startHour = 7, endHour = 22, minDay, maxDay;
const S = { cat: new Set(), venue: new Set(), plan: store.get("plan", ""), fav: false, view: 7, start: null, day: null };
const favs = new Set(store.get("favs", []));
const mobile = window.matchMedia("(max-width: 760px)");

// Un preferito = stesso studio, titolo originale, giorno della settimana, ora e insegnante
function prep(c) {
    c.date = c.startDateTimeUTC.slice(0, 10);
    c.start = c.startDateTimeUTC.slice(11, 16);
    c.end = c.endDateTimeUTC.slice(11, 16);
    c.dow = (parse(c.date).getDay() + 6) % 7;
    c.studio = (venues[c.venue] || {}).name || c.venue;
    c.cat = effectiveCategory(c);
    c.group = GROUP_OF[c.cat] || c.cat;
    c.name = formatTitle(c.title);
    c.plans = c.planTypesB2C || [];
    c.key = [c.venue, c.title, c.dow, c.start, c.teacherName || ""].join("|");
    return c;
}
// Un corso passa i filtri se li rispetta tutti; "skip" ignora un filtro (serve per capire cosa è ancora scegliibile)
const matches = (c, skip) =>
    (skip === "cat" || !S.cat.size || S.cat.has(c.group)) && (skip === "venue" || !S.venue.size || S.venue.has(c.studio)) &&
    (skip === "plan" || !S.plan || c.plans.includes(S.plan)) && (skip === "fav" || !S.fav || favs.has(c.key));
const visible = c => matches(c, null);
const UI = { cat: new Map(), venue: new Map(), plan: new Map(), fav: null };

// Le voci che non darebbero nessun corso diventano grigie e non cliccabili (quelle già scelte restano cliccabili)
function updateAvailability() {
    const avail = (skip, get) => {
        const out = new Set();
        classes.forEach(c => { if (matches(c, skip)) get(c).forEach(v => out.add(v)); });
        return out;
    };
    const apply = (reg, ok, selected) => reg.forEach(({ i, l }, v) => {
        const off = !ok.has(v) && !selected(v);
        i.disabled = off; l.classList.toggle("off", off);
    });
    apply(UI.cat, avail("cat", c => [c.group]), v => S.cat.has(v));
    apply(UI.venue, avail("venue", c => [c.studio]), v => S.venue.has(v));
    apply(UI.plan, avail("plan", c => c.plans), v => v === "" || S.plan === v);
    if (UI.fav) UI.fav.disabled = !S.fav && !classes.some(c => matches(c, "fav") && favs.has(c.key));
}
const colorOf = c => COLORS[c.cat] || ["#e5e7eb", "#374151"];

function toggleFav(c) {
    favs.has(c.key) ? favs.delete(c.key) : favs.add(c.key);
    store.set("favs", [...favs]);
    render();
}

// ---------- filtri ----------
function multi(label, items, set, reg) {
    const d = el("details", "dd"), s = el("summary", null, label), p = el("div", "panel");
    d.append(s, p);
    items.forEach(name => {
        const l = el("label"), i = el("input");
        i.type = "checkbox";
        reg.set(name, { i, l });
        i.onchange = () => {
            i.checked ? set.add(name) : set.delete(name);
            s.textContent = label + (set.size ? ` (${set.size})` : "");
            render();
        };
        l.append(i, document.createTextNode(" " + name));
        p.appendChild(l);
    });
    return d;
}
function planFilter() {
    const d = el("details", "dd"), s = el("summary"), p = el("div", "panel");
    d.append(s, p);
    const upd = () => { s.textContent = "Piano: " + (S.plan ? PLANS.find(x => x[0] === S.plan)[1] : "tutti"); };
    [["", "Tutti"], ...PLANS].forEach(([v, n]) => {
        const l = el("label"), i = el("input");
        i.type = "radio"; i.name = "plan"; i.checked = S.plan === v;
        UI.plan.set(v, { i, l });
        i.onchange = () => { S.plan = v; store.set("plan", v); upd(); d.open = false; render(); };
        l.append(i, document.createTextNode(" " + n));
        p.appendChild(l);
    });
    upd();
    return d;
}
document.addEventListener("click", e =>
    document.querySelectorAll("details.dd[open]").forEach(d => { if (!d.contains(e.target)) d.open = false; }));

// ---------- griglia (computer): 1, 4 o 7 giorni ----------
function layout(list) {
    const evs = list.map(c => ({ ...c, a: toMin(c.start), z: toMin(c.end) })).sort((x, y) => x.a - y.a);
    const clusters = [];
    let cur = [];
    evs.forEach(ev => {
        if (cur.length && ev.a >= Math.max(...cur.map(x => x.z))) { clusters.push(cur); cur = []; }
        cur.push(ev);
    });
    if (cur.length) clusters.push(cur);
    clusters.forEach(cl => {
        const cols = [];
        cl.forEach(ev => {
            let i = cols.findIndex(col => col[col.length - 1].z <= ev.a);
            if (i === -1) { cols.push([]); i = cols.length - 1; }
            cols[i].push(ev);
            ev.col = i;
        });
        cl.forEach(ev => { ev.cols = cols.length; });
    });
    return evs;
}
const isPast = (c, todayIso, nowMin) => c.date < todayIso || (c.date === todayIso && toMin(c.end) < nowMin);

function renderGrid(view, list) {
    const n = S.view, now = new Date(), todayIso = iso(now), nowMin = now.getHours() * 60 + now.getMinutes();
    const grid = el("div", "grid");
    grid.style.gridTemplateColumns = `48px repeat(${n}, minmax(0, 1fr))`;
    view.appendChild(grid);
    grid.appendChild(el("div", "gh"));
    const days = Array.from({ length: n }, (_, i) => addDays(S.start, i));
    days.forEach(d => grid.appendChild(el("div", "gh" + (iso(d) === todayIso ? " today" : ""), `${dayName(d)} ${d.getDate()}`)));
    const cols = [];
    for (let h = startHour; h <= endHour; h++) {
        grid.appendChild(el("div", "ts", `${pad(h)}:00`));
        for (let i = 0; i < n; i++) {
            const c = el("div", "dc");
            grid.appendChild(c);
            if (h === startHour) cols[i] = c;
        }
    }
    days.forEach((d, i) => {
        const dayIso = iso(d);
        layout(list.filter(c => c.date === dayIso)).forEach(ev => {
            const [bg, fg] = colorOf(ev), w = 100 / ev.cols;
            const b = el("div", "ev" + (isPast(ev, todayIso, nowMin) ? " past" : ""));
            Object.assign(b.style, {
                background: bg, color: fg, top: `${((ev.a - startHour * 60) / 60) * HOUR_H}px`,
                height: `${Math.max(((ev.z - ev.a) / 60) * HOUR_H, 22)}px`,
                left: `calc(${ev.col * w}% + 1px)`, width: `calc(${w}% - 2px)`
            });
            b.title = `${ev.name}\n${ev.start}–${ev.end} · ${ev.studio}\n${ev.teacherName || ""}`;
            b.append(el("div", "t", ev.name), el("div", "s", `${ev.start}–${ev.end} · ${ev.studio}`));
            if (n <= 4 && ev.teacherName) b.appendChild(el("div", "tc", ev.teacherName));
            if (favs.has(ev.key)) b.appendChild(el("span", "h", "♥"));
            b.onclick = () => openSheet(ev);
            cols[i].appendChild(b);
        });
        if (dayIso === todayIso && nowMin >= startHour * 60 && nowMin <= (endHour + 1) * 60) {
            const line = el("div", "now");
            line.style.top = `${((nowMin - startHour * 60) / 60) * HOUR_H}px`;
            cols[i].appendChild(line);
        }
    });
}

// ---------- lista del giorno (telefono) ----------
function renderDay(view, list) {
    const now = new Date(), todayIso = iso(now), nowMin = now.getHours() * 60 + now.getMinutes();
    const items = list.filter(c => c.date === iso(S.day))
        .sort((a, b) => a.start.localeCompare(b.start) || a.studio.localeCompare(b.studio));
    if (!items.length) { view.appendChild(el("p", "empty", "Nessun corso con questi filtri.")); return; }
    items.forEach(c => {
        const row = el("div", "row" + (isPast(c, todayIso, nowMin) ? " past" : ""));
        row.style.borderLeftColor = colorOf(c)[1];
        const bd = el("div", "bd");
        bd.append(el("div", "tt", c.name), el("div", "sub", `${c.studio} · ${c.teacherName || "–"}`));
        const h = el("button", "heart", favs.has(c.key) ? "♥" : "♡");
        h.setAttribute("aria-label", "Preferito");
        h.onclick = e => { e.stopPropagation(); toggleFav(c); };
        row.append(el("div", "tm", `${c.start}–${c.end}`), bd, h);
        row.onclick = () => openSheet(c);
        view.appendChild(row);
    });
}

// ---------- scheda del corso ----------
function closeSheet() { $("sheet").hidden = true; }
function openSheet(c) {
    const sh = $("sheet"), v = venues[c.venue] || {};
    sh.innerHTML = ""; sh.hidden = false;
    const box = el("div", "box");
    const x = el("button", "x", "✕"); x.onclick = closeSheet;
    const addr = [v.address, [v.postalCode, v.district].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const plans = PLANS.filter(([k]) => c.plans.includes(k)).map(p => p[1]).join(", ");
    const rows = [
        ["Quando", `${DAYS[c.dow]} ${parse(c.date).toLocaleDateString("it-IT", { day: "numeric", month: "long" })}, ${c.start}–${c.end}`],
        ["Insegnante", c.teacherName || "–"], ["Studio", c.studio], ["Indirizzo", addr || "–"], ["Categoria", c.group],
        ["Posti", c.spots && c.spots.max != null ? String(c.spots.max) : "–"], ["Piani", plans || "–"]
    ];
    const dl = el("dl");
    rows.forEach(([k, val]) => dl.append(el("dt", null, k), el("dd", null, val)));
    const links = el("div", "links");
    const heart = el("button", "btn");
    const label = () => { heart.textContent = favs.has(c.key) ? "♥ Nei preferiti" : "♡ Aggiungi ai preferiti"; };
    label();
    heart.onclick = () => { toggleFav(c); label(); };
    links.appendChild(heart);
    const link = (href, text) => { const a = el("a", null, text); a.href = href; a.target = "_blank"; a.rel = "noopener"; links.appendChild(a); };
    link(`https://urbansportsclub.com/en/venues/${encodeURIComponent(c.venue)}`, "Apri su Urban Sports");
    if (v.website && /^https?:\/\//.test(v.website)) link(v.website, "Sito dello studio");
    box.append(x, el("h2", null, c.name), dl, links);
    sh.appendChild(box);
}
$("sheet").addEventListener("click", e => { if (e.target === $("sheet")) closeSheet(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });

// ---------- navigazione e rendering ----------
const clampDay = d => d < minDay ? minDay : d > maxDay ? maxDay : d;
const firstStart = () => S.view === 7 ? mondayOf(minDay) : minDay;
const lastStart = () => { if (S.view === 7) return mondayOf(maxDay); const d = addDays(maxDay, -(S.view - 1)); return d < minDay ? minDay : d; };
const clampStart = d => { const a = firstStart(), b = lastStart(); return d < a ? a : d > b ? b : d; };

function step(n) {
    if (mobile.matches) S.day = clampDay(addDays(S.day, n)); else S.start = clampStart(addDays(S.start, S.view * n));
    render();
}
function setView(n) {
    const prev = S.view; S.view = n; store.set("view", n);
    if (n === 7) S.start = mondayOf(S.start);
    else if (prev === 7) { const t = todayDate(); if (t >= S.start && t <= addDays(S.start, 6)) S.start = t; }
    S.start = clampStart(S.start);
    render();
}
function goToday() {
    S.day = clampDay(todayDate());
    S.start = clampStart(S.view === 7 ? mondayOf(new Date()) : todayDate());
    render();
}
function render() {
    if (!S.start) return;
    updateAvailability();
    const view = $("view");
    view.innerHTML = "";
    const list = classes.filter(visible);
    if (mobile.matches) {
        renderDay(view, list);
        $("label").textContent = `${dayName(S.day)} ${fmt(S.day)}`;
        $("prev").disabled = S.day <= minDay; $("next").disabled = S.day >= maxDay;
    } else {
        renderGrid(view, list);
        $("label").textContent = S.view === 1 ? `${dayName(S.start)} ${fmt(S.start)}` : `${fmt(S.start)} – ${fmt(addDays(S.start, S.view - 1))}`;
        $("prev").disabled = S.start <= firstStart(); $("next").disabled = S.start >= lastStart();
    }
    document.querySelectorAll("#views .btn").forEach(b => b.classList.toggle("active", Number(b.dataset.v) === S.view));
}

async function init() {
    const meta = $("meta");
    let data;
    try {
        const res = await fetch("data/corsi.json", { cache: "no-cache" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        data = await res.json();
    } catch (err) { meta.textContent = "Impossibile caricare gli orari (" + err.message + ")"; return; }
    venues = data.venues || {};
    classes = (data.classes || []).map(prep);
    meta.textContent = "Aggiornato il " + new Date(data.updated).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
    if (!classes.length) { meta.textContent += " · nessun corso nel file"; return; }

    const dates = classes.map(c => c.date).sort();
    minDay = parse(dates[0]); maxDay = parse(dates[dates.length - 1]);
    const v = store.get("view", 7);
    S.view = [1, 4, 7].includes(v) ? v : 7;
    S.day = clampDay(todayDate());
    S.start = clampStart(S.view === 7 ? mondayOf(new Date()) : todayDate());
    startHour = Math.min(7, Math.floor(Math.min(...classes.map(c => toMin(c.start))) / 60));
    endHour = Math.max(22, Math.ceil(Math.max(...classes.map(c => toMin(c.end))) / 60));

    const present = new Set(classes.map(c => c.group));
    const known = GROUPS.map(g => g[0]).filter(g => present.has(g));
    const others = [...present].filter(g => !known.includes(g)).sort();
    const f = $("filters");
    f.append(multi("Categorie", [...known, ...others], S.cat, UI.cat),
             multi("Studi", [...new Set(classes.map(c => c.studio))].sort(), S.venue, UI.venue), planFilter());
    const fav = el("button", "btn", "♥ Solo preferiti");
    UI.fav = fav;
    fav.onclick = () => { S.fav = !S.fav; fav.classList.toggle("active", S.fav); render(); };
    f.appendChild(fav);

    [[1, "1 giorno"], [4, "4 giorni"], [7, "7 giorni"]].forEach(([n, l]) => {
        const b = el("button", "btn", l); b.dataset.v = n; b.onclick = () => setView(n); $("views").appendChild(b);
    });
    $("prev").onclick = () => step(-1); $("next").onclick = () => step(1); $("today").onclick = goToday;
    $("copyFav").onclick = async () => {
        try { await navigator.clipboard.writeText(JSON.stringify([...favs])); alert("Preferiti copiati. Incollali sull'altro dispositivo."); }
        catch (e) { prompt("Copia questo testo:", JSON.stringify([...favs])); }
    };
    $("pasteFav").onclick = () => {
        const t = prompt("Incolla qui i preferiti copiati dall'altro dispositivo:");
        if (!t) return;
        try {
            const a = JSON.parse(t);
            if (!Array.isArray(a)) throw new Error();
            a.forEach(k => favs.add(String(k)));
            store.set("favs", [...favs]); render();
        } catch (e) { alert("Testo non valido."); }
    };
    mobile.addEventListener("change", render);
    render();
    setInterval(render, 60000);
}
init();
