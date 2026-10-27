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
// 5) Icona per zona, secondo il quartiere della palestra su Urban Sports
const AREAS = { "Pankow": "casa", "Friedrichshain-Kreuzberg": "lavoro" };
const AREA_BTNS = [["casa", "Casa"], ["lavoro", "Lavoro"]];   // filtro zona: uno acceso alla volta, all'inizio il primo
// ==============================================================================

const PLANS = [["M", "Classic"], ["L", "Premium"]];   // il piano Max non è considerato
const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const HOUR_H = 60;
const T_MIN = 5 * 60, T_MAX = 23 * 60;   // barra degli orari sul telefono
const CLASS_URL = id => `https://www.urbansportsclub.com/en/activities?class=${id}`;   // si apre nell'app, se installata
const ICONS = {
    casa: '<path d="M3 9.5L10 4l7 5.5V17h-4.5v-4.5h-5V17H3z"/>',
    lavoro: '<rect x="2.5" y="6.5" width="15" height="10" rx="1.5"/><path d="M7 6.5V4.5h6v2M2.5 11h15"/>',
    persona: '<circle cx="10" cy="5" r="2.2"/><path d="M5 17l3-6v-2.5h4V11l3 6M7 9.5l3 1 3-1"/>',
    tag: '<path d="M3 3h6.5l7.5 7.5-6.5 6.5L3 9.5z"/><circle cx="6.5" cy="6.5" r="1.2"/>',
    posti: '<circle cx="7" cy="7" r="2.5"/><circle cx="14" cy="7.5" r="2"/><path d="M2.5 16c0-2.8 2-4.5 4.5-4.5s4.5 1.7 4.5 4.5M12.5 12c2.3-.4 4.5.9 4.5 3.5"/>'
};
const icon = (name, cls) => {
    const sp = el("span", "i" + (cls ? " " + cls : ""));
    sp.innerHTML = `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ICONS[name]}</svg>`;
    return sp;
};
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
const S = { cat: new Set(), venue: new Set(), plan: (p => p === "" || PLANS.some(x => x[0] === p) ? p : "M")(store.get("plan2", "M")),
    area: AREA_BTNS[0][0], fav: false, allDay: false, view: 7, start: null, day: null,
    q: "", from: T_MIN, to: T_MAX };
const norm = t => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const favs = new Set(store.get("favs", []));
const mobile = window.matchMedia("(max-width: 760px)");

// Un preferito = stesso studio, titolo originale, giorno della settimana, ora e insegnante
function prep(c) {
    c.date = c.startDateTimeUTC.slice(0, 10);
    c.start = c.startDateTimeUTC.slice(11, 16);
    c.end = c.endDateTimeUTC.slice(11, 16);
    if (toMin(c.end) <= toMin(c.start)) c.end = "24:00";   // finisce a mezzanotte
    c.allDay = !!(venues[c.venue] || {}).allDay;
    c.dow = (parse(c.date).getDay() + 6) % 7;
    c.studio = (venues[c.venue] || {}).name || c.venue;
    c.cat = effectiveCategory(c);
    c.group = GROUP_OF[c.cat] || c.cat;
    c.name = formatTitle(c.title);
    c.plans = c.planTypesB2C || [];
    c.key = [c.venue, c.title, c.dow, c.start, c.teacherName || ""].join("|");
    c.area = AREAS[(venues[c.venue] || {}).district] || null;
    c.text = norm([c.name, c.title, c.studio, c.group, c.cat, c.teacherName].join(" "));
    return c;
}
// Un corso passa i filtri se li rispetta tutti; "skip" ignora un filtro (serve per capire cosa è ancora scegliibile)
const matches = (c, skip) =>
    c.allDay === S.allDay && (!c.area || c.area === S.area) && (skip === "cat" || !S.cat.size || S.cat.has(c.group)) && (skip === "venue" || !S.venue.size || S.venue.has(c.studio)) &&
    (skip === "plan" || !S.plan || c.plans.includes(S.plan)) && (skip === "fav" || !S.fav || favs.has(c.key)) &&
    (!mobile.matches || ((!S.q || c.text.includes(S.q)) && toMin(c.start) >= S.from && toMin(c.start) <= S.to));
const visible = c => matches(c, null);
const UI = { cat: new Map(), venue: new Map(), plan: new Map(), fav: null };

// Le voci che non darebbero nessun corso diventano grigie e non cliccabili (quelle già scelte restano cliccabili)
function updateAvailability() {
    const avail = (skip, get) => {
        const out = new Set();
        classes.forEach(c => { if (matches(c, skip)) get(c).forEach(v => out.add(v)); });
        return out;
    };
    const apply = (reg, ok, selected, keepOrder) => {
        const rows = [];
        reg.forEach(({ i, l }, v) => {
            const off = !ok.has(v) && !selected(v);
            i.disabled = off; l.classList.toggle("off", off);
            rows.push([off, v, l]);
        });
        if (!keepOrder) rows.sort((a, b) => a[0] - b[0] || byName(a[1], b[1])).forEach(([, , l]) => l.parentNode.appendChild(l));
    };
    apply(UI.cat, avail("cat", c => [c.group]), v => S.cat.has(v));
    apply(UI.venue, avail("venue", c => [c.studio]), v => S.venue.has(v));
    apply(UI.plan, avail("plan", c => c.plans), v => v === "" || S.plan === v, true);
    if (UI.fav) UI.fav.disabled = !S.fav && !classes.some(c => matches(c, "fav") && favs.has(c.key));
}
const byName = (a, b) => a.localeCompare(b, "it", { sensitivity: "base" });
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
        i.onchange = () => { S.plan = v; store.set("plan2", v); upd(); d.open = false; render(); };
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
            b.title = `${ev.name}\n${ev.start}–${ev.end} · ${ev.studio}\n${ev.teacherName || ""}\nAl mese: ${monthlyText(ev)}`;
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

// ---------- schede del giorno (telefono) ----------
function renderCards(view, list) {
    const now = new Date(), todayIso = iso(now), nowMin = now.getHours() * 60 + now.getMinutes();
    const items = list.filter(c => c.date === iso(S.day))
        .sort((a, b) => a.start.localeCompare(b.start) || a.studio.localeCompare(b.studio));
    if (!items.length) { view.appendChild(el("p", "empty", "Nessun corso con questi filtri.")); return; }
    items.forEach(c => {
        const v = venues[c.venue] || {}, [bg, fg] = colorOf(c);
        const card = el("a", "card" + (isPast(c, todayIso, nowMin) ? " past" : ""));
        card.href = CLASS_URL(c.id);
        card.dataset.start = toMin(c.start);
        const pic = el("div", "pic");
        pic.style.background = bg; pic.style.color = fg;
        pic.textContent = c.studio.replace(/[^A-Za-zÄÖÜäöü0-9]/g, "").slice(0, 2).toUpperCase();
        if (v.image) {
            const img = el("img"); img.src = v.image; img.alt = ""; img.loading = "lazy";
            img.onerror = () => img.remove();
            pic.appendChild(img);
        }
        const bd = el("div", "bd");
        const line = (ic, text, cls) => { const d = el("div", "ln" + (cls ? " " + cls : "")); d.append(ic, el("span", null, text)); return d; };
        bd.append(el("div", "tt", c.name), el("div", "tm", `${c.start} - ${c.end}`),
            line(c.area ? icon(c.area, "area") : el("span", "i"), c.studio, "st"),
            line(icon("persona"), c.teacherName || "–"));
        const tg = line(icon("tag"), c.group);
        tg.firstChild.style.color = fg;
        bd.appendChild(tg);
        if (c.spots && c.spots.max != null) bd.appendChild(line(icon("posti"), `${c.spots.max} posti`, "spots"));
        const h = el("button", "heart", favs.has(c.key) ? "♥" : "♡");
        h.setAttribute("aria-label", "Preferito");
        h.onclick = e => { e.preventDefault(); e.stopPropagation(); toggleFav(c); };
        card.append(pic, bd, h);
        view.appendChild(card);
    });
}

// Oggi: porta la vista alle lezioni che iniziano da adesso in poi (alle 8:20 → dalle 8:20; le precedenti restano sopra)
function scrollToNow() {
    const headerH = mobile.matches ? document.querySelector("header").offsetHeight : 0;
    let target = null;
    if (mobile.matches) {
        const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
        if (iso(S.day) === iso(now)) target = [...document.querySelectorAll("#view .card")].find(c => Number(c.dataset.start) >= nowMin);
    } else target = document.querySelector("#view .now");
    if (!target) { window.scrollTo(0, 0); return; }
    const y = target.getBoundingClientRect().top + window.scrollY - headerH - (mobile.matches ? 0 : 120);
    window.scrollTo(0, Math.max(0, y));
}

// Giorni in fila sul telefono: da oggi all'ultimo giorno scaricato
function renderDays() {
    const box = $("days"), t = todayDate();
    box.innerHTML = "";
    for (let d = t < minDay ? minDay : t; d <= maxDay; d = addDays(d, 1)) {
        const day = d, b = el("button", "dy" + (iso(day) === iso(S.day) ? " on" : ""), iso(day) === iso(t) ? "Oggi" : `${dayName(day)} ${day.getDate()}`);
        b.onclick = () => { S.day = day; render(); scrollToNow(); };
        box.appendChild(b);
    }
    const on = box.querySelector(".on");
    if (on) box.scrollLeft = Math.max(0, on.offsetLeft - box.clientWidth / 2 + on.offsetWidth / 2);
}

// ---------- scheda del corso ----------
// Ingressi al mese in questo studio con un piano: limite dello studio, ridotto dal limite della categoria se c'è
function monthlyFor(c, code) {
    if (!c.plans.includes(code)) return null;
    const lim = ((venues[c.venue] || {}).visitLimits || []).find(x => x.name === code);
    if (!lim || !lim.isProvidedByVenue || lim.monthlyLimitVenueAddress == null) return null;
    let n = lim.monthlyLimitVenueAddress;
    const cl = (lim.categoryLimits || []).find(x => x.id === (c.category || {}).id);
    if (cl && cl.limit >= 0) n = n < 0 ? cl.limit : Math.min(n, cl.limit);
    return n === 0 ? null : n;
}
function monthlyText(c) {
    const t = PLANS.map(([k, n]) => { const m = monthlyFor(c, k); return m === null ? null : `${n} ${m < 0 ? "senza limite" : m}`; }).filter(Boolean).join(" · ");
    return t || "–";
}
function closeSheet() { $("sheet").hidden = true; }
function openSheet(c) {
    const sh = $("sheet"), v = venues[c.venue] || {};
    sh.innerHTML = ""; sh.hidden = false;
    const box = el("div", "box");
    const x = el("button", "x", "✕"); x.onclick = closeSheet;
    const addr = [v.address, [v.postalCode, v.district].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const monthly = monthlyText(c);
    const rows = [
        ["Quando", `${DAYS[c.dow]} ${parse(c.date).toLocaleDateString("it-IT", { day: "numeric", month: "long" })}, ${c.start}–${c.end}`],
        ["Insegnante", c.teacherName || "–"], ["Studio", c.studio], ["Indirizzo", addr || "–"], ["Categoria", c.group],
        ["Posti", c.spots && c.spots.max != null ? String(c.spots.max) : "–"], ["Al mese", monthly || "–"]
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
    link(CLASS_URL(c.id), "Apri su Urban Sports");
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
    scrollToNow();
}
// Le ore della griglia seguono i corsi visibili (con l'interruttore acceso: solo gli studi a orari continui)
function fitHours() {
    const base = classes.filter(c => c.allDay === S.allDay);
    if (!base.length) return;
    startHour = Math.min(7, Math.floor(Math.min(...base.map(c => toMin(c.start))) / 60));
    endHour = Math.max(22, Math.ceil(Math.max(...base.map(c => toMin(c.end))) / 60) - 1);
}
function render() {
    if (!S.start) return;
    updateAvailability();
    fitHours();
    const view = $("view");
    view.innerHTML = "";
    const list = classes.filter(visible);
    if (mobile.matches) {
        renderDays();
        renderCards(view, list);
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
    meta.textContent = "Aggiornato " + new Date(data.updated).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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
    if (classes.some(c => c.area)) {
        const seg = el("div", "seg");
        AREA_BTNS.forEach(([v, label]) => {
            const b = el("button", v === S.area ? "on" : "");
            b.appendChild(icon(v));
            b.title = label; b.setAttribute("aria-label", label);
            b.onclick = () => {
                S.area = v;
                seg.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
                render();
            };
            seg.appendChild(b);
        });
        f.appendChild(seg);
    }
    const fav = el("button", "btn fav");
    fav.innerHTML = '♥<span class="lbl"> Solo preferiti</span>';
    fav.setAttribute("aria-label", "Solo preferiti");
    UI.fav = fav;
    fav.onclick = () => { S.fav = !S.fav; fav.classList.toggle("active", S.fav); render(); };
    f.appendChild(fav);
    f.append(multi("Categorie", [...known, ...others], S.cat, UI.cat),
             multi("Palestre", [...new Set(classes.map(c => c.studio))].sort(), S.venue, UI.venue));
    if (classes.some(c => c.allDay)) {
        const ad = el("label", "switch"), box = el("input");
        box.type = "checkbox";
        ad.title = "Studi con un corso ogni ora o accesso tutto il giorno, nascosti di default";
        box.onchange = () => { S.allDay = box.checked; render(); };
        ad.append(box, el("span", "knob"), el("span", "lbl", "Mostra orari continui"), el("span", "lbs", "Orari continui"));
        f.appendChild(ad);
    }
    f.appendChild(planFilter());

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
    // ricerca e barra degli orari (telefono)
    $("q").oninput = () => { S.q = norm($("q").value.trim()); render(); };
    const fromI = $("from"), toI = $("to"), hhmm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
    const saved = store.get("hours", null);
    if (saved && saved[0] >= T_MIN && saved[1] <= T_MAX && saved[0] < saved[1]) { S.from = saved[0]; S.to = saved[1]; }
    fromI.value = S.from; toI.value = S.to;
    const showHours = () => {
        $("fromL").textContent = hhmm(S.from); $("toL").textContent = hhmm(S.to);
        const p = m => ((m - T_MIN) / (T_MAX - T_MIN)) * 100;
        $("dual").style.setProperty("--a", p(S.from) + "%"); $("dual").style.setProperty("--b", p(S.to) + "%");
    };
    const onHours = which => {
        let a = Number(fromI.value), b = Number(toI.value);
        if (a > b - 30) { if (which === "from") a = b - 30; else b = a + 30; fromI.value = a; toI.value = b; }
        S.from = a; S.to = b; store.set("hours", [a, b]); showHours(); render();
    };
    fromI.oninput = () => onHours("from"); toI.oninput = () => onHours("to");
    showHours();
    // sul telefono i menu si aprono sotto la fila dei filtri, a tutta larghezza
    document.querySelectorAll("details.dd").forEach(d => d.addEventListener("toggle", () => {
        if (d.open && mobile.matches) d.querySelector(".panel").style.top = (d.querySelector("summary").getBoundingClientRect().bottom + 6) + "px";
    }));
    mobile.addEventListener("change", render);
    render();
    scrollToNow();
    setInterval(render, 60000);
}
init();
