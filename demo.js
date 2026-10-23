/* MemPABench Demo page: User A's three featured segments played over his 3D living room
   (lab/diorama-b, embedded as an iframe and driven by postMessage), and his full timeline below.
   site.js calls MPBDemo.init with its shared helpers. */
(function () {
  "use strict";

  const DATA = "data/replay/";
  const FACES = ["neutral", "thinking", "pleased", "impatient", "confused", "delighted", "angry", "dizzy"];
  // his face on a story's result beat must fit the probe's outcome
  const OUTCOME_FACES = { true: ["pleased", "delighted"], false: ["impatient", "angry", "dizzy"] };
  const ROOM_TIMEOUT_MS = 90000;

  // ---------- pictures ----------
  const PIC = {
    battery: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="22" y="9" width="7" height="8" rx="2" fill="#46423b"/><rect x="35" y="9" width="7" height="8" rx="2" fill="#46423b"/><rect x="15" y="15" width="34" height="42" rx="7" fill="#8fa9d6"/><rect x="15" y="15" width="34" height="13" rx="7" fill="#6f87b8"/><path d="M35 31l-8 11h7l-4 9 9-12h-7z" fill="#fffdf8" stroke="#fffdf8" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    firstaid: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M24 18v-5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v5" fill="none" stroke="#46423b" stroke-width="4"/><rect x="8" y="18" width="48" height="36" rx="8" fill="#b8857c"/><path d="M32 26v20M22 36h20" stroke="#fffdf8" stroke-width="6" stroke-linecap="round"/></svg>',
    calendar: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="9" y="13" width="46" height="42" rx="7" fill="#fffdf8" stroke="#46423b" stroke-width="3"/><path d="M9 24h46" stroke="#46423b" stroke-width="3"/><rect x="9" y="13" width="46" height="11" rx="6" fill="#6f9f86"/><path d="M20 8v10M44 8v10" stroke="#46423b" stroke-width="4" stroke-linecap="round"/><circle cx="20" cy="33" r="3" fill="#d8cbb4"/><circle cx="32" cy="33" r="3" fill="#d8cbb4"/><circle cx="44" cy="33" r="3" fill="#d8cbb4"/><circle cx="20" cy="45" r="3" fill="#d8cbb4"/><circle cx="32" cy="45" r="6" fill="#b8857c"/><circle cx="44" cy="45" r="3" fill="#d8cbb4"/></svg>',
    parcel: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 24 32 14l22 10v24L32 58 10 48z" fill="#f0c987"/><path d="M10 24l22 10 22-10M32 34v24" fill="none" stroke="#c99a6a" stroke-width="3" stroke-linejoin="round"/><path d="M21 19.5l22 10v8" fill="none" stroke="#fffdf8" stroke-width="4"/><path d="M58 10c-8-6-20-4-24 4" fill="none" stroke="#b8857c" stroke-width="4" stroke-linecap="round"/><path d="M31 8l3 7 7-3" fill="none" stroke="#b8857c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    table: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="30" cy="34" r="17" fill="#fffdf8" stroke="#46423b" stroke-width="3"/><circle cx="30" cy="34" r="10" fill="none" stroke="#d8cbb4" stroke-width="3"/><path d="M6 18v10a4 4 0 0 0 4 4v20M10 18v10M14 18v10a4 4 0 0 1-4 4" fill="none" stroke="#46423b" stroke-width="3" stroke-linecap="round"/><path d="M54 52V18c-5 3-6 10-6 16h6" fill="#46423b" stroke="#46423b" stroke-width="3" stroke-linejoin="round"/><rect x="38" y="4" width="22" height="15" rx="3" fill="#6f9f86"/><circle cx="45" cy="11.5" r="2.6" fill="#fffdf8"/><circle cx="53" cy="11.5" r="2.6" fill="#fffdf8"/></svg>',
    question: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 9h40a6 6 0 0 1 6 6v25a6 6 0 0 1-6 6H29L17 56V46h-5a6 6 0 0 1-6-6V15a6 6 0 0 1 6-6z" fill="#8fa9d6"/><path d="M25 22a7 7 0 1 1 10.5 6c-2.3 1.3-3.5 2.6-3.5 5" fill="none" stroke="#fffdf8" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="40" r="3.2" fill="#fffdf8"/></svg>',
    plan: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M15 7h25l10 10v40H15z" fill="#fffdf8" stroke="#46423b" stroke-width="3" stroke-linejoin="round"/><path d="M40 7v10h10" fill="none" stroke="#46423b" stroke-width="3" stroke-linejoin="round"/><path d="M22 28h21M22 37h21M22 46h13" stroke="#d8cbb4" stroke-width="4" stroke-linecap="round"/></svg>',
    done: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="24" fill="#6f9f86"/><path d="M21 33l8 8 15-17" fill="none" stroke="#fffdf8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lock: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M21 29v-8a11 11 0 0 1 22 0v8" fill="none" stroke="#46423b" stroke-width="5"/><rect x="13" y="27" width="38" height="29" rx="7" fill="#b8857c"/><circle cx="32" cy="39" r="4.5" fill="#fffdf8"/><path d="M32 41v7" stroke="#fffdf8" stroke-width="4" stroke-linecap="round"/></svg>',
    handback: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="45" cy="21" r="8.5" fill="#8fa9d6"/><path d="M30 54a15 15 0 0 1 30 0z" fill="#8fa9d6"/><path d="M5 44c3-13 11-20 23-20" fill="none" stroke="#6f9f86" stroke-width="5" stroke-linecap="round"/><path d="M21 16l8 8-8 8" fill="none" stroke="#6f9f86" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const ICON = {
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10-6.5a1 1 0 0 0 0-1.72l-10-6.5A1 1 0 0 0 8 5.5z"/></svg>',
    replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 3.5v5h5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>',
    cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 12.5l4.2 4.2L18.5 7.5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
    chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    chevD: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    agent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="7" width="16" height="12" rx="4"/><path d="M12 3v4M9 12.5h.01M15 12.5h.01"/></svg>',
  };

  // ---------- the three featured segments (replay_user_a.json `featured` gives the order; demo_story.json the story) ----------
  // bubble: what he wants done, drawn in his thought bubble. cells: two more of his cells in the probe's context,
  // shown under the probed one.
  const SEGMENTS = {
    pre_04: { bubble: ["battery", "firstaid", "calendar"], cells: ["personal_autonomy_level", "personal_information_elicitation"] },
    fin_27: { bubble: ["parcel"], cells: ["personal_topic_management", "personal_autonomy_level"] },
    fin_26: { bubble: ["table"], cells: ["personal_autonomy_level", "personal_uncertainty_expression"] },
  };

  // ---------- tool calls in plain words ----------
  const TOOL_LABEL = {
    appointment_create: "Booked an appointment", appointment_read: "Opened an appointment", appointment_search: "Searched appointments",
    appointment_update: "Changed an appointment", calendar_event_create: "Added to calendar", calendar_event_read: "Opened a calendar event",
    calendar_event_search: "Searched calendar", calendar_event_update: "Updated calendar", cinema_showtime_search: "Searched showtimes",
    cinema_ticket_purchase: "Bought cinema tickets", comic_store_inventory_read: "Checked comic store stock",
    conference_registration_create: "Registered for a conference", conference_registration_read: "Opened a conference registration",
    contact_read: "Opened a contact", contact_search: "Searched contacts", delivery_address_read: "Read delivery address",
    document_create: "Created a document", document_read: "Read a document", document_update: "Updated a document",
    email_draft_create: "Saved an email draft", email_draft_read: "Opened an email draft", email_message_read: "Read email",
    email_message_search: "Searched email", email_message_send: "Sent email", email_sent_read: "Opened a sent email",
    exhibition_search: "Searched exhibitions", exhibition_ticket_purchase: "Bought exhibition tickets", flight_booking_read: "Opened a flight booking",
    flight_read: "Read flight details", flight_search: "Searched flights", hotel_search: "Searched hotels",
    household_inventory_search: "Checked home inventory", map_route_search: "Checked routes", message_read: "Read a text",
    message_search: "Searched texts", message_send: "Sent a text", package_tracking_read: "Tracked a package",
    payment_method_read: "Checked payment method", phone_call_dial: "Placed a call", phone_call_read: "Opened call log",
    place_search: "Searched places", recipe_search: "Searched recipes", restaurant_reservation_search: "Searched reservations",
    room_booking_create: "Booked a room", room_booking_read: "Opened a room booking", room_booking_search: "Searched rooms",
    scholarly_paper_read: "Read a paper", scholarly_paper_search: "Searched papers", shopping_order_create: "Placed an order",
    shopping_order_read: "Opened an order", shopping_product_search: "Searched products", utility_bill_read: "Read a utility bill",
    weather_forecast_read: "Checked weather",
  };
  // A capability_limit call: the agent reached the edge of what it may do. Worded per tool.
  const STUCK_LABEL = { contact_read: "Contact details out of reach" };

  function toolChip(g) {
    const label = TOOL_LABEL[g.tool];
    if (!label) throw new Error(`tool ${g.tool}: no plain-words label in demo.js TOOL_LABEL`);
    const n = g.n > 1 ? ` <small>&times;${g.n}</small>` : "";
    if (g.status === "ok") return `<span class="chip">${label}${n}</span>`;
    if (g.status === "error") return `<span class="chip err">${ICON.cross}${label} &middot; failed${n}</span>`;
    if (g.status === "capability_limit") {
      if (!STUCK_LABEL[g.tool]) throw new Error(`tool ${g.tool}: capability_limit has no label in demo.js STUCK_LABEL`);
      return `<span class="chip stuck">${ICON.lock}${STUCK_LABEL[g.tool]}${n}</span>`;
    }
    throw new Error(`tool ${g.tool}: unknown status '${g.status}'`);
  }
  // Calls grouped by tool and status, in order of first use.
  function toolGroups(tools) {
    const groups = [];
    for (const t of tools || []) {
      const g = groups.find((x) => x.tool === t.tool && x.status === t.status);
      if (g) g.n++; else groups.push({ tool: t.tool, status: t.status, n: 1 });
    }
    return groups;
  }

  // ---------- markdown (the episodes' text) ----------
  let esc = (s) => s;
  const inline = (s) => s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<i>$2</i>");
  const LIST = /^([-*+]|\d+[.)])\s+(.*)$/;
  function table(rows) {
    const sep = (r) => /^\|?(\s*:?-{2,}:?\s*\|)*\s*:?-{2,}:?\s*\|?$/.test(r);
    const cells = (r) => r.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => inline(esc(c.trim())));
    let head = "", body = rows;
    if (rows.length > 1 && sep(rows[1])) {
      head = `<thead><tr>${cells(rows[0]).map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
      body = rows.slice(2);
    }
    return `<div class="tbl"><table>${head}<tbody>${body.filter((r) => !sep(r)).map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  function md(src) {
    const L = String(src).replace(/\r/g, "").split("\n");
    const para = [];
    let out = "", i = 0;
    const flush = () => { if (para.length) { out += `<p>${para.map((x) => inline(esc(x))).join("<br>")}</p>`; para.length = 0; } };
    while (i < L.length) {
      const t = L[i].trim();
      if (!t) { flush(); i++; continue; }
      if (t.startsWith("```")) {
        flush();
        const buf = [];
        for (i++; i < L.length && !L[i].trim().startsWith("```"); i++) buf.push(L[i]);
        i++;
        out += `<pre><code>${esc(buf.join("\n"))}</code></pre>`;
        continue;
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flush(); out += "<hr>"; i++; continue; }
      const h = t.match(/^#{1,6}\s+(.*)$/);
      if (h) { flush(); out += `<p class="h">${inline(esc(h[1]))}</p>`; i++; continue; }
      if (t.startsWith(">")) {
        flush();
        const buf = [];
        while (i < L.length && L[i].trim().startsWith(">")) buf.push(L[i++].trim().replace(/^>\s?/, ""));
        out += `<blockquote>${md(buf.join("\n"))}</blockquote>`;
        continue;
      }
      if (t.startsWith("|")) {
        flush();
        const rows = [];
        while (i < L.length && L[i].trim().startsWith("|")) rows.push(L[i++].trim());
        out += table(rows);
        continue;
      }
      const li = t.match(LIST);
      if (li) {
        flush();
        const ordered = /\d/.test(li[1]);
        const items = [];
        while (i < L.length) {
          const m = L[i].trim().match(LIST);
          if (m) { items.push(m[2]); i++; continue; }
          if (L[i].trim() && /^\s{2,}/.test(L[i]) && items.length) { items[items.length - 1] += "\n" + L[i].trim(); i++; continue; }
          break;
        }
        const tag = ordered ? "ol" : "ul";
        const start = ordered && parseInt(li[1], 10) !== 1 ? ` start="${parseInt(li[1], 10)}"` : "";
        out += `<${tag}${start}>${items.map((x) => `<li>${x.split("\n").map((y) => inline(esc(y))).join("<br>")}</li>`).join("")}</${tag}>`;
        continue;
      }
      para.push(t);
      i++;
    }
    flush();
    return out;
  }

  // ---------- dates ----------
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function fmtDate(iso, withTime) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) throw new Error(`date '${iso}' is not a valid date`);
    const h = d.getUTCHours(), m = String(d.getUTCMinutes()).padStart(2, "0");
    const time = `${h % 12 || 12}:${m} ${h < 12 ? "AM" : "PM"}`;
    return `${DAY[d.getUTCDay()]}, ${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}` + (withTime ? ` · ${time}` : "");
  }

  // ---------- pausable, cancellable clock ----------
  const CANCEL = { cancelled: true };
  const player = { gen: 0, paused: false, started: false, seg: 0, done: false };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  // Resolves after ms of unpaused time; rejects with CANCEL once a newer playback starts. onTick(share) runs each frame.
  function wait(ms, gen, onTick, clock = player) {
    return new Promise((resolve, reject) => {
      let t = 0, last = performance.now();
      const tick = (now) => {
        if (gen !== clock.gen) { reject(CANCEL); return; }
        if (!clock.paused) t += now - last;
        last = now;
        if (onTick) onTick(clamp01(t / ms));
        if (t >= ms) resolve(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  let replay, profile, episodes = {}, prefDims = [], probeOf = {}, tlInfo;
  // The agent turn that answers on the probed attribute.
  function decisiveTurn(id) {
    const attr = probeOf[id].cell.replace(/^(work|personal)_/, "");
    const i = episodes[id].turns.findIndex((t) => t.speaker === "agent" && (t.choices || []).some((c) => c.attribute === attr));
    if (i < 0) throw new Error(`${id}: no agent turn chooses a setting for ${attr}`);
    return i;
  }
  // demo_story.json against the featured segments and the turns each beat names; throws on the first fault.
  // a line marked quote: every part between ellipses is word for word in its source turn
  function quoteCheck(l, t, src, at) {
    if (typeof l.text !== "string" || !l.text.trim()) throw new Error(`${at}: text missing`);
    if (!l.quote) return;
    const parts = l.text.replace(/[“”]/g, "").split("…").map((x) => x.trim()).filter(Boolean);
    const off = parts.find((x) => !t.text.includes(x));
    if (off !== undefined) throw new Error(`${at}: quote part '${off}' is not word for word in ${src.episode} turn ${src.turn}`);
  }
  function validateStory(story, featured) {
    const ids = Object.keys(story).filter((k) => !k.startsWith("_"));
    const extra = ids.filter((id) => !featured.some((f) => f.probe === id));
    if (extra.length) throw new Error(`demo_story.json: ${extra.join(", ")} is not a featured probe`);
    for (const f of featured) {
      const s = story[f.probe], probe = probeOf[f.probe];
      if (!s) throw new Error(`demo_story.json: no story for featured probe ${f.probe}`);
      if (typeof s.recap !== "string" || !s.recap.trim()) throw new Error(`demo_story.json ${f.probe}: recap is missing`);
      if (!Array.isArray(s.beats)) throw new Error(`demo_story.json ${f.probe}: beats is not a list`);
      const kinds = s.beats.map((b) => b.kind).join(",");
      if (kinds !== "ask,memory,reply,result" && kinds !== "ask,reply,result") {
        throw new Error(`demo_story.json ${f.probe}: beats are '${kinds}', expected ask, memory (optional), reply, result`);
      }
      const turnAt = (src, where) => {
        if (!src || typeof src.episode !== "string" || !Number.isInteger(src.turn)) throw new Error(`${where}: source needs {episode, turn}`);
        const ep = episodes[src.episode];
        if (!ep) throw new Error(`${where}: source episode ${src.episode} is not loaded (only ${f.probe} and ${f.prelude.session})`);
        const t = ep.turns[src.turn];
        if (!t) throw new Error(`${where}: ${src.episode} has no turn ${src.turn}`);
        return t;
      };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.now || "")) throw new Error(`demo_story.json ${f.probe}: now must be the probe's date, YYYY-MM-DD`);
      const reply = s.beats.find((b) => b.kind === "reply");
      s.beats.forEach((b, i) => {
        const where = `demo_story.json ${f.probe} beat ${i} (${b.kind})`;
        const src = b.source, t = turnAt(src, where);
        if (!Array.isArray(b.lines) || (b.kind !== "result" && !b.lines.length)) throw new Error(`${where}: lines missing`);
        if (b.greet !== undefined && (b.kind !== "ask" || typeof b.greet !== "string" || !b.greet.trim())) throw new Error(`${where}: greet is a short text on the ask beat only`);
        const inPrelude = src.episode === f.prelude.session && src.turn >= f.prelude.turns[0] && src.turn <= f.prelude.turns[1];
        if (b.kind === "memory" ? !inPrelude : src.episode !== f.probe) {
          throw new Error(`${where}: source ${src.episode} turn ${src.turn} is outside ${b.kind === "memory" ? `${f.prelude.session} turns ${f.prelude.turns.join("-")}` : f.probe}`);
        }
        const speaker = b.kind === "reply" || (b.kind === "result" && !b.lines.length) ? "agent" : "user";
        if (t.speaker !== speaker) throw new Error(`${where}: source turn is the ${t.speaker}'s, expected the ${speaker}'s`);
        if (b.kind === "reply" && src.turn !== decisiveTurn(f.probe)) throw new Error(`${where}: source turn ${src.turn} is not the answer on the probed attribute (turn ${decisiveTurn(f.probe)})`);
        if (b.kind === "result" && !b.lines.length && src.turn !== reply.source.turn) throw new Error(`${where}: a result without his words must name the reply's turn`);
        if (!FACES.includes(b.face)) throw new Error(`${where}: face '${b.face}' is not one of ${FACES.join(", ")}`);
        if (b.kind === "result" && !OUTCOME_FACES[probe.passed].includes(b.face)) throw new Error(`${where}: face '${b.face}', but the probe ${probe.passed ? "passed" : "failed"} (expected one of ${OUTCOME_FACES[probe.passed].join(", ")})`);
        b.lines.forEach((l, j) => {
          const at = `${where} line ${j}`;
          if (typeof l.text !== "string" || !l.text.trim()) throw new Error(`${at}: text missing`);
          if (l.pic && !PIC[l.pic]) throw new Error(`${at}: no picture '${l.pic}' in demo.js PIC`);
          if (l.mark) {
            if (l.mark !== (probe.passed ? "right" : "wrong")) throw new Error(`${at}: mark '${l.mark}', but the probe ${probe.passed ? "passed" : "failed"}`);
            if (b.kind !== "reply" || l.tag !== probe.selected) throw new Error(`${at}: a mark goes on a reply line, tagged with the setting the agent chose ('${probe.selected}')`);
          }
          quoteCheck(l, t, src, at);
        });
        if (b.kind === "memory") {
          if (!Array.isArray(b.before) || !b.before.length) throw new Error(`${where}: before (the earlier messages that led to his remark) is missing`);
          b.before.forEach((m, j) => {
            const at = `${where} before ${j}`, mt = turnAt(m.source, at);
            if (m.source.episode !== f.prelude.session || m.source.turn < f.prelude.turns[0] || m.source.turn >= src.turn) throw new Error(`${at}: source must be a prelude turn before his remark (${f.prelude.session} turns ${f.prelude.turns[0]}-${src.turn - 1})`);
            if (mt.speaker !== m.who) throw new Error(`${at}: who '${m.who}', but the source turn is the ${mt.speaker}'s`);
            if (!Array.isArray(m.lines) || !m.lines.length) throw new Error(`${at}: lines missing`);
            m.lines.forEach((l) => quoteCheck(l, mt, m.source, at));
          });
          const day = probeOf[src.episode] && probeOf[src.episode].date;
          if (!day || String(day).slice(0, 10) !== b.date) throw new Error(`${where}: date ${b.date}, but ${src.episode} is dated ${day}`);
        }
        if (b.kind === "reply") {
          for (const c of b.tools || []) {
            if (!(t.tools || []).some((x) => x.tool === c.tool && x.status === c.status)) throw new Error(`${where}: ${src.episode} turn ${src.turn} has no ${c.tool} call with status ${c.status}`);
            toolChip({ ...c, n: 1 });   // throws on a tool with no plain-words label
          }
          if (!b.vs || !b.vs.want || !b.vs.got) throw new Error(`${where}: vs needs want and got`);
          const ws = b.vs.want.source;
          if (!ws || (ws.episode !== f.probe && ws.episode !== f.prelude.session)) throw new Error(`${where}: vs.want.source must name ${f.probe} or ${f.prelude.session}`);
          turnAt(ws, `${where} vs.want`);
          for (const side of ["want", "got"]) {
            const v = b.vs[side];
            const name = side === "want" ? probe.setting : probe.selected;
            if (v.note !== name || !Array.isArray(v.steps) || !v.steps.length) throw new Error(`${where}: vs.${side} needs steps and the note '${name}' (the setting ${side === "want" ? "he wanted" : "the agent chose"})`);
            v.steps.forEach((st, j) => { if (!PIC[st.pic]) throw new Error(`${where}: vs.${side} step ${j} has no picture '${st.pic}' in demo.js PIC`); });
          }
        }
        if (b.kind === "result" && (typeof b.verdict !== "string" || !b.verdict.trim())) throw new Error(`${where}: verdict missing`);
      });
    }
  }
  // His setting of a cell at the time of a probe: a final probe -> the final probes' target; a pre-event
  // probe -> the last session on that cell before the probe's change event.
  function settingAt(cell, probe) {
    if (cell === probe.cell) return probe.setting;
    if (probe.kind === "final_probe") {
      const f = replay.timeline.find((e) => e.kind === "final_probe" && e.cell === cell);
      if (!f) throw new Error(`replay: no final probe on ${cell}`);
      return f.setting;
    }
    const ev = replay.changed_cells.find((c) => c.cell === probe.cell);
    if (!ev) throw new Error(`replay: ${probe.id} cell ${probe.cell} is not in changed_cells`);
    const before = replay.timeline.filter((e) => e.cell === cell && e.order != null && e.order < ev.event_acc).sort((a, b) => a.order - b.order);
    if (!before.length) throw new Error(`replay: no session on ${cell} before session ${ev.event_acc}`);
    return before[before.length - 1].setting;
  }
  // His setting of any cell at the time of a probe: a cell whose setting changes during the arc is read from the
  // timeline (settingAt); every other cell keeps its starting setting from profile_user_a.json.
  function settingFor(cell, probe) {
    if (cell === probe.cell || replay.changed_cells.some((c) => c.cell === cell)) return settingAt(cell, probe);
    const [, ctx, attr] = cell.match(/^(work|personal)_(.+)$/);
    const v = profile.matrix[ctx] && profile.matrix[ctx][attr];
    if (!v) throw new Error(`profile_user_a.json: no setting for ${cell}`);
    return v;
  }

  // ======================================================================
  function init(api) {
    const { $, $$ } = api;
    esc = api.esc;
    const stage = $("#stage"), room = $("#room"), chat = $("#chat"), phone = $("#phone"), bubble = $("#bubble");
    const past = $("#past"), recap = $("#recap"), dimmer = $("#dimmer"), titleCard = $("#title-card");
    const cover = $("#cover"), enter = $("#enter"), playBtn = $("#play"), replayBtn = $("#replay"), errBox = $("#stage-error");
    const segs = $("#segs"), nextBtn = $("#next");
    const prefName = (probe) => prefDims.flatMap((d) => d.attributes).find((x) => `${probe.context}_${x.key}` === probe.cell).name;

    const showError = (msg) => {
      errBox.hidden = false;
      errBox.textContent = "The demo could not load: " + msg;
      enter.disabled = true;
      player.gen++;
      console.error("Demo: " + msg);
    };

    // ----- user cards: A opens his world; B to D are shown only -----
    // the users hang in a pill to the left of the page; only User A has a world so far
    $("#ulist").innerHTML = api.USERS.map((u, i) => `<button type="button" class="u"${i === 0 ? ' aria-current="true"' : ' aria-disabled="true"'} aria-label="User ${u.id}">` +
      `<span class="avatar">${u.front ? `<img src="${u.front}" alt="">` : api.avatar(u)}</span><span class="tip">User ${u.id}</span></button>`).join("") + '<i class="label" aria-hidden="true">Users</i>';

    // ----- the room -----
    const roomReady = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("the 3D room did not finish loading")), ROOM_TIMEOUT_MS);
      window.addEventListener("message", (e) => {
        if (e.source !== room.contentWindow || e.origin !== location.origin || !e.data || !e.data.mpb) return;
        const m = e.data;
        if (m.mpb === "ready") { clearTimeout(timer); resolve(); }
        else if (m.mpb === "error") { clearTimeout(timer); reject(new Error("3D room: " + m.message)); showError("3D room: " + m.message); }
        else if (m.mpb === "anchor") placeBubble(m.x, m.y);
      });
      room.src = room.dataset.src;   // loaded only now, so none of its messages arrive before the listener
    });
    const toRoom = (msg) => room.contentWindow.postMessage(msg, location.origin);
    const setFace = (name) => { stage.dataset.face = name; toRoom({ mpb: "expression", name }); };
    const shot = (name, ms) => toRoom({ mpb: "shot", name, ms });
    function placeBubble(x, y) {
      bubble.style.left = `${room.offsetLeft + x * room.clientWidth}px`;
      bubble.style.top = `${room.offsetTop + y * room.clientHeight}px`;
    }

    // ----- left column: who he is (scrolls) and his interaction preferences (pinned below) -----
    // A group shows its first `shown` lines as their head phrase (before " — " or "; "); "more" opens every line in full.
    function groupHtml(title, lines, shown) {
      const items = lines.map(([emo, text], i) => {
        let [head, rest] = text.split(" — ");
        if (rest === undefined) [head, rest] = text.split("; ");
        return `<li${i >= shown ? ' class="extra"' : ""}><span class="emo">${emo}</span><span><b>${esc(head)}</b>` +
          (rest ? `<span class="rest"> — ${esc(rest)}</span>` : "") + "</span></li>";
      }).join("");
      const more = lines.length - shown;
      return `<section class="grp"><h4>${esc(title)}</h4><ul>${items}</ul>` +
        `<button class="more" type="button" aria-expanded="false" data-more="${more} more">${more} more ${ICON.chevD}</button></section>`;
    }
    function circleSvg() {
      const cx = 153, cy = 112, rx = 106, ry = 82;
      let lines = "", nodes = "";
      profile.circle.forEach(([emo, name, rel], k) => {
        const a = (k * 60 - 120) * Math.PI / 180, x = Math.round(cx + rx * Math.cos(a)), y = Math.round(cy + ry * Math.sin(a));
        lines += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
        nodes += `<g class="who-n" data-k="${k}" data-x="${x}" data-y="${y}" tabindex="0"><circle class="nd" cx="${x}" cy="${y}" r="17"/><text class="em" x="${x}" y="${y + 6}">${emo}</text>` +
          `<text class="nm" x="${x}" y="${y + 31}">${esc(name)}</text><text class="rl" x="${x}" y="${y + 43}">${esc(rel)}</text></g>`;
      });
      return `<svg class="circ" viewBox="0 0 306 240" role="img" aria-label="His inner circle"><ellipse class="ring" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>` +
        `<g class="ln">${lines}</g><clipPath id="me-clip"><circle cx="${cx}" cy="${cy}" r="27"/></clipPath>` +
        `<image href="${api.USERS[0].front}" x="${cx - 27}" y="${cy - 27}" width="54" height="54" clip-path="url(#me-clip)"/><circle class="me" cx="${cx}" cy="${cy}" r="27"/>${nodes}</svg>`;
    }
    function renderProfile() {
      const id = profile.id_card;
      const field = (label, html) => `<dt>${label}</dt><dd>${html}</dd>`;
      $("#profile").innerHTML = `<section class="idcard"><div class="id-band"><b>User ${api.USERS[0].id}</b><span>MemPABench</span></div>` +
        `<div class="id-main"><span class="id-photo"><img src="${api.USERS[0].photo}" alt=""></span><div><b class="id-role">${esc(id.role)}</b><span class="id-work">${esc(id.workplace)}</span></div></div>` +
        `<dl class="id-f">${field("Home", esc(id.home))}${field("Email", esc(id.email))}${field("Weekly", id.weekly.map(esc).join("<br>"))}${field("This season", esc(id.season))}</dl></section>` +
        `<section class="grp"><p class="sub first">Inner circle</p><div class="circ-wrap">${circleSvg()}<div class="circ-tip" hidden></div></div><p class="sub">Often visited places</p>` +
        `<div class="places">${profile.places.map(([emo, name]) => `<span class="place">${emo} ${esc(name)}</span>`).join("")}</div></section>` +
        groupHtml("Personality traits", profile.traits, 3) + groupHtml("Speech style & act repertoire", profile.speech_acts, 2);
    }
    function circleTip(g) {
      const tip = $("#profile .circ-tip");
      $$("#profile .who-n.on").forEach((n) => n.classList.toggle("on", n === g));
      if (!g) { tip.hidden = true; return; }
      g.classList.add("on");
      const svg = g.ownerSVGElement;
      const [, name, rel, talks, helps] = profile.circle[Number(g.dataset.k)];
      const s = svg.clientWidth / 306, y = Number(g.dataset.y) * s, below = y < svg.clientHeight / 2;
      tip.innerHTML = `<b>${esc(name)}</b> <span>${esc(rel)}</span><p><i>Talks about</i>${esc(talks)}</p><p><i>Agent helps</i>${esc(helps)}</p>`;
      tip.style.top = below ? `${y + 50 * s}px` : "";
      tip.style.bottom = below ? "" : `${svg.clientHeight - y + 22 * s}px`;
      tip.hidden = false;
    }
    $("#profile").addEventListener("mouseover", (e) => { const g = e.target.closest(".who-n"); if (g) circleTip(g); });
    $("#profile").addEventListener("mouseout", (e) => { const g = e.target.closest(".who-n"); if (g && !g.contains(e.relatedTarget)) circleTip(null); });
    $("#profile").addEventListener("focusout", (e) => { if (e.target.closest(".who-n")) circleTip(null); });
    $("#profile").addEventListener("focusin", (e) => { const g = e.target.closest(".who-n"); if (g) circleTip(g); });
    $("#profile").addEventListener("click", (e) => {
      const b = e.target.closest(".more");
      if (!b) return;
      const open = b.closest(".grp").classList.toggle("open");
      b.setAttribute("aria-expanded", String(open));
      b.innerHTML = open ? `Show less ${ICON.chevD}` : `${b.dataset.more} ${ICON.chevD}`;
    });

    // The 14 preferences of the probe's context, one page per dimension; it opens on the probed attribute's page.
    // The segment's cells carry a dot; the probed one lights up when the agent's answer is marked (hitPref).
    function renderPrefs(probe) {
      const inScene = [probe.cell, ...SEGMENTS[probe.id].cells];
      const pages = prefDims.map((d) => `<div class="ip-page"><p class="ip-dim">${esc(d.name)}</p>` + d.attributes.map((a) => {
        const cell = `${probe.context}_${a.key}`;
        return `<div class="ip${inScene.includes(cell) ? " inscene" : ""}${cell === probe.cell ? " tested" : ""}" data-cell="${cell}"><span class="attr">${esc(a.name)}</span>` +
          `<span class="pill">${esc(settingFor(cell, probe))}</span><span class="hitmark"></span></div>`;
      }).join("") + "</div>").join("");
      const box = $("#prefs");
      box.innerHTML = `<h4>Interaction preferences</h4><div class="ip-car"><button class="ip-arr l" type="button" aria-label="Previous">${ICON.chevL}</button>` +
        `<div class="ip-track">${pages}</div><button class="ip-arr r" type="button" aria-label="Next">${ICON.chevR}</button></div>` +
        `<div class="ip-dots">${prefDims.map((d, i) => `<button type="button" aria-label="${esc(d.name)}" data-page="${i}"></button>`).join("")}</div>`;
      prefPage(prefDims.findIndex((d) => d.attributes.some((a) => `${probe.context}_${a.key}` === probe.cell)), false);
    }
    function prefPage(i, smooth = true) {
      const track = $("#prefs .ip-track");
      if (!track) return;
      const pages = track.children, k = Math.max(0, Math.min(pages.length - 1, i));
      track.dataset.page = k;
      track.scrollTo({ left: k * track.clientWidth, behavior: smooth ? "smooth" : "auto" });
      track.style.height = `${pages[k].offsetHeight}px`;
      $$("#prefs .ip-dots button").forEach((b, j) => b.classList.toggle("on", j === k));
    }
    $("#prefs").addEventListener("click", (e) => {
      const track = $("#prefs .ip-track"), cur = Number(track.dataset.page);
      if (e.target.closest(".ip-arr.l")) prefPage(cur - 1);
      else if (e.target.closest(".ip-arr.r")) prefPage(cur + 1);
      else if (e.target.closest(".ip-dots button")) prefPage(Number(e.target.closest("button").dataset.page));
    });
    // a swipe or trackpad scroll settles on a page: follow it with the dots and the height
    let settle;
    $("#prefs").addEventListener("scroll", (e) => {
      if (!e.target.classList || !e.target.classList.contains("ip-track")) return;
      clearTimeout(settle);
      settle = setTimeout(() => {
        const t = e.target, k = Math.round(t.scrollLeft / t.clientWidth);
        if (k !== Number(t.dataset.page)) prefPage(k);
      }, 120);
    }, true);
    function hitPref(probe, passed) {
      const el = $(`#prefs .ip[data-cell="${probe.cell}"]`);
      el.classList.add("hit", passed ? "good" : "bad");
      el.querySelector(".hitmark").innerHTML = passed ? ICON.check : ICON.cross;
      prefPage([...el.closest(".ip-track").children].indexOf(el.closest(".ip-page")));
    }

    // ----- chat -----
    function addRow(host, html, part) {
      const row = document.createElement("div");
      row.innerHTML = html;
      const el = row.firstElementChild;
      if (part) el.dataset.part = part;
      host.appendChild(el);
      delete host.dataset.userScroll;
      return el;
    }
    function follow(host, el, smooth = true) {
      if (host.dataset.userScroll) return;
      const fits = el.offsetHeight < host.clientHeight - 20;
      host.scrollTo({ top: fits ? host.scrollHeight : el.offsetTop - 10, behavior: smooth ? "smooth" : "auto" });
    }
    // Keeps a long message moving through the screen while it is read.
    function glide(host, el) {
      const top = el.offsetTop - 10;
      const span = el.offsetTop + el.offsetHeight + 10 - host.clientHeight - top;
      return (p) => { if (span > 0 && !host.dataset.userScroll) host.scrollTop = top + span * ease(clamp01((p - 0.15) / 0.7)); };
    }
    const readMs = (text, base, perChar, cap) => Math.min(cap, base + text.length * perChar);
    ["wheel", "touchmove"].forEach((ev) => document.addEventListener(ev, (e) => {
      const host = e.target.closest && e.target.closest(".chat");
      if (host) host.dataset.userScroll = "1";
    }, { passive: true }));

    // One turn into `host` (the full-conversation pop-up); pace: { think, chip, typing, base, perChar, cap }.
    async function playTurn(host, turn, pace, gen, clock) {
      if (turn.speaker === "user") {
        await wait(pace.think, gen, null, clock);
        const el = addRow(host, `<div class="msg user"><div class="bub">${md(turn.text)}</div></div>`);
        follow(host, el);
        await wait(readMs(turn.text, pace.base, pace.perChar, pace.cap), gen, glide(host, el), clock);
        return;
      }
      const el = addRow(host, `<div class="msg agent"><div class="calls"></div><div class="typing"><i></i><i></i><i></i></div></div>`);
      follow(host, el);
      const calls = el.querySelector(".calls");
      for (const g of toolGroups(turn.tools)) {
        calls.insertAdjacentHTML("beforeend", toolChip(g));
        follow(host, el);
        await wait(pace.chip, gen, null, clock);
      }
      await wait(pace.typing, gen, null, clock);
      el.querySelector(".typing").remove();
      el.insertAdjacentHTML("beforeend", `<div class="bub">${md(turn.text)}</div>`);
      follow(host, el);
      await wait(readMs(turn.text, pace.base, pace.perChar, pace.cap), gen, glide(host, el), clock);
    }
    const who = (side) => `<span class="who ${side}">${side === "user" ? `<img src="${api.USERS[0].front}" alt="">` : ICON.agent}</span>`;

    // ----- a story's beats (demo_story.json) -----
    const setPhase = (p) => { stage.dataset.phase = p; };
    const BEAT_PACE = { think: 700, chip: 320, typing: 1100, base: 1500, perChar: 40, cap: 6500, mark: 1300, vs: 1500, verdict: 2800 };
    const pic = (name) => `<span class="pic">${PIC[name]}</span>`;
    const linesHtml = (lines) => lines.map((l) => `<p class="ln${l.mark ? " " + l.mark : ""}">${l.pic ? pic(l.pic) : ""}<span class="tx"><span class="t">${esc(l.text)}</span>` +
      (l.mark ? `<em class="tag">${l.mark === "wrong" ? ICON.cross : ICON.check}${esc(l.tag)}</em>` : "") + "</span></p>").join("");
    const stepsHtml = (v) => {
      const steps = v.steps.map((st) => `<span class="step${st.struck ? " struck" : ""}">${pic(st.pic)}${st.label ? `<small>${esc(st.label)}</small>` : ""}</span>`);
      return v.bundle ? `<span class="bundle">${steps.join("")}</span>` : steps.join(`<i class="arr">${ICON.arrow}</i>`);
    };
    const vsHtml = (vs, passed) => `<div class="vs ${passed ? "good" : "bad"}">` +
      `<div class="vs-row want"><p class="vs-k">He wanted <b>${esc(vs.want.note)}</b></p><div class="vs-steps">${stepsHtml(vs.want)}</div></div>` +
      `<div class="vs-row got"><p class="vs-k">The agent did <b>${esc(vs.got.note)}</b></p><div class="vs-steps">${stepsHtml(vs.got)}</div>` +
      `<span class="vs-mark">${passed ? ICON.check : ICON.cross}</span></div></div>`;
    const beatRead = (b) => readMs(b.lines.map((l) => l.text).join(" "), BEAT_PACE.base, BEAT_PACE.perChar, BEAT_PACE.cap);

    // What he said in an earlier session sits outside the phone, over the room, tied to the phone by a dashed line:
    // it is the agent's memory, not part of today's chat.
    function showPast(day, b) {
      const msg = (who, lines, said) => `<div class="pm ${who}${said ? " said" : ""}">${linesHtml(lines)}</div>`;
      past.innerHTML = `<p class="past-cap">He told the agent this before</p><div class="past-phone"><p class="past-date">${ICON.clock}Earlier · ${esc(day)}</p>` +
        b.before.map((m) => msg(m.who, m.lines)).join("") + msg("user", b.lines, true) + `</div><i class="past-link"></i>`;
      const p = past.getBoundingClientRect(), f = phone.getBoundingClientRect();
      const across = window.matchMedia("(max-width: 760px)").matches ? f.top - p.bottom : f.left - p.right;
      past.style.setProperty("--reach", `${Math.max(0, Math.round(across))}px`);
      past.classList.add("show");
    }
    async function playBeat(b, passed, gen) {
      setPhase(b.kind);
      if (b.kind === "ask" || (b.kind === "result" && b.lines.length)) {
        setFace(b.face);
        await wait(BEAT_PACE.think, gen);
        if (b.greet) {
          follow(chat, addRow(chat, `<div class="msg user beat">${who("user")}<div class="bub">${esc(b.greet)}</div></div>`, b.kind));
          await wait(BEAT_PACE.think + 300, gen);
        }
        follow(chat, addRow(chat, `<div class="msg user beat">${who("user")}<div class="bub">${linesHtml(b.lines)}</div></div>`, b.kind));
        await wait(beatRead(b), gen);
      }
      if (b.kind === "memory") {
        setFace(b.face);
        const day = fmtDate(probeOf[b.source.episode].date, false);
        showPast(day, b);
        const all = [...b.before.flatMap((m) => m.lines), ...b.lines].map((l) => l.text).join(" ");
        await wait(readMs(all, BEAT_PACE.base, BEAT_PACE.perChar, BEAT_PACE.cap * 2) + 600, gen);
      }
      if (b.kind === "reply") {
        const row = addRow(chat, `<div class="msg agent beat">${who("agent")}<div class="col"><div class="calls"></div><div class="typing"><i></i><i></i><i></i></div></div></div>`, b.kind);
        const el = row.querySelector(".col");
        follow(chat, el);
        const calls = el.querySelector(".calls");
        for (const g of toolGroups(b.tools)) {
          calls.insertAdjacentHTML("beforeend", toolChip(g));
          follow(chat, el);
          await wait(BEAT_PACE.chip, gen);
        }
        await wait(BEAT_PACE.typing, gen);
        el.querySelector(".typing").remove();
        el.insertAdjacentHTML("beforeend", `<div class="bub">${linesHtml(b.lines)}</div>`);
        setFace(b.face);
        follow(chat, el);
        await wait(beatRead(b), gen);
        row.classList.add("marked");
        hitPref(probeOf[stage.dataset.seg], passed);
        await wait(BEAT_PACE.mark, gen);
        const vs = addRow(chat, vsHtml(b.vs, passed), "vs");
        follow(chat, vs);
        await wait(BEAT_PACE.vs, gen);
        vs.classList.add("show-got");
        follow(chat, vs);
        await wait(BEAT_PACE.vs + 1200, gen);
      }
      if (b.kind === "result") {
        setFace(b.face);
        const v = addRow(chat, `<div class="verdict ${passed ? "good" : "bad"}">${passed ? ICON.check : ICON.cross}<span>${esc(b.verdict)}</span></div>`, "verdict");
        follow(chat, v);
        await wait(BEAT_PACE.verdict, gen);
      }
    }

    // ----- one featured segment -----
    async function playSegment(k, gen) {
      const f = replay.featured[k];
      const probe = probeOf[f.probe], seg = SEGMENTS[f.probe], story = replay._story[f.probe];
      player.seg = k;
      player.done = false;
      nextBtn.hidden = true;
      $$("button", segs).forEach((b, j) => b.toggleAttribute("aria-current", j === k));
      stage.dataset.seg = f.probe;
      setPhase("intro");
      renderPrefs(probe);
      chat.innerHTML = "";
      $("#now").innerHTML = `${ICON.clock}Now · ${esc(fmtDate(story.now + "T12:00:00Z", false))}`;
      past.classList.remove("show");
      recap.classList.remove("show");
      titleCard.classList.remove("show");
      stage.classList.remove("phone-up");
      bubble.classList.remove("show");
      setFace("neutral");
      shot("him", 0);
      await wait(450, gen);
      dimmer.className = "dimmer";
      await wait(900, gen);
      titleCard.innerHTML = `<small>An interaction on</small>${esc(prefName(probe))}`;
      titleCard.classList.add("show");
      await wait(2600, gen);
      titleCard.classList.remove("show");
      await wait(700, gen);

      setPhase("bubble");
      bubble.innerHTML = seg.bubble.map((p) => PIC[p]).join("");
      setFace("thinking");
      await wait(900, gen);   // he starts thinking, then the bubble rises
      bubble.classList.add("show");
      await wait(3200, gen);
      bubble.classList.remove("show");
      await wait(500, gen);

      stage.classList.add("phone-up");
      shot("near", 1800);
      await wait(1100, gen);
      for (const b of story.beats) await playBeat(b, probe.passed, gen);
      await wait(400, gen);

      setPhase("recap");
      past.classList.remove("show");
      stage.classList.remove("phone-up");
      dimmer.className = "dimmer dim";
      recap.textContent = story.recap;
      recap.classList.add("show");
      await wait(1600, gen);
      // each interaction stops on its recap; the visitor moves on with Next (or any tab above)
      setPhase("end");
      player.done = true;
      segs.children[k].classList.add("seen");
      const last = k + 1 === replay.featured.length;
      nextBtn.innerHTML = last ? `Watch again ${ICON.replay}` : `Next: ${esc(prefName(probeOf[replay.featured[k + 1].probe]))} ${ICON.chevR}`;
      nextBtn.onclick = () => jump(last ? 0 : k + 1);
      nextBtn.hidden = false;
      if (last) replayBtn.classList.add("lit");
    }
    function run(k, gen) {
      replayBtn.classList.remove("lit");
      playSegment(k, gen).catch((err) => {
        if (err === CANCEL) return;
        showError(err.message);
      });
    }
    // Jump to segment k: fade out, then play it from its start.
    async function jump(k) {
      const gen = ++player.gen;
      setPaused(false);
      nextBtn.hidden = true;
      past.classList.remove("show");
      recap.classList.remove("show");
      dimmer.className = "dimmer black";
      try { await wait(700, gen); } catch (e) { return; }
      run(k, gen);
    }

    // ----- opening -----
    async function opening(k = 0) {
      const gen = ++player.gen;
      player.started = true;
      enter.disabled = true;
      setPhase("opening");
      try {
        shot("object", 0);
        cover.classList.add("gone");
        await wait(500, gen);
        playBtn.hidden = false;
        replayBtn.hidden = false;
        await wait(1100, gen);
        shot("him", 2800);
        await wait(2000, gen);
      } catch (err) {
        if (err === CANCEL) return;
        throw err;
      }
      run(k, gen);
    }

    // ----- controls -----
    function setPaused(p) {
      player.paused = p;
      stage.classList.toggle("paused", p);
      playBtn.innerHTML = p ? ICON.play : ICON.pause;
      playBtn.setAttribute("aria-label", p ? "Play" : "Pause");
    }
    setPaused(false);
    replayBtn.innerHTML = ICON.replay;
    playBtn.addEventListener("click", () => setPaused(!player.paused));
    replayBtn.addEventListener("click", () => jump(0));
    let wheelAt = 0;
    stage.addEventListener("wheel", (e) => {
      if (!player.started) return;
      const host = e.target.closest(".chat");
      if (host) {
        const canDown = host.scrollTop + host.clientHeight < host.scrollHeight - 1, canUp = host.scrollTop > 0;
        if ((e.deltaY > 0 && canDown) || (e.deltaY < 0 && canUp)) return;   // the phone scrolls
      }
      e.preventDefault();
      if (Math.abs(e.deltaY) < 4 || performance.now() - wheelAt < 1200) return;
      wheelAt = performance.now();
      const k = player.seg + (e.deltaY > 0 ? 1 : -1);
      if (k >= 0 && k < replay.featured.length) jump(k);
    }, { passive: false });

    // ----- timeline + episode pop-up -----
    // every session and probe on a date axis, one lane per context; final probes gather after the last session.
    // The numbered steps below it follow one preference through its sessions and probes: the first demo's by default,
    // any other from the picker or by clicking one of its marks.
    const tlChart = $("#tl-chart"), tlPop = $("#tl-pop");
    const LANE = { work: 34, personal: 80 };
    const CTX = { work: "Work", personal: "Personal" };
    const tlChip = (t, cls = "") => `<span class="tl-chip ${cls}">${esc(t)}</span>`;
    const tlWhen = (e) => (tlInfo[e.id].date ? fmtDate(tlInfo[e.id].date + "T12:00:00Z", false) : "Final probe, after the last session");
    const tlLabel = (e) => `${tlWhen(e)} · ${CTX[e.context]} · ${prefName(e)}`;
    function tlLine(e) {
      if (e.kind === "accumulation") return `User A wants ${tlChip(e.setting)}`;
      if (e.kind === "forced_event") return `The preference changes: ${tlChip(e.setting)} → ${tlChip(replay.changed_cells.find((c) => c.cell === e.cell).post)}`;
      return `User A wants ${tlChip(e.setting)}; the agent ${e.passed ? "gets it" : "does"} ${tlChip(`${e.selected} ${e.passed ? "✓" : "✗"}`, e.passed ? "ok" : "bad")}`;
    }
    let followCell = null;
    // a changed preference: its first session, the probe before the change, the change and the final probe;
    // any other: its sessions and the final probe. Skipped episodes have no conversation, so they are left out.
    function stepsFor(cell) {
      const own = replay.timeline.filter((e) => e.cell === cell && !e.skipped);
      const acc = own.filter((e) => e.kind === "accumulation"), fin = own.filter((e) => e.kind === "final_probe");
      const changed = own.filter((e) => e.kind === "pre_probe" || e.kind === "forced_event");
      return changed.length ? [acc[0], ...changed, ...fin].filter(Boolean) : [...acc, ...fin];
    }
    function renderPicker() {
      const mark = { work: "\u{1F4BB}", personal: "\u{1F3E0}" };   // laptop for work, house for personal
      const opts = prefDims.map((d) => `<optgroup label="${esc(d.name)}">` + d.attributes.flatMap((a) => ["work", "personal"].map((c) => {
        const cell = `${c}_${a.key}`, ch = replay.changed_cells.some((x) => x.cell === cell);
        return `<option value="${cell}"${cell === followCell ? " selected" : ""}>${esc(a.name)} · ${mark[c]} ${CTX[c]}${ch ? " (changes)" : ""}</option>`;
      })).join("") + `</optgroup>`).join("");
      $("#tl-follow").innerHTML = `<label for="tl-pick">Follow one preference:</label> <span class="tl-pick-wrap"><select id="tl-pick">${opts}</select></span>`;
      $("#tl-pick").addEventListener("change", (e) => { followCell = e.target.value; closePop(); renderTimeline(); });
    }
    function renderTimeline() {
      const sessions = replay.timeline.filter((e) => e.order != null);
      const probes = replay.timeline.filter((e) => e.order == null);
      const days = sessions.map((e) => Date.parse(tlInfo[e.id].date));
      const first = Math.min(...days), last = Math.max(...days);
      const frac = (date) => (Date.parse(date) - first) / (last - first);
      let h = Object.entries(LANE).map(([c, y]) => `<span class="tl-lane" style="top:${y - 8}px">${CTX[c]}</span><i class="tl-base" style="top:${y}px"></i>`).join("");
      for (let m = new Date(first); m.getTime() <= last; m.setUTCMonth(m.getUTCMonth() + 1, 1)) {
        if (m.getUTCDate() === 1) h += `<span class="tl-month" style="--f:${frac(m.toISOString().slice(0, 10))}">${MON[m.getUTCMonth()]}</span>`;
      }
      const fin = probes.filter((e) => e.kind === "final_probe");
      h += `<div class="tl-end"><b>Final probes</b><small>${fin.filter((e) => e.passed).length} ✓ · ${fin.filter((e) => !e.passed).length} ✗</small></div>`;
      if (!followCell) followCell = probeOf[replay.featured[0].probe].cell;
      const cell = followCell;
      // the followed preference's final probe takes the first seat of its cluster, so its number can sit beside it
      const finals = { work: 0, personal: 0 }, posOf = {};
      finals[cell.startsWith("work_") ? "work" : "personal"] = 1;
      for (const e of replay.timeline) {
        let cls = e.kind === "accumulation" ? "s" : e.kind === "forced_event" ? "c" : "p" + (e.passed ? "" : " fail");
        if (e.kind === "final_probe") {
          const n = e.cell === cell ? 0 : finals[e.context]++;
          cls += " fin";
          posOf[e.id] = [`--col:${n % 9};top:${LANE[e.context] - 6 + Math.floor(n / 9) * 12}px`, " fin"];
        } else {
          // a pre-probe runs just before its session, on the same day: drawn a little to the left of it
          posOf[e.id] = [`--f:${frac(tlInfo[e.id].date)};top:${LANE[e.context]}px${e.kind === "pre_probe" ? ";--dx:-18px" : ""}`, ""];
        }
        h += e.skipped
          ? `<i class="tl-m ${cls} off" style="${posOf[e.id][0]}" aria-hidden="true"></i>`
          : `<button type="button" class="tl-m ${cls}" style="${posOf[e.id][0]}" data-ep="${esc(e.id)}" aria-label="${esc(tlLabel(e))}"></button>`;
      }
      const at = (e) => e.order ?? (e.kind === "pre_probe" ? tlInfo[e.id].before - 0.5 : Infinity);
      const steps = stepsFor(cell).sort((a, b) => at(a) - at(b));
      steps.forEach((e, i) => { h += `<span class="tl-num${posOf[e.id][1]}" style="${posOf[e.id][0]}">${i + 1}</span>`; });
      tlChart.innerHTML = h;
      $("#tl-sub").textContent = `${sessions.length} sessions · ${probes.length} probes`;
      if (!$("#tl-pick")) renderPicker(); else $("#tl-pick").value = cell;
      $("#tl-steps").innerHTML = steps.map((e, i) => `<li class="tl-step"><span class="tl-num">${i + 1}</span><div class="when">${esc(tlWhen(e))}</div>` +
        `<p>${tlLine(e)}</p><button type="button" class="tl-link" data-ep="${esc(e.id)}">What happened</button></li>`).join("");
    }
    function openPop(id) {
      const e = probeOf[id], mark = tlChart.querySelector(`[data-ep="${id}"]`);
      tlChart.querySelectorAll(".tl-m.on").forEach((x) => x.classList.remove("on"));
      mark.classList.add("on");
      tlPop.innerHTML = `<div class="when">${esc(tlLabel(e))}</div><p>${esc(tlInfo[id].situation)}</p><p>${tlLine(e)}</p>` +
        `<button type="button" class="tl-link" data-full="${esc(id)}">Full conversation</button>`;
      tlPop.hidden = false;
      const box = tlPop.offsetParent.getBoundingClientRect(), r = mark.getBoundingClientRect();
      const cx = r.left + r.width / 2 - box.left, w = tlPop.offsetWidth;
      const left = Math.min(Math.max(cx - w / 2, 16), box.width - w - 16);
      tlPop.style.left = `${left}px`;
      tlPop.style.top = `${r.bottom - box.top + 12}px`;
      tlPop.style.setProperty("--tip", `${cx - left - 5}px`);
    }
    function closePop() {
      tlPop.hidden = true;
      tlChart.querySelectorAll(".tl-m.on").forEach((x) => x.classList.remove("on"));
    }
    const modal = $("#modal"), modalChat = $("#modal-chat");
    const modalClock = { gen: 0, paused: false };
    const MODAL_PACE = { think: 350, chip: 90, typing: 550, base: 700, perChar: 5, cap: 2600 };
    let resumeMain = false;
    async function openEpisode(id) {
      const gen = ++modalClock.gen;
      const entry = replay.timeline.find((e) => e.id === id);
      $("#modal-date").textContent = entry.date ? fmtDate(entry.date, true) : tlWhen(entry);
      modalChat.innerHTML = "";
      modal.hidden = false;
      resumeMain = player.started && !player.paused && !player.done;
      if (resumeMain) setPaused(true);
      $("#modal-x").focus();
      try {
        const ep = episodes[id] || (episodes[id] = await api.loadJSON(`${DATA}episodes/${id}.json`));
        for (const t of ep.turns) await playTurn(modalChat, t, MODAL_PACE, gen, modalClock);
      } catch (err) {
        if (err === CANCEL) return;
        modalChat.innerHTML = `<p class="stage-error" role="alert">This conversation could not load: ${esc(err.message)}</p>`;
        console.error(err);
      }
    }
    function closeEpisode() {
      modalClock.gen++;
      modal.hidden = true;
      if (resumeMain) setPaused(false);
      resumeMain = false;
    }
    tlChart.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-ep]");
      if (!b) return;
      // a mark of another preference: follow that one instead
      const id = b.dataset.ep;
      if (probeOf[id].cell !== followCell) { followCell = probeOf[id].cell; renderTimeline(); }
      openPop(id);
    });
    $("#tl-steps").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-ep]");
      if (!b) return;
      tlChart.querySelector(`[data-ep="${b.dataset.ep}"]`).scrollIntoView({ block: "nearest", inline: "center" });
      openPop(b.dataset.ep);
    });
    tlPop.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-full]");
      if (b) openEpisode(b.dataset.full);
    });
    document.addEventListener("click", (e) => { if (!tlPop.hidden && !e.target.closest("[data-ep], .tl-pop")) closePop(); });
    // the pop-up follows its mark when the chart scrolls sideways or the window resizes
    const followPop = () => { if (!tlPop.hidden) openPop(tlChart.querySelector(".tl-m.on").dataset.ep); };
    $("#tl-scroll").addEventListener("scroll", followPop, { passive: true });
    window.addEventListener("resize", followPop);
    $("#full-conv").addEventListener("click", () => openEpisode(stage.dataset.seg));
    $("#modal-x").addEventListener("click", closeEpisode);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeEpisode(); });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!modal.hidden) closeEpisode();
      else if (!tlPop.hidden) closePop();
    });

    // ----- load -----
    enter.addEventListener("click", () => opening().catch((err) => showError(err.message)));
    segs.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || enter.disabled && !player.started) return;
      const k = Number(b.dataset.k);
      if (player.started) jump(k);
      else opening(k).catch((err) => showError(err.message));
    });
    return (async () => {
      try {
        const [rep, story, prefs, prof, tl] = await Promise.all([
          api.loadJSON(DATA + "replay_user_a.json"), api.loadJSON(DATA + "demo_story.json"), api.loadJSON("data/preferences.json"),
          api.loadJSON(DATA + "profile_user_a.json"), api.loadJSON(DATA + "timeline_user_a.json"),
        ]);
        replay = rep;
        replay._story = story;
        profile = prof;
        prefDims = prefs.dimensions.map((d) => ({ name: d.name, attributes: d.attributes.map((a) => ({ name: a.name, key: a.name.toLowerCase().replace(/ & | /g, "_") })) }));
        for (const ctx of ["work", "personal"]) for (const d of prefDims) for (const a of d.attributes) {
          if (!profile.matrix[ctx] || !profile.matrix[ctx][a.key]) throw new Error(`profile_user_a.json: matrix.${ctx} has no ${a.key}`);
        }
        for (const k of ["role", "workplace", "home", "email", "weekly", "season"]) {
          if (!profile.id_card || !profile.id_card[k] || !profile.id_card[k].length) throw new Error(`profile_user_a.json: id_card.${k} is missing`);
        }
        if (profile.circle.some((c) => c.length !== 5 || c.some((v) => !v))) throw new Error("profile_user_a.json: every circle entry needs emoji, name, relation, talks, helps");
        for (const k of ["circle", "places", "traits", "speech_acts"]) {
          if (!Array.isArray(profile[k]) || !profile[k].length) throw new Error(`profile_user_a.json: ${k} is missing`);
        }
        renderProfile();
        tlInfo = tl;
        for (const e of replay.timeline) {
          const t = tl[e.id];
          if (!t || !t.situation || (e.kind !== "final_probe" && !/^\d{4}-\d{2}-\d{2}$/.test(t.date))) throw new Error(`timeline_user_a.json: ${e.id} needs a situation and, unless a final probe, a date`);
          if (e.kind === "pre_probe" && !replay.timeline.some((x) => x.order === t.before)) throw new Error(`timeline_user_a.json: ${e.id} runs before session ${t.before}, which is not on the timeline`);
          probeOf[e.id] = e;
        }
        segs.innerHTML = replay.featured.map((f, k) => `<button type="button" data-k="${k}"><i>${k + 1}</i><b>${esc(prefName(probeOf[f.probe]))}</b></button>`).join("");
        for (const f of replay.featured) {
          if (!SEGMENTS[f.probe]) throw new Error(`featured probe ${f.probe} has no entry in demo.js SEGMENTS`);
          if (!probeOf[f.probe] || !probeOf[f.prelude.session]) throw new Error(`featured ${f.probe}: not in the replay timeline`);
        }
        const ids = [...new Set(replay.featured.flatMap((f) => [f.prelude.session, f.probe]))];
        (await Promise.all(ids.map((id) => api.loadJSON(`${DATA}episodes/${id}.json`)))).forEach((ep, i) => {
          if (ep.id !== ids[i]) throw new Error(`episodes/${ids[i]}.json holds episode ${ep.id}`);
          episodes[ep.id] = ep;
        });
        validateStory(story, replay.featured);
        replay.featured.forEach((f) => renderPrefs(probeOf[f.probe]));   // fails here, not mid-play, on a missing cell
        $("#prefs").innerHTML = "";
        renderTimeline();
        await roomReady;
        setFace("neutral");
        shot("inside", 0);
        enter.disabled = false;
      } catch (err) {
        showError(err.message);
        throw err;
      }
    })();
  }

  window.MPBDemo = { init };
})();
