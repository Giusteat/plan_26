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
// 6) Livelli per attività, letti dal titolo. La Pole usa i numeri delle palestre (L0–L4), le altre tre livelli.
const LEVEL_ACTS = ["Pole Dance", "Pilates Reformer", "Pilates", "Fitness", "Functional Training", "Dance"];
const LEVELS_NUM = ["L0", "L1", "L2", "L3", "L4"];
const LEVELS_WORD = [["B", "Beginner"], ["I", "Intermediate"], ["A", "Advanced"]];
const LEVEL_WORDS = [
    [/\b(beginners?|foundations?|basics?|intro(duction)?|anf[äa]nger)\b/i, "B", [0, 1]],
    [/\b(intermediate|experienced|mittel)\b/i, "I", [2, 3]],
    [/\b(advanced|fortgeschritten)\b/i, "A", [4]]
];
const AREA_BTNS = [["casa", "Casa"], ["lavoro", "Lavoro"]];   // filtro zona: uno acceso alla volta, all'inizio il primo
// ==============================================================================

const PLANS = [["M", "Classic"], ["L", "Premium"]];   // il piano Max non è considerato
const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const HOUR_H = 60;
const T_MIN = 7 * 60, T_MAX = 22 * 60;   // barra degli orari sul telefono: agli estremi non esclude niente
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
    area: AREA_BTNS[0][0],
    levels: (l => l && typeof l === "object" && !Array.isArray(l) ? l : { "Pole Dance": ["L0"] })(store.get("levels", null)), fav: false, allDay: false, view: 7, start: null, day: null,
    q: "", from: T_MIN, to: T_MAX };
const norm = t => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
// Un preferito = stesso studio, titolo originale, giorno della settimana e ora.
// L'insegnante si ricorda a parte: se cambia la lezione resta preferita e compare "Nuovo insegnante".
const favs = new Set(), favT = store.get("favT", {});
function addFav(k) {
    const p = String(k).split("|");
    const t = /^\d\d:\d\d$/.test(p[p.length - 1]) ? "" : p.pop();   // formato vecchio: in fondo c'era l'insegnante
    const key = p.join("|");
    favs.add(key);
    if (t && !favT[key]) favT[key] = t;
}
// Pianificate: ricorrenti come i preferiti (stessa chiave). Non piaciute: stessa lezione, studio e insegnante, in qualsiasi giorno.
const agenda = new Set(store.get("agenda", []));   // ogni settimana (chiave del preferito)
const once = new Set(store.get("once", []));       // solo quella data (id della lezione)
const planned = c => once.has(c.id) || agenda.has(c.key);
const bad = new Set(store.get("bad", []));
const badKey = c => [c.venue, c.title, c.teacherName || ""].join("|");
const saveFavs = () => { store.set("favs", [...favs]); store.set("favT", favT); };
store.get("favs", []).forEach(addFav);
saveFavs();
const newTeacher = c => favs.has(c.key) && favT[c.key] && c.teacherName && favT[c.key] !== c.teacherName ? favT[c.key] : null;
const newTeacherLine = c => { const t = newTeacher(c); return t ? el("div", "nt", `Nuovo insegnante (prima: ${t})`) : null; };
const mobile = window.matchMedia("(max-width: 760px)");

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
    c.key = [c.venue, c.title, c.dow, c.start].join("|");
    c.area = AREAS[(venues[c.venue] || {}).district] || null;
    c.levels = levelsOf(c);
    c.text = norm([c.name, c.title, c.studio, c.group, c.cat, c.teacherName].join(" "));
    return c;
}
// Un corso passa i filtri se li rispetta tutti; "skip" ignora un filtro (serve per capire cosa è ancora scegliibile)
const matches = (c, skip) => S.agenda ? planned(c) :
    c.allDay === S.allDay && (!c.area || c.area === S.area) && (skip === "level" || levelOk(c)) && (skip === "cat" || !S.cat.size || S.cat.has(c.group)) && (skip === "venue" || !S.venue.size || S.venue.has(c.studio)) &&
    (skip === "plan" || !S.plan || c.plans.includes(S.plan)) && (skip === "fav" || !S.fav || favs.has(c.key)) &&
    (!mobile.matches || ((!S.q || c.text.includes(S.q)) && (S.from <= T_MIN || toMin(c.start) >= S.from) && (S.to >= T_MAX || toMin(c.start) <= S.to)));
const visible = c => matches(c, null);
const UI = { cat: new Map(), venue: new Map(), plan: new Map(), fav: null, agenda: null };

// Livelli di una lezione dal titolo: null = per tutti (nessun livello scritto, oppure "open level")
function levelsOf(c) {
    const t = c.title;
    if (!LEVEL_ACTS.includes(c.cat) || /open level|all levels?|alle level/i.test(t)) return null;
    const nums = new Set();
    for (const m of t.matchAll(/\b(?:L|Level\s?)(\d)\b(?:\s*[-–/]\s*L?(\d)\b)?(\+)?/gi)) {
        const a = Number(m[1]), b = m[3] ? 4 : Number(m[2] ?? m[1]);
        for (let n = a; n <= Math.min(b, 4); n++) nums.add(n);
    }
    const out = new Set();
    if (c.cat === "Pole Dance") {
        if (!nums.size) LEVEL_WORDS.forEach(([re, , ns]) => { if (re.test(t)) ns.forEach(n => nums.add(n)); });
        nums.forEach(n => out.add("L" + n));
    } else {
        LEVEL_WORDS.forEach(([re, code, ns]) => { if (re.test(t) || ns.some(n => nums.has(n))) out.add(code); });
    }
    return out.size ? out : null;
}
const levelOk = c => { const sel = S.levels[c.cat]; return !sel || !sel.length || !c.levels || sel.some(x => c.levels.has(x)); };

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

function toggleSet(set, k, name) {
    set.has(k) ? set.delete(k) : set.add(k);
    store.set(name, [...set]);
    render();
}
const toggleAgenda = c => toggleSet(agenda, c.key, "agenda");
// 📅 sulla scheda: solo quella data; se è già pianificata ogni settimana apre il riquadro per toglierla
const toggleOnce = c => agenda.has(c.key) ? openBadMenu(c) : toggleSet(once, c.id, "once");
// una lezione non piaciuta non si pianifica più
const toggleBad = c => {
    if (!bad.has(badKey(c))) { agenda.delete(c.key); once.delete(c.id); store.set("agenda", [...agenda]); store.set("once", [...once]); }
    toggleSet(bad, badKey(c), "bad");
};

function toggleFav(c) {
    if (favs.has(c.key)) { favs.delete(c.key); delete favT[c.key]; }
    else { favs.add(c.key); favT[c.key] = c.teacherName || ""; }
    saveFavs();
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
            s.classList.toggle("on", set.size > 0);
            render();
        };
        l.append(i, document.createTextNode(" " + name));
        p.appendChild(l);
    });
    return d;
}
// Livello: per ogni attività si accendono uno o più livelli; niente acceso = tutti
function levelFilter(acts) {
    const d = el("details", "dd"), s = el("summary"), p = el("div", "panel lv");
    d.append(s, p);
    const upd = () => { const n = acts.filter(a => (S.levels[a] || []).length).length; s.textContent = "Livello" + (n ? ` (${n})` : ""); s.classList.toggle("on", n > 0); };
    acts.forEach(a => {
        const row = el("div", "lvrow"), chips = el("div", "lvchips");
        row.append(el("div", "lvname", a), chips);
        (a === "Pole Dance" ? LEVELS_NUM.map(x => [x, x]) : LEVELS_WORD).forEach(([code, label]) => {
            const b = el("button", "lvchip", label);
            const on = () => (S.levels[a] || []).includes(code);
            b.classList.toggle("on", on());
            b.onclick = e => {
                e.preventDefault();
                const cur = new Set(S.levels[a] || []);
                cur.has(code) ? cur.delete(code) : cur.add(code);
                S.levels = { ...S.levels, [a]: [...cur] };
                store.set("levels", S.levels);
                b.classList.toggle("on", on()); upd(); render();
            };
            chips.appendChild(b);
        });
        p.appendChild(row);
    });
    p.appendChild(el("div", "lvhint", "Niente acceso = tutti i livelli. Le lezioni senza livello nel titolo si vedono sempre."));
    upd();
    return d;
}
function planFilter() {
    const d = el("details", "dd"), s = el("summary"), p = el("div", "panel");
    d.append(s, p);
    const upd = () => { s.textContent = "Piano: " + (S.plan ? PLANS.find(x => x[0] === S.plan)[1] : "tutti"); s.classList.toggle("on", !!S.plan); };
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
        // ogni lezione si allarga verso destra finché non incontra un'altra lezione alla stessa ora
        cl.forEach(ev => {
            ev.cols = cols.length; ev.span = 1;
            for (let k = ev.col + 1; k < cols.length && !cols[k].some(o => o.a < ev.z && o.z > ev.a); k++) ev.span++;
        });
    });
    return evs;
}
// Grigia appena è iniziata: a quel punto non ci si può più andare
const isPast = (c, todayIso, nowMin) => c.date < todayIso || (c.date === todayIso && toMin(c.start) < nowMin);

function renderGrid(view, list) {
    const n = S.view, now = new Date(), todayIso = iso(now), nowMin = now.getHours() * 60 + now.getMinutes();
    const grid = el("div", "grid");
    grid.style.gridTemplateColumns = `48px repeat(${n}, minmax(0, 1fr))`;
    view.appendChild(grid);
    grid.appendChild(el("div", "gh"));
    const days = Array.from({ length: n }, (_, i) => addDays(S.start, i));
    const we = d => d.getDay() % 6 === 0 ? " we" : "";
    days.forEach(d => grid.appendChild(el("div", "gh" + we(d) + (iso(d) === todayIso ? " today" : ""), `${dayName(d)} ${d.getDate()}`)));
    const cols = [];
    for (let h = startHour; h <= endHour; h++) {
        grid.appendChild(el("div", "ts", `${pad(h)}:00`));
        for (let i = 0; i < n; i++) {
            const c = el("div", "dc" + we(days[i]));
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
                left: `calc(${ev.col * w}% + 1px)`, width: `calc(${ev.span * w}% - 2px)`
            });
            b.title = `${ev.name}\n${ev.start}–${ev.end} · ${ev.studio}\n${ev.teacherName || ""}\nAl mese: ${monthlyText(ev)}`;
            b.append(el("div", "t", ev.name), el("div", "s", `${ev.start}–${ev.end} · ${ev.studio}`));
            if (n <= 4 && ev.teacherName) b.appendChild(el("div", "tc", ev.teacherName));
            if (favs.has(ev.key) || planned(ev)) b.appendChild(el("span", "h", (planned(ev) ? "📅" : "") + (favs.has(ev.key) ? "♥" : "")));
            if (bad.has(badKey(ev))) b.classList.add("bad");
            if (newTeacher(ev)) { b.appendChild(el("div", "tc nt", "Nuovo insegnante")); b.title += `\nNuovo insegnante (prima: ${newTeacher(ev)})`; }
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

// ---------- posti liberi a richiesta (telefono) ----------
// Il pulsante fa partire su GitHub .github/workflows/posti.yml solo per le lezioni del giorno guardato
// che passano tutti i filtri e non sono ancora iniziate; il risultato arriva in data/posti.json.
const REPO = "Giusteat/plan_26";
// Si ricorda l'ultima richiesta di ogni giorno (anche chiudendo il sito); i giorni passati si dimenticano.
const P = { days: (d => d && typeof d === "object" && !d.posti ? d : {})(store.get("posti", null)), busy: false };
// Dopo 2 ore i posti non contano più: si dimenticano
const SPOTS_TTL = 2 * 60 * 60 * 1000;
const freshDay = g => { const d = P.days[g]; if (d && Date.now() - Date.parse(d.aggiornato) > SPOTS_TTL) { delete P.days[g]; store.set("posti", P.days); } return P.days[g]; };
Object.keys(P.days).forEach(freshDay);
const liveSpots = c => (freshDay(c.date) || {}).posti && P.days[c.date].posti[c.id];
const hhmmOf = isoTime => isoTime ? isoTime.slice(11, 16) : "";
function spotsText(c) {
    const p = liveSpots(c);
    if (p && p.free != null) return `${p.free}/${p.max}`;   // liberi/totali
    return c.spots && c.spots.max != null ? `${c.spots.max} posti` : null;
}
function askToken() {
    const t = prompt("Incolla la chiave GitHub (resta salvata solo su questo telefono):");
    if (t && t.trim()) { store.set("ghToken", t.trim()); return t.trim(); }
    return null;
}
async function requestSpots() {
    if (P.busy) return;
    const now = new Date(), todayIso = iso(now), nowMin = now.getHours() * 60 + now.getMinutes();
    const ids = classes.filter(c => visible(c) && c.date === iso(S.day) && !isPast(c, todayIso, nowMin)).map(c => c.id);
    if (!ids.length) { alert("Nessuna lezione da controllare in questo giorno."); return; }
    const token = store.get("ghToken", null) || askToken();
    if (!token) return;
    const code = String(Date.now());
    const gh = (path, opt = {}) => fetch(`https://api.github.com/repos/${REPO}/${path}`,
        { ...opt, cache: "no-store", headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", ...(opt.headers || {}) } });
    P.busy = true; render();
    try {
        const r = await gh("actions/workflows/posti.yml/dispatches", { method: "POST",
            body: JSON.stringify({ ref: "main", inputs: { giorno: iso(S.day), lezioni: ids.join(","), richiesta: code } }) });
        if (r.status === 401) { store.set("ghToken", null); throw new Error("chiave non valida, riprova e incollala di nuovo"); }
        if (!r.ok) throw new Error(`GitHub ha risposto ${r.status}`);
        for (let i = 0; i < 40; i++) {   // fino a ~4 minuti
            await new Promise(ok => setTimeout(ok, 6000));
            const f = await gh(`contents/data/posti.json?ref=main&t=${Date.now()}`, { headers: { Accept: "application/vnd.github.raw+json" } });
            if (!f.ok) continue;
            const d = await f.json();
            if (d.richiesta === code) { P.days[d.giorno] = { aggiornato: d.aggiornato, posti: d.posti }; store.set("posti", P.days); return; }
        }
        throw new Error("GitHub ci sta mettendo troppo, riprova tra poco");
    } catch (e) { P.busy = false; render(); alert("Posti liberi non riusciti: " + e.message); }
    finally { P.busy = false; render(); }
}
// Pulsante a sinistra degli orari: mostra a che ora sono stati chiesti i posti del giorno guardato
function spotsButton() {
    const b = $("pbtn"), day = freshDay(iso(S.day));
    b.disabled = P.busy;
    b.textContent = P.busy ? "Attendi…" : day ? `Posti ${hhmmOf(day.aggiornato)}` : "Posti liberi";
}

// Tre icone sulla riga del titolo: preferito, pianificata, apri nell'app ("non mi è piaciuta": tenendo premuta la scheda)
const SVG = (path, fill) => `<svg width="20" height="20" viewBox="0 0 20 20" fill="${fill ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
// Tenendo premuta una scheda: piccolo riquadro per segnare (o togliere) "non mi è piaciuta"
function onLongPress(elm, fn) {
    let t = null, x0 = 0, y0 = 0;
    const stop = () => { clearTimeout(t); t = null; };
    elm.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; stop(); t = setTimeout(() => { t = null; fn(); }, 550); }, { passive: true });
    elm.addEventListener("touchmove", e => { if (Math.abs(e.touches[0].clientX - x0) + Math.abs(e.touches[0].clientY - y0) > 10) stop(); }, { passive: true });
    elm.addEventListener("touchend", stop);
    elm.addEventListener("touchcancel", stop);
    elm.addEventListener("contextmenu", e => { e.preventDefault(); if (!("ontouchstart" in window)) fn(); });
}
function openBadMenu(c) {
    const sh = $("sheet"), isBad = bad.has(badKey(c));
    sh.innerHTML = ""; sh.hidden = false;
    const box = el("div", "box small");
    const sub = [c.studio, c.teacherName].filter(Boolean).join(" · ");
    const acts = el("div", "acts");
    const act = (text, fn) => { const b = el("button", "act", text); b.onclick = () => { closeSheet(); if (fn) fn(c); }; acts.appendChild(b); };
    if (!isBad) act(agenda.has(c.key) ? `Togli 📅 ogni ${DAYS[c.dow].toLowerCase()}` : `📅 Ogni ${DAYS[c.dow].toLowerCase()} alle ${c.start}`, toggleAgenda);
    act(isBad ? "Mi piace di nuovo" : "Non mi è piaciuta", toggleBad);
    act("Annulla", null);
    box.append(el("h2", null, c.name), el("p", "hint", sub), acts);
    sh.appendChild(box);
}
function cardIcons(c) {
    const box = el("div", "icons");
    const btn = (cls, label, on, html, toggle) => {
        const b = el("button", "ic " + cls + (on ? " on" : ""));
        b.setAttribute("aria-label", label); b.title = label;
        b.innerHTML = html;
        b.onclick = e => { e.preventDefault(); e.stopPropagation(); toggle(c); };
        box.appendChild(b);
    };
    const isPlan = planned(c), rec = agenda.has(c.key);
    if (bad.has(badKey(c))) {   // non piaciuta: solo cuore barrato (toccandolo si può togliere) e apri
        btn("nb", "Non mi è piaciuta", true, SVG('<path d="M10 16.5S3.5 12.6 3.5 8.2A3.3 3.3 0 0 1 10 6.6a3.3 3.3 0 0 1 6.5 1.6c0 4.4-6.5 8.3-6.5 8.3z"/><path d="M3 3l14 14"/>'), openBadMenu);
    } else {
    btn("fv", "Preferito", favs.has(c.key), favs.has(c.key) ? "♥" : "♡", toggleFav);
    btn("pl" + (rec ? " rec" : ""), rec ? "Pianificata ogni settimana" : "Pianifica questa data", isPlan, SVG(`<rect x="3" y="4.5" width="14" height="12.5" rx="2"${isPlan ? ' fill="currentColor"' : ""}/><path d="M3 8.5h14" stroke="${isPlan ? "#fff" : "currentColor"}"/><path d="M7 2.5v4M13 2.5v4"/>`), toggleOnce);
    }
    const app = el("a", "ic app");
    app.href = CLASS_URL(c.id);
    app.setAttribute("aria-label", "Apri su Urban Sports");
    app.onclick = e => e.stopPropagation();
    app.innerHTML = SVG('<path d="M11 3h6v6M17 3l-8 8M15 12v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4"/>');
    box.appendChild(app);
    return box;
}

// ---------- schede del giorno (telefono) ----------
function renderCards(view, list) {
    const now = new Date(), todayIso = iso(now), nowMin = now.getHours() * 60 + now.getMinutes();
    // Con la ricerca o in agenda: tutte le lezioni da oggi in poi, divise per giorno; senza: solo il giorno scelto
    const all = S.q || S.agenda;
    const items = list.filter(c => all ? c.date >= todayIso : c.date === iso(S.day))
        .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.studio.localeCompare(b.studio));
    if (!items.length) { view.appendChild(el("p", "empty", S.agenda ? "Nessuna lezione pianificata. Tocca una scheda e scegli \"Pianifica\"." : "Nessun corso con questi filtri.")); return; }
    let lastDate = null;
    items.forEach(c => {
        if (all && c.date !== lastDate) {
            lastDate = c.date;
            const d = parse(c.date);
            view.appendChild(el("div", "dayhead", c.date === todayIso ? "Oggi" : `${DAYS[c.dow]} ${d.toLocaleDateString("it-IT", { day: "numeric", month: "long" })}`));
        }
        const v = venues[c.venue] || {}, [bg, fg] = colorOf(c);
        const card = el("div", "card" + (isPast(c, todayIso, nowMin) ? " past" : "") + (bad.has(badKey(c)) ? " bad" : ""));
        card.dataset.start = toMin(c.start);
        onLongPress(card, () => openBadMenu(c));
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
        // due informazioni per riga: la prima si accorcia con "…" se non c'è spazio
        const pair = (a, b) => { const d = el("div", "pair"); d.append(a); if (b) d.append(b); return d; };
        const tg = line(icon("tag"), c.group, "grow");
        tg.firstChild.style.color = fg;
        // riga del titolo: titolo (accorciato con "…") e icone a destra
        const top = el("div", "top1");
        top.append(el("div", "tt", c.name), cardIcons(c));
        bd.append(top, el("div", "tm", `${c.start} - ${c.end}`),
            pair(line(c.area ? icon(c.area, "area") : el("span", "i"), c.studio, "grow"), c.teacherName ? line(icon("persona"), c.teacherName, "side") : null),
            pair(tg, spotsText(c) ? line(icon("posti"), spotsText(c), "side spots" + (liveSpots(c) ? (liveSpots(c).free === 0 ? " full" : " live") : "")) : null));
        const nt = newTeacherLine(c);
        if (nt) bd.appendChild(nt);
        card.append(pic, bd);
        view.appendChild(card);
    });
}

// Oggi: porta la vista alle lezioni che iniziano da adesso in poi (alle 8:20 → dalle 8:20; le precedenti restano sopra)
function scrollToNow() {
    const headerH = mobile.matches ? document.querySelector("header").offsetHeight : 0;
    const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    let target = null;
    if (mobile.matches) {
        if (iso(S.day) === iso(now)) target = [...document.querySelectorAll("#view .card")].find(c => Number(c.dataset.start) >= nowMin);
    } else target = document.querySelector("#view .now");
    // oggi senza più lezioni da fare: si va all'ultima
    if (!target && mobile.matches && iso(S.day) === iso(now)) target = [...document.querySelectorAll("#view .card")].pop();
    if (!target) { window.scrollTo(0, 0); return; }
    const y = target.getBoundingClientRect().top + window.scrollY - headerH - (mobile.matches ? 0 : 120);
    window.scrollTo(0, Math.max(0, y));
}

// Giorni in fila sul telefono: da oggi all'ultimo giorno scaricato
function renderDays() {
    const box = $("days"), t = todayDate();
    box.innerHTML = "";
    for (let d = t < minDay ? minDay : t; d <= maxDay; d = addDays(d, 1)) {
        const day = d, b = el("button", "dy" + (!S.q && !S.agenda && iso(day) === iso(S.day) ? " on" : ""), iso(day) === iso(t) ? "Oggi" : `${dayName(day)} ${day.getDate()}`);
        b.onclick = () => { S.day = day; if (S.q) { S.q = ""; $("q").value = ""; } if (S.agenda) UI.agenda.click(); render(); scrollToNow(); };
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
        ["Insegnante", (c.teacherName || "–") + (newTeacher(c) ? ` (nuovo, prima: ${newTeacher(c)})` : "")], ["Studio", c.studio], ["Indirizzo", addr || "–"], ["Categoria", c.group],
        ["Posti", (liveSpots(c) ? `${spotsText(c)} (alle ${hhmmOf(P.days[c.date].aggiornato)})` : c.spots && c.spots.max != null ? String(c.spots.max) : "–")], ["Al mese", monthly || "–"]
    ];
    const dl = el("dl");
    rows.forEach(([k, val]) => dl.append(el("dt", null, k), el("dd", null, val)));
    // azioni: ogni pulsante si accende/spegne
    const acts = el("div", "acts");
    const act = (on, onText, offText, toggle) => {
        const b = el("button", "act");
        const upd = () => { b.textContent = on() ? onText : offText; b.classList.toggle("on", on()); };
        b.onclick = () => { toggle(c); upd(); };
        upd(); acts.appendChild(b);
    };
    act(() => once.has(c.id), "📅 Pianificata questa data", "📅 Pianifica questa data", c => toggleSet(once, c.id, "once"));
    act(() => agenda.has(c.key), `📅 Pianificata ogni ${DAYS[c.dow].toLowerCase()}`, `📅 Ogni ${DAYS[c.dow].toLowerCase()}`, toggleAgenda);
    act(() => favs.has(c.key), "♥ Nei preferiti", "♡ Preferito", toggleFav);
    act(() => bad.has(badKey(c)), "Non mi è piaciuta (tocca per togliere)", "Non mi è piaciuta", toggleBad);
    const links = el("div", "links");
    const link = (href, text) => { const a = el("a", null, text); a.href = href; a.target = "_blank"; a.rel = "noopener"; links.appendChild(a); };
    link(CLASS_URL(c.id), "Apri su Urban Sports");
    if (v.website && /^https?:\/\//.test(v.website)) link(v.website, "Sito dello studio");
    box.append(x, el("h2", null, c.name), dl, acts, links);
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
    const view = $("view"), y = window.scrollY;   // ridisegnando, la pagina resta dov'era
    view.innerHTML = "";
    const list = classes.filter(visible);
    if (mobile.matches) {
        renderDays();
        renderCards(view, list);
        spotsButton();
        $("label").textContent = `${dayName(S.day)} ${fmt(S.day)}`;
        $("prev").disabled = S.day <= minDay; $("next").disabled = S.day >= maxDay;
    } else {
        renderGrid(view, list);
        $("label").textContent = S.view === 1 ? `${dayName(S.start)} ${fmt(S.start)}` : `${fmt(S.start)} – ${fmt(addDays(S.start, S.view - 1))}`;
        $("prev").disabled = S.start <= firstStart(); $("next").disabled = S.start >= lastStart();
    }
    document.querySelectorAll("#views .btn").forEach(b => b.classList.toggle("active", Number(b.dataset.v) === S.view));
    window.scrollTo(0, y);
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
    // pianificate per una data: si dimenticano quando la lezione è passata o non c'è più
    const todayIso = iso(new Date()), future = new Set(classes.filter(c => c.date >= todayIso).map(c => c.id));
    [...once].forEach(id => { if (!future.has(id)) once.delete(id); });
    store.set("once", [...once]);
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
    const fav = el("button", "btn fav");
    fav.innerHTML = '♥<span class="lbl"> Solo preferiti</span>';
    fav.setAttribute("aria-label", "Solo preferiti");
    UI.fav = fav;
    fav.onclick = () => { S.fav = !S.fav; fav.classList.toggle("active", S.fav); render(); };
    f.appendChild(fav);
    // agenda: solo le lezioni pianificate, ignorando tutti gli altri filtri
    const ag = el("button", "btn fav agenda");
    ag.innerHTML = '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12.5" rx="2"/><path d="M3 8.5h14M7 2.5v4M13 2.5v4"/></svg><span class="lbl"> Pianificate</span>';
    ag.setAttribute("aria-label", "Pianificate");
    UI.agenda = ag;
    ag.onclick = () => { S.agenda = !S.agenda; ag.classList.toggle("active", S.agenda); f.classList.toggle("agenda-on", S.agenda); render(); window.scrollTo(0, 0); };
    f.appendChild(ag);
    f.append(multi("Categorie", [...known, ...others], S.cat, UI.cat),
             multi("Palestre", [...new Set(classes.map(c => c.studio))].sort(), S.venue, UI.venue));
    const acts = LEVEL_ACTS.filter(a => classes.some(c => c.cat === a && c.levels));
    if (acts.length) f.appendChild(levelFilter(acts));
    if (classes.some(c => c.allDay)) {
        const ad = el("label", "switch"), box = el("input");
        box.type = "checkbox";
        ad.title = "Studi con un corso ogni ora o accesso tutto il giorno, nascosti di default";
        box.onchange = () => { S.allDay = box.checked; ad.classList.toggle("on", box.checked); render(); };
        ad.append(box, el("span", "knob"), el("span", "lbl", "Mostra orari continui"), el("span", "lbs", "Orari continui"));
        f.appendChild(ad);
    }
    f.appendChild(planFilter());
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

    [[1, "1 giorno"], [4, "4 giorni"], [7, "7 giorni"]].forEach(([n, l]) => {
        const b = el("button", "btn", l); b.dataset.v = n; b.onclick = () => setView(n); $("views").appendChild(b);
    });
    $("prev").onclick = () => step(-1); $("next").onclick = () => step(1); $("today").onclick = goToday;
    const favExport = () => [...favs].map(k => k + "|" + (favT[k] || ""));
    $("copyFav").onclick = async () => {
        try { await navigator.clipboard.writeText(JSON.stringify(favExport())); alert("Preferiti copiati. Incollali sull'altro dispositivo."); }
        catch (e) { prompt("Copia questo testo:", JSON.stringify(favExport())); }
    };
    $("pasteFav").onclick = () => {
        const t = prompt("Incolla qui i preferiti copiati dall'altro dispositivo:");
        if (!t) return;
        try {
            const a = JSON.parse(t);
            if (!Array.isArray(a)) throw new Error();
            a.forEach(addFav);
            saveFavs(); render();
        } catch (e) { alert("Testo non valido."); }
    };
    // ricerca e barra degli orari (telefono)
    $("pbtn").onclick = requestSpots;
    $("q").oninput = () => { S.q = norm($("q").value.trim()); render(); if (S.q) window.scrollTo(0, 0); else scrollToNow(); };
    const fromI = $("from"), toI = $("to"), hhmm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
    const saved = store.get("hours", null);
    if (saved && saved[0] < saved[1]) { S.from = Math.max(T_MIN, Math.min(saved[0], T_MAX - 30)); S.to = Math.min(T_MAX, Math.max(saved[1], S.from + 30)); }
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
if ("scrollRestoration" in history) history.scrollRestoration = "manual";   // ricaricando decide scrollToNow, non il browser
init();
