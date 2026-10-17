const CATEGORIES = [
    ["all", "Tutte le categorie"], ["matbarre", "🧘‍♀️ Pilates & Barre"], ["reformer", "➿ Reformer"],
    ["pole", "💈 Pole & Lyra"], ["yogasound", "🪷 Yoga & Sound"], ["strength", "🏋️‍♂️ Strength & Sculpt"],
    ["dance", "🩰 Danza & Heels"], ["calisthenics", "🤸 Calisthenics"]
];
const DAY_NAMES = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const HOUR_H = 60;

let events = [], startHour = 7, endHour = 22;
let weekStart = null, minWeek = null, maxWeek = null;
const selected = { cat: new Set(["all"]), venue: new Set(["all"]) };

const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = d => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));

function buildFilters(id, items, set) {
    const box = document.getElementById(id);
    box.innerHTML = "";
    items.forEach(([key, label]) => {
        const b = document.createElement("button");
        b.className = "filter-btn" + (key === "all" ? " active" : "");
        b.textContent = label;
        b.dataset.key = key;
        b.onclick = () => toggle(box, set, key);
        box.appendChild(b);
    });
}

function toggle(box, set, key) {
    if (key === "all") { set.clear(); set.add("all"); }
    else {
        set.delete("all");
        set.has(key) ? set.delete(key) : set.add(key);
        if (set.size === 0) set.add("all");
    }
    box.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", set.has(b.dataset.key)));
    render();
}

function layoutEventsForDay(list) {
    const evs = list.map(e => ({ ...e, s: toMin(e.start), e: toMin(e.end) })).sort((a, b) => a.s - b.s);
    const clusters = [];
    let cur = [];
    evs.forEach(ev => {
        if (cur.length && ev.s >= Math.max(...cur.map(x => x.e))) { clusters.push(cur); cur = []; }
        cur.push(ev);
    });
    if (cur.length) clusters.push(cur);
    clusters.forEach(cluster => {
        const cols = [];
        cluster.forEach(ev => {
            let i = cols.findIndex(c => c[c.length - 1].e <= ev.s);
            if (i === -1) { cols.push([]); i = cols.length - 1; }
            cols[i].push(ev);
            ev.col = i;
        });
        cluster.forEach(ev => { ev.cols = cols.length; });
    });
    return evs;
}

function render() {
    const grid = document.getElementById("calendarGrid");
    grid.innerHTML = "";
    const now = new Date();
    const todayIso = iso(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const cell = (cls, text) => {
        const d = document.createElement("div");
        d.className = cls;
        if (text !== undefined) d.textContent = text;
        grid.appendChild(d);
        return d;
    };

    cell("grid-header time-col-header", "");
    for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i);
        cell("grid-header" + (iso(d) === todayIso ? " today" : ""), `${DAY_NAMES[i]} ${d.getDate()}`);
    }
    const cols = [];
    for (let h = startHour; h <= endHour; h++) {
        cell("time-slot", `${String(h).padStart(2, "0")}:00`);
        for (let i = 0; i < 7; i++) {
            const c = cell("day-column");
            if (h === startHour) cols[i] = c;
        }
    }

    for (let i = 0; i < 7; i++) {
        const dayIso = iso(addDays(weekStart, i));
        const dayEvents = events.filter(e =>
            e.date === dayIso &&
            (selected.cat.has("all") || selected.cat.has(e.category)) &&
            (selected.venue.has("all") || selected.venue.has(e.studio)));
        layoutEventsForDay(dayEvents).forEach(ev => {
            const top = ((ev.s - startHour * 60) / 60) * HOUR_H;
            const height = ((ev.e - ev.s) / 60) * HOUR_H;
            const w = 100 / ev.cols;
            const el = document.createElement("div");
            const past = dayIso < todayIso || (dayIso === todayIso && ev.e < nowMin);
            el.className = `cal-event cat-${ev.category}` + (past ? " past" : "");
            el.style.top = `${top}px`;
            el.style.height = `${Math.max(height, 22)}px`;
            el.style.left = `calc(${ev.col * w}% + 1px)`;
            el.style.width = `calc(${w}% - 2px)`;
            el.title = `${ev.title}\n⏰ ${ev.start} - ${ev.end}\n📍 ${ev.studio}\n👤 ${ev.teacher}`;
            [["cal-event-title", ev.title], ["cal-event-time", `${ev.start} - ${ev.end}`],
             ["cal-event-details", `${ev.studio} • ${ev.teacher}`]].forEach(([cls, text]) => {
                const d = document.createElement("div");
                d.className = cls;
                d.textContent = text;
                el.appendChild(d);
            });
            cols[i].appendChild(el);
        });
    }

    const todayIdx = (now.getDay() + 6) % 7;
    if (iso(addDays(weekStart, todayIdx)) === todayIso && nowMin >= startHour * 60 && nowMin <= (endHour + 1) * 60) {
        const line = document.createElement("div");
        line.className = "current-time-line";
        line.style.top = `${((nowMin - startHour * 60) / 60) * HOUR_H}px`;
        cols[todayIdx].appendChild(line);
    }

    const fmt = d => d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
    document.getElementById("weekLabel").textContent = `${fmt(weekStart)} – ${fmt(addDays(weekStart, 6))}`;
    document.getElementById("prevWeek").disabled = weekStart <= minWeek;
    document.getElementById("nextWeek").disabled = weekStart >= maxWeek;
}

function changeWeek(n) {
    weekStart = addDays(weekStart, 7 * n);
    render();
}

async function init() {
    const meta = document.getElementById("meta");
    try {
        const res = await fetch("data/corsi.json", { cache: "no-cache" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        events = data.events || [];
        meta.textContent = "Aggiornato il " +
            new Date(data.updated).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
    } catch (err) {
        meta.textContent = "Impossibile caricare gli orari (" + err.message + ")";
        return;
    }

    const today = mondayOf(new Date());
    const dates = events.map(e => e.date).sort();
    minWeek = dates.length ? mondayOf(parseDate(dates[0])) : today;
    maxWeek = dates.length ? mondayOf(parseDate(dates[dates.length - 1])) : today;
    weekStart = today < minWeek ? minWeek : today > maxWeek ? maxWeek : today;

    if (events.length) {
        startHour = Math.min(7, Math.floor(Math.min(...events.map(e => toMin(e.start))) / 60));
        endHour = Math.max(22, Math.ceil(Math.max(...events.map(e => toMin(e.end))) / 60));
    }
    const venues = [...new Set(events.map(e => e.studio))].sort().map(v => [v, v]);
    buildFilters("categoryFilters", CATEGORIES, selected.cat);
    buildFilters("venueFilters", [["all", "Tutti gli studi"], ...venues], selected.venue);
    document.getElementById("prevWeek").onclick = () => changeWeek(-1);
    document.getElementById("nextWeek").onclick = () => changeWeek(1);
    render();
    setInterval(render, 60000);
}

init();
