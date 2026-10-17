// Colori per categoria di Urban Sports (id categoria -> [sfondo, testo])
const COLORS = {
    4: ["#e0f2fe", "#0369a1"], 344: ["#fce7f3", "#be185d"], 135: ["#f3e8ff", "#6b21a8"], 6: ["#dcfce7", "#15803d"],
    1: ["#ffedd5", "#c2410c"], 7: ["#fef08a", "#854d0e"], 233: ["#ccfbf1", "#0f766e"], 13: ["#e0e7ff", "#4338ca"],
    1378: ["#fee2e2", "#b91c1c"], 92: ["#ecfccb", "#4d7c0f"]
};
const PLANS = [["M", "Classic"], ["L", "Premium"], ["XL", "Max"]];
const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const HOUR_H = 60;

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const pad = n => String(n).padStart(2, "0");
const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = d => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
const fmt = d => d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
const store = {
    get(k, f) { try { const v = localStorage.getItem(k); return v === null ? f : JSON.parse(v); } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};

let classes = [], venues = {}, startHour = 7, endHour = 22, minDay, maxDay;
const S = { cat: new Set(), venue: new Set(), plan: store.get("plan", ""), fav: false, week: null, day: null };
const favs = new Set(store.get("favs", []));
const mobile = window.matchMedia("(max-width: 760px)");

// Un corso preferito = stesso studio, titolo, giorno della settimana, ora e insegnante
function prep(c) {
    c.date = c.startDateTimeUTC.slice(0, 10);
    c.start = c.startDateTimeUTC.slice(11, 16);
    c.end = c.endDateTimeUTC.slice(11, 16);
    c.dow = (parse(c.date).getDay() + 6) % 7;
    c.studio = (venues[c.venue] || {}).name || c.venue;
    c.cat = (c.category || {}).name || "-";
    c.plans = c.planTypesB2C || [];
    c.key = [c.venue, c.title, c.dow, c.start, c.teacherName || ""].join("|");
    return c;
}
const visible = c =>
    (!S.cat.size || S.cat.has(c.cat)) && (!S.venue.size || S.venue.has(c.studio)) &&
    (!S.plan || c.plans.includes(S.plan)) && (!S.fav || favs.has(c.key));
const colorOf = c => COLORS[(c.category || {}).id] || ["#e5e7eb", "#374151"];

function toggleFav(c) {
    favs.has(c.key) ? favs.delete(c.key) : favs.add(c.key);
    store.set("favs", [...favs]);
    render();
}

// ---------- filtri ----------
function multi(label, items, set) {
    const d = el("details", "dd"), s = el("summary", null, label), p = el("div", "panel");
    d.append(s, p);
    items.forEach(name => {
        const l = el("label"), i = el("input");
        i.type = "checkbox";
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
        i.onchange = () => { S.plan = v; store.set("plan", v); upd(); d.open = false; render(); };
        l.append(i, document.createTextNode(" " + n));
        p.appendChild(l);
    });
    upd();
    return d;
}
document.addEventListener("click", e =>
    document.querySelectorAll("details.dd[open]").forEach(d => { if (!d.contains(e.target)) d.open = false; }));

// ---------- griglia settimanale (computer) ----------
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

function renderWeek(view, list) {
    const now = new Date(), todayIso = iso(now), nowMin = now.getHours() * 60 + now.getMinutes();
    const grid = el("div", "grid");
    view.appendChild(grid);
    grid.appendChild(el("div", "gh"));
    for (let i = 0; i < 7; i++) {
        const d = addDays(S.week, i);
        grid.appendChild(el("div", "gh" + (iso(d) === todayIso ? " today" : ""), `${DAYS[i]} ${d.getDate()}`));
    }
    const cols = [];
    for (let h = startHour; h <= endHour; h++) {
        grid.appendChild(el("div", "ts", `${pad(h)}:00`));
        for (let i = 0; i < 7; i++) {
            const c = el("div", "dc");
            grid.appendChild(c);
            if (h === startHour) cols[i] = c;
        }
    }
    for (let i = 0; i < 7; i++) {
        const dayIso = iso(addDays(S.week, i));
        layout(list.filter(c => c.date === dayIso)).forEach(ev => {
            const [bg, fg] = colorOf(ev), w = 100 / ev.cols;
            const b = el("div", "ev" + (isPast(ev, todayIso, nowMin) ? " past" : ""));
            Object.assign(b.style, {
                background: bg, color: fg, top: `${((ev.a - startHour * 60) / 60) * HOUR_H}px`,
                height: `${Math.max(((ev.z - ev.a) / 60) * HOUR_H, 22)}px`,
                left: `calc(${ev.col * w}% + 1px)`, width: `calc(${w}% - 2px)`
            });
            b.title = `${ev.title}\n${ev.start}–${ev.end} · ${ev.studio}\n${ev.teacherName || ""}`;
            b.append(el("div", "t", ev.title), el("div", "s", `${ev.start}–${ev.end} · ${ev.studio}`));
            if (favs.has(ev.key)) b.appendChild(el("span", "h", "♥"));
            b.onclick = () => openSheet(ev);
            cols[i].appendChild(b);
        });
    }
    const ti = (now.getDay() + 6) % 7;
    if (iso(addDays(S.week, ti)) === todayIso && nowMin >= startHour * 60 && nowMin <= (endHour + 1) * 60) {
        const line = el("div", "now");
        line.style.top = `${((nowMin - startHour * 60) / 60) * HOUR_H}px`;
        cols[ti].appendChild(line);
    }
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
        bd.append(el("div", "tt", c.title), el("div", "sub", `${c.studio} · ${c.teacherName || "–"}`));
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
        ["Insegnante", c.teacherName || "–"], ["Studio", c.studio], ["Indirizzo", addr || "–"], ["Categoria", c.cat],
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
    box.append(x, el("h2", null, c.title), dl, links);
    sh.appendChild(box);
}
$("sheet").addEventListener("click", e => { if (e.target === $("sheet")) closeSheet(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });

// ---------- navigazione e rendering ----------
const clampDay = d => d < minDay ? minDay : d > maxDay ? maxDay : d;
const clampWeek = d => { const a = mondayOf(minDay), b = mondayOf(maxDay); return d < a ? a : d > b ? b : d; };
function step(n) {
    if (mobile.matches) S.day = clampDay(addDays(S.day, n)); else S.week = clampWeek(addDays(S.week, 7 * n));
    render();
}
function render() {
    if (!S.week) return;
    const view = $("view");
    view.innerHTML = "";
    const list = classes.filter(visible);
    if (mobile.matches) {
        renderDay(view, list);
        $("label").textContent = `${DAYS[(S.day.getDay() + 6) % 7]} ${fmt(S.day)}`;
        $("prev").disabled = S.day <= minDay; $("next").disabled = S.day >= maxDay;
    } else {
        renderWeek(view, list);
        $("label").textContent = `${fmt(S.week)} – ${fmt(addDays(S.week, 6))}`;
        $("prev").disabled = S.week <= mondayOf(minDay); $("next").disabled = S.week >= mondayOf(maxDay);
    }
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
    const today = new Date();
    S.day = clampDay(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
    S.week = clampWeek(mondayOf(today));
    startHour = Math.min(7, Math.floor(Math.min(...classes.map(c => toMin(c.start))) / 60));
    endHour = Math.max(22, Math.ceil(Math.max(...classes.map(c => toMin(c.end))) / 60));

    const f = $("filters");
    f.append(multi("Categorie", [...new Set(classes.map(c => c.cat))].sort(), S.cat),
             multi("Studi", [...new Set(classes.map(c => c.studio))].sort(), S.venue), planFilter());
    const fav = el("button", "btn", "♥ Solo preferiti");
    fav.onclick = () => { S.fav = !S.fav; fav.classList.toggle("active", S.fav); render(); };
    f.appendChild(fav);

    $("prev").onclick = () => step(-1); $("next").onclick = () => step(1);
    $("today").onclick = () => { S.day = clampDay(new Date(today.getFullYear(), today.getMonth(), today.getDate())); S.week = clampWeek(mondayOf(new Date())); render(); };
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
