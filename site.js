/* MemPABench site: shared top bar + per-page behaviour. No build step. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  // ---------- icons ----------
  const ICON = {
    paper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16"/></svg>',
    data: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v6.5c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8V5.5M4.5 12v6.5c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8V12"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/></svg>',
    smile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4 10-10"/></svg>',
    frown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  };
  // Neutral silhouette for users who have no art yet.
  const SILHOUETTE = (tint) => `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="${tint}"/><circle cx="32" cy="25" r="11" fill="#fffdf8" opacity=".85"/><path d="M12 64c1.5-13 9.5-20 20-20s18.5 7 20 20z" fill="#fffdf8" opacity=".85"/></svg>`;
  const USERS = [
    { id: "A", img: "assets/user_a_face.jpg", front: "assets/user_a_front.jpg", photo: "assets/user_a_id.jpg" },   // front / photo: straight-on, for the Demo avatars and the ID card
    { id: "B", tint: "#e4d3ce" },
    { id: "C", tint: "#cfdccf" },
    { id: "D", tint: "#d4dbea" },
  ];
  const avatar = (u) => (u.img ? `<img src="${u.img}" alt="">` : SILHOUETTE(u.tint));

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem("mpb." + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem("mpb." + k, JSON.stringify(v)); } catch (e) { /* storage unavailable: keep in memory only */ } },
  };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- top bar ----------
  function renderTopbar(page) {
    const bar = $("#topbar");
    if (!bar) return;
    const nav = [
      ["overview", "Overview", "index.html"],
      ["leaderboard", "Leaderboard", "leaderboard.html"],
      ["demo", "Demo", "demo.html"],
      ["citation", "Citation", "index.html#citation"],
    ];
    bar.className = "topbar";
    bar.innerHTML =
      `<a class="logo" href="index.html" aria-label="MemPABench home"><span>MemPABench</span></a>` +
      `<nav class="nav" aria-label="Sections">${nav.map(([id, label, href]) => `<a href="${href}" data-nav="${id}"${id === page ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>` +
      `<div class="tools">` +
      `<a class="icon-btn" href="https://arxiv.org/abs/2610.30485" target="_blank" rel="noopener" title="Paper (arXiv)" aria-label="Paper on arXiv">${ICON.paper}</a>` +
      `<a class="icon-btn" href="https://github.com/mempabench/mempabench" target="_blank" rel="noopener" title="Code (GitHub)" aria-label="Code on GitHub">${ICON.code}</a>` +
      `<a class="icon-btn" href="https://huggingface.co/datasets/mempabench/mempabench-personas" target="_blank" rel="noopener" title="Dataset (Hugging Face)" aria-label="Dataset on Hugging Face">${ICON.data}</a>` +
      `</div>`;
    // On the Overview, "Citation" is an in-page anchor: mark it current while the citation is in view.
    if (page === "overview") {
      const cite = $("#citation");
      const link = $('[data-nav="citation"]', bar);
      const over = $('[data-nav="overview"]', bar);
      if (cite && "IntersectionObserver" in window) {
        new IntersectionObserver((es) => es.forEach((e) => {
          if (e.isIntersecting) { link.setAttribute("aria-current", "page"); over.removeAttribute("aria-current"); }
          else { over.setAttribute("aria-current", "page"); link.removeAttribute("aria-current"); }
        }), { threshold: 0.5 }).observe(cite);
      }
    }
  }

  function initReveal() {
    const els = $$(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); e.target.dispatchEvent(new Event("revealed")); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
  }

  async function loadJSON(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.json();
  }

  const fmt = (v, d) => Number(v).toFixed(d);
  const pct = (v, m) => Math.max(0, Math.min(100, ((v - m.min) / (m.max - m.min)) * 100));

  // ======================================================================
  // Overview
  // ======================================================================
  // Same reply, two reactions (calendar, work). User A: Solution Breadth Low; User B: High
  // (data/personas/user_{a,b}_preferences.yaml, work.solution_breadth, before their change events).
  function initReactions() {
    const replies = {
      many: `Three slots are open next week:<ul><li><b>Tue 10:00</b> &middot; everyone free, ends before lunch</li><li><b>Wed 14:00</b> &middot; the longest free block</li><li><b>Thu 16:30</b> &middot; right after your last meeting</li></ul>`,
      one: `<b>Wed 14:00</b> is the best fit: it is the longest free block next week.`,
    };
    const react = {
      many: { A: ["bad", "I asked for a time, not a menu."], B: ["good", "Ooh, Wednesday works!"] },
      one: { A: ["good", "Correct. Proceed."], B: ["bad", "Wait, what else is open?"] },
    };
    const tags = { A: "Low", B: "High" };
    const render = (mode) => {
      $("#reply").innerHTML = `<div class="bubble-agent">${replies[mode]}</div>`;
      ["A", "B"].forEach((id) => {
        const [mood, text] = react[mode][id];
        const box = $(`#react-${id}`);
        box.querySelector(".thought").outerHTML = `<div class="thought ${mood}">${esc(text)}</div>`;
        const m = box.querySelector(".mood");
        m.className = `mood ${mood}`;
        m.innerHTML = mood === "good" ? ICON.smile : ICON.frown;
        m.setAttribute("aria-label", mood === "good" ? "satisfied" : "unsatisfied");
      });
      $$("#reply-switch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    };
    ["A", "B"].forEach((id) => {
      const u = USERS.find((x) => x.id === id);
      $(`#react-${id}`).innerHTML =
        `<div class="thought"></div><div class="face-wrap"><div class="face">${avatar(u)}</div><span class="mood"></span></div>` +
        `<div class="who">User ${id}</div><div class="tag pill">Solution Breadth &middot; ${tags[id]}</div>`;
    });
    $$("#reply-switch button").forEach((b) => b.addEventListener("click", () => render(b.dataset.mode)));
    render("many");
  }

  function hbar(name, value, metric, opts = {}) {
    const ref = (opts.ref ? " ref" : "") + (opts.top ? " top" : "");
    const rand = opts.rand != null ? `<span class="rand" style="left:${pct(opts.rand, metric)}%"></span>` : "";
    return `<div class="hbar${ref}"><span class="name">${esc(name)}</span>` +
      `<span class="track"><span class="fill" data-w="${pct(value, metric)}"></span>${rand}</span>` +
      `<span class="val">${fmt(value, metric.decimals)}</span></div>`;
  }
  function growBars(root) {
    const go = () => $$(".fill[data-w]", root).forEach((f) => { f.style.width = f.dataset.w + "%"; });
    if (root.classList.contains("reveal") && !root.classList.contains("in")) root.addEventListener("revealed", go, { once: true });
    else requestAnimationFrame(go);
  }

  function initPreview(lb) {
    const ov = lb.views.Overall;
    const m = lb.metrics.PSA;
    const order = [...lb.memory_systems].sort((a, b) => ov[b].PSA.mean - ov[a].PSA.mean);
    const host = $("#preview-bars");
    host.innerHTML = order.map((c, i) => hbar(c, ov[c].PSA.mean, m, { top: i === 0, rand: lb.random_selection_psa })).join("") +
      lb.reference_conditions.map((c) => hbar(c, ov[c].PSA.mean, m, { ref: true, rand: lb.random_selection_psa })).join("");
    $("#rand-val").textContent = fmt(lb.random_selection_psa, 1);
    growBars($("#preview"));
    // finding 3: CS / PET
    const mems = [...order, "No Memory"];   // same order as finding 1
    // finding 3: one dot per memory, higher is better on both axes: x = PET (right before and after a change),
    // y = CS (right in both contexts where they differ)
    const pts = mems.map((c) => ({ c, x: ov[c].PET.mean, y: ov[c].CS.mean }));
    const W = 460, H = 330, L = 52, R = 18, T = 18, B = 58, MAX = 30;
    const sx = (v) => L + (v / MAX) * (W - L - R), sy = (v) => H - B - (v / MAX) * (H - T - B);
    const others = pts.filter((q) => q.c !== "File memory"), fm = pts.find((q) => q.c === "File memory");
    const xs = others.map((q) => sx(q.x)), ys = others.map((q) => sy(q.y));
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    $("#cspet-scatter").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="File memory: ${fmt(fm.x, 1)}% right before and after a change, ${fmt(fm.y, 1)}% right in both contexts; the other memories and No Memory at most ${Math.max(...others.map((q) => q.x)).toFixed(1)}% and ${Math.max(...others.map((q) => q.y))}%">` +
      [0, 10, 20, 30].map((t) => `<line class="g" x1="${L}" x2="${W - R}" y1="${sy(t)}" y2="${sy(t)}"/><text class="t" x="${L - 8}" y="${sy(t) + 4}" text-anchor="end">${t}</text>` +
        `<text class="t" x="${sx(t)}" y="${H - B + 18}" text-anchor="middle">${t}</text>`).join("") +
      `<text class="ax" x="${(L + W - R) / 2}" y="${H - 12}" text-anchor="middle">Right before and after a change (%)</text>` +
      `<text class="ax" transform="translate(14 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">Right in both work and personal life (%)</text>` +
      `<ellipse class="cl" cx="${cx}" cy="${cy}" rx="${(Math.max(...xs) - Math.min(...xs)) / 2 + 16}" ry="${(Math.max(...ys) - Math.min(...ys)) / 2 + 14}"/>` +
      others.map((q) => `<circle class="${q.c === "No Memory" ? "d ref" : "d"}" cx="${sx(q.x)}" cy="${sy(q.y)}" r="5"><title>${esc(q.c)}: ${fmt(q.x, 1)}, ${fmt(q.y, 1)}</title></circle>`).join("") +
      `<text class="lb" x="${cx}" y="${cy - 26}" text-anchor="middle">Mem0, MemOS, Simple RAG, No Memory</text>` +
      `<circle class="d top" cx="${sx(fm.x)}" cy="${sy(fm.y)}" r="8"><title>File memory: ${fmt(fm.x, 1)}, ${fmt(fm.y, 1)}</title></circle>` +
      `<text class="lb top" x="${sx(fm.x) - 14}" y="${sy(fm.y) + 5}" text-anchor="end">File memory</text></svg>` +
      `<figcaption>Scores for following preference changes over time and for telling work and personal apart; higher is better. File memory does well on changes over time but drops on context differences.</figcaption>`;
    growBars($("#find-oracle"));
  }

  function initRecall() {
    // data_analysis/results/formal_0925/h1_h4/summary.md, category counts per memory (112 sampled final probes each,
    // "cannot judge" left out of the denominator): applicable preference, rule for another setting only, past events
    // only, nothing relevant
    const rows = [["File memory", 60, 8, 20, 23], ["Mem0", 1, 1, 66, 44], ["MemOS", 3, 0, 62, 47], ["Simple RAG", 3, 1, 80, 26]];
    $("#recall-stacks").innerHTML = rows.map(([name, pref, other, events, none]) => {
      const tot = pref + other + events + none, w = (v) => `${(v / tot) * 100}%`, pc = (v) => `${Math.round((v / tot) * 100)}%`;
      return `<div class="stack-row${name === "File memory" ? " top" : ""}"><b>${esc(name)}</b>` +
        `<span class="stack" role="img" aria-label="${esc(name)}: applicable preference ${pc(pref)}, past events only ${pc(events)}">` +
        `<span class="k-pref" style="width:${w(pref)}"></span><span class="k-rest" style="width:${w(other)}"></span>` +
        `<span class="k-event" style="width:${w(events)}"></span></span>` +
        `<span class="stack-v"><b>${pc(pref)}</b> preference</span><span class="stack-v">${pc(events)} past events</span></div>`;
    }).join("");
  }

  function initDims(prefs, examples) {
    // the 14 attributes as one list in two columns, one section per dimension with its picture; a row opens its
    // question and settings below the list, with an example: one request, one reply per setting
    const attrs = new Map(prefs.dimensions.flatMap((d) => d.attributes.map((a) => [a.name, a])));
    for (const [name, ex] of Object.entries(examples.attributes)) {
      const a = attrs.get(name);
      if (!a) throw new Error(`pref_examples.json: unknown attribute "${name}"`);
      const want = a.settings.map((s) => s.name).sort().join("|"), got = Object.keys(ex.replies).sort().join("|");
      if (!ex.request === !ex.situation || want !== got) throw new Error(`pref_examples.json: ${name} needs a request or a situation, and replies for ${want}; has ${got}`);
    }
    const missing = [...attrs.keys()].filter((n) => !examples.attributes[n]);
    if (missing.length) throw new Error(`pref_examples.json: no example for ${missing.join(", ")}`);
    const colors = ["var(--accent)", "var(--sky)", "var(--sage)", "var(--butter)"];
    const pics = ["expression", "disclosure", "initiative", "information"];
    const host = $("#dims");
    const detail = $("#dim-detail");
    host.innerHTML = prefs.dimensions.map((d, i) =>
      `<section class="dgroup" style="--dimc:${colors[i]}" aria-label="${esc(d.name)}">` +
      `<h3><img src="assets/dim_${pics[i]}.jpg" alt=""><span>${esc(d.name)}<small>${esc(d.summary)}</small></span></h3>` +
      d.attributes.map((a, j) => `<button class="drow" type="button" data-i="${i}" data-j="${j}" aria-pressed="false" aria-controls="dim-detail">` +
        `<b>${esc(a.name)}</b><span>${a.settings.map((s) => `<i>${esc(s.name)}</i>`).join(" · ")}</span></button>`).join("") +
      `</section>`).join("");
    let openKey = null;
    const show = (key) => {
      openKey = key;
      $$(".drow", host).forEach((t) => t.setAttribute("aria-pressed", String(`${t.dataset.i}.${t.dataset.j}` === openKey)));
      if (openKey === null) detail.classList.remove("open");
    };
    // the card closes with its × button, Escape, or a second click on the same row
    detail.addEventListener("click", (e) => { if (e.target.closest(".dim-x")) show(null); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openKey !== null) show(null); });
    host.addEventListener("click", (e) => {
      const b = e.target.closest(".drow");
      if (!b) return;
      const key = `${b.dataset.i}.${b.dataset.j}`;
      show(openKey === key ? null : key);
      if (openKey === null) return;
      const d = prefs.dimensions[+b.dataset.i], a = d.attributes[+b.dataset.j];
      detail.style.setProperty("--dimc", colors[+b.dataset.i]);
      const ex = examples.attributes[a.name];
      detail.innerHTML = `<button class="dim-x" type="button" aria-label="Close">&times;</button><p class="attr-kicker">${esc(d.name)}</p><h4 class="attr-name">${esc(a.name)}</h4><p class="attr-q">${esc(a.question)}</p><div class="settings">` +
        a.settings.map((s) => `<div class="setting-card"><b>${esc(s.name)}</b><p>${esc(s.does)}</p></div>`).join("") + `</div>` +
        (ex ? `<div class="example"><p class="ex-req"><span class="ex-tag">Example</span>${ex.request ? `User A: “${esc(ex.request)}”` : esc(ex.situation)}</p><div class="ex-rows">` +
          a.settings.map((s) => `<div class="ex-row"><b>${esc(s.name)}</b><p>${esc(ex.replies[s.name])}</p></div>`).join("") + `</div></div>` : "");
      detail.classList.add("open");
    });
  }

  function initCopy() {
    const btn = $("#copy-bib");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText($("#bibtex").textContent); btn.textContent = "Copied"; }
      catch (e) { btn.textContent = "Select and copy"; }
      setTimeout(() => { btn.textContent = "Copy"; }, 1600);
    });
  }

  // On-page navigation down the left side on wide screens: one numbered link per [data-toc] section, its sub-blocks
  // underneath; it appears once the hero is scrolled past, marks the part being read and colours the bar beside it.
  function initToc() {
    const items = $$("[data-toc]");
    const nav = document.createElement("nav");
    nav.className = "toc";
    nav.setAttribute("aria-label", "On this page");
    let n = 0;
    nav.innerHTML = items.map((el) => { const sub = el.classList.contains("sub-block") || el.hasAttribute("data-toc-sub");
      return `<a href="#${el.id}"${sub ? ' class="sub"' : ""}>${sub ? "" : `<span class="n">${String(++n).padStart(2, "0")}</span>`}${esc(el.dataset.toc)}</a>`; }).join("");
    document.body.appendChild(nav);
    const links = $$("a", nav);
    const update = () => {
      let cur = -1;
      items.forEach((el, i) => { if (el.getBoundingClientRect().top < innerHeight * 0.35) cur = i; });
      // parts shown side by side (same top) are being read together, so they light up together
      const curTop = cur >= 0 ? items[cur].getBoundingClientRect().top : NaN;
      links.forEach((a, i) => a.classList.toggle("on", Math.abs(items[i].getBoundingClientRect().top - curTop) < 4));
      nav.classList.toggle("show", cur >= 0 && $("#overview").getBoundingClientRect().bottom < nav.getBoundingClientRect().top);   // not over the globe
      // the bar is coloured only beside the part being read, not from the top down to it
      const on = links.filter((a) => a.classList.contains("on"));
      if (on.length) { const last = on[on.length - 1];
        nav.style.setProperty("--toc-top", `${on[0].offsetTop}px`);
        nav.style.setProperty("--toc-h", `${last.offsetTop + last.offsetHeight - on[0].offsetTop}px`); }
    };
    addEventListener("scroll", update, { passive: true });
    update();
  }

  async function initOverview() {
    initReactions();
    initToc();
    initRecall();
    initCopy();
    const [lb, prefs, examples] = await Promise.all([loadJSON("data/leaderboard.json"), loadJSON("data/preferences.json"), loadJSON("data/pref_examples.json")]);
    initPreview(lb);
    initDims(prefs, examples);
  }

  // ======================================================================
  // Leaderboard
  // ======================================================================
  async function initLeaderboard() {
    const [lb, mex] = await Promise.all([loadJSON("data/leaderboard.json"), loadJSON("data/metric_examples.json")]);
    const noEx = Object.keys(lb.metrics).filter((mk) => !mex.metrics[mk]?.text || !mex.metrics[mk]?.calc);
    if (noEx.length) throw new Error(`metric_examples.json: no example for ${noEx.join(", ")}`);
    const views = ["Overall", ...lb.dimensions];
    const st = {
      view: views.includes(store.get("lb.view")) ? store.get("lb.view") : "Overall",
      metric: "PSA",
      open: new Set(),
      pins: new Set(Array.isArray(store.get("lb.pins")) ? store.get("lb.pins") : []),
    };
    if (lb.views_metrics[st.view].includes(store.get("lb.metric"))) st.metric = store.get("lb.metric");
    const keyOf = (c, m) => (m ? `${c}|${m}` : c);
    const valueOf = (key, metric) => {
      const [c, m] = key.split("|");
      const e = lb.views[st.view][c][metric];
      return m ? e.models[m] : e.mean;
    };
    const labelOf = (key) => key.replace("|", " · ");

    const viewSeg = $("#view-seg");
    viewSeg.innerHTML = views.map((v) => `<button type="button" data-v="${esc(v)}">${esc(v)}</button>`).join("");
    viewSeg.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      st.view = b.dataset.v;
      if (!lb.views_metrics[st.view].includes(st.metric)) st.metric = "PSA";
      render();
    });

    const cell = (v, mk, isSel, rand) => {
      const m = lb.metrics[mk];
      const r = rand != null ? `<span class="rand" style="left:${pct(rand, m)}%;top:-3px;bottom:-3px"></span>` : "";
      return `<td class="${isSel ? "sel" : ""}"><div class="cell"><span class="num">${fmt(v, m.decimals)}</span>` +
        `<span class="track"><span class="fill" style="width:${pct(v, m)}%"></span>${r}</span></div></td>`;
    };
    const pinBtn = (key) => `<button class="pin" type="button" data-pin="${esc(key)}" aria-pressed="${st.pins.has(key)}" aria-label="Pin ${esc(labelOf(key))} to compare">${ICON.pin}</button>`;
    const rowHTML = (c, cls) => {
      const metrics = lb.views_metrics[st.view];
      const e = lb.views[st.view][c];
      const rand = (mk) => (st.view === "Overall" && mk === "PSA" ? lb.random_selection_psa : null);
      const expanded = st.open.has(c);
      let h = `<tr class="sys ${cls}" data-c="${esc(c)}" aria-expanded="${expanded}">` +
        `<td class="pin-col">${pinBtn(c)}</td><td class="name"><span class="swatch"></span>${esc(c)}<span class="chev">${ICON.chev}</span></td>` +
        metrics.map((mk) => cell(e[mk].mean, mk, mk === st.metric, rand(mk))).join("") + `</tr>`;
      if (expanded) {
        lb.models.forEach((m) => {
          h += `<tr class="model ${cls}"><td class="pin-col">${pinBtn(keyOf(c, m))}</td><td class="name">${esc(m)}</td>` +
            metrics.map((mk) => cell(e[mk].models[m], mk, mk === st.metric, rand(mk))).join("") + `</tr>`;
        });
      }
      return h;
    };

    function renderCompare() {
      const box = $("#compare");
      const pins = [...st.pins].filter((k) => lb.views[st.view][k.split("|")[0]]);
      box.classList.toggle("show", pins.length > 0);
      if (!pins.length) return;
      $("#compare-grid").innerHTML = lb.views_metrics[st.view].map((mk) => {
        const m = lb.metrics[mk];
        return `<div><h4>${mk}</h4>` + pins.map((k) => {
          const v = valueOf(k, mk);
          const ref = lb.reference_conditions.includes(k.split("|")[0]) ? " ref" : "";
          return `<div class="cbar${ref}"><span class="lbl">${esc(labelOf(k))}</span><span class="track"><span class="fill" style="width:${pct(v, m)}%"></span></span><span class="v">${fmt(v, m.decimals)}</span></div>`;
        }).join("") + `</div>`;
      }).join("");
    }

    function render() {
      store.set("lb.view", st.view); store.set("lb.metric", st.metric); store.set("lb.pins", [...st.pins]);
      $$("button", viewSeg).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === st.view)));
      const metrics = lb.views_metrics[st.view];
      const sorted = [...lb.memory_systems].sort((a, b) => lb.views[st.view][b][st.metric].mean - lb.views[st.view][a][st.metric].mean);
      $("#lb-table").innerHTML =
        `<colgroup><col class="pin-col"><col class="name-col">${metrics.map(() => "<col>").join("")}</colgroup>` +
        `<thead><tr><th class="pin-col"><span class="sr">Pin</span></th><th class="name-col">Memory</th>` +
        metrics.map((mk) => { const md = lb.metrics[mk];   // click sorts by the column; hover or focus shows what it measures
          return `<th class="m${mk === st.metric ? " sel" : ""}" data-m="${mk}" scope="col" tabindex="0">${mk}` +
            `<span class="tip" role="tooltip"><img src="assets/metric_${mk.toLowerCase()}.jpg" alt=""><b>${esc(md.name)} (${mk}, ${esc(md.unit)})</b><span>${esc(md.definition)}</span></span></th>`; }).join("") + `</tr></thead><tbody>` +
        sorted.map((c, i) => rowHTML(c, i === 0 ? "top" : "")).join("") +
        `<tr class="ref-sep"><td colspan="${metrics.length + 2}">Reference</td></tr>` +
        lb.reference_conditions.map((c) => rowHTML(c, "ref")).join("") + `</tbody>`;
      $("#lb-notes-rand").style.display = st.view === "Overall" && metrics.includes("PSA") ? "" : "none";
      $("#lb-notes-dim").style.display = st.view === "Overall" ? "none" : "";
      $("#rand-val").textContent = fmt(lb.random_selection_psa, 1);
      renderCompare();
    }

    // one card per metric under the table: a picture of what it measures, its full name and definition; a click
    // opens an example calculation below the cards, a second click on the same card closes it
    $("#mcards").innerHTML = Object.entries(lb.metrics).map(([mk, m]) => `<button class="mcard card" type="button" data-m="${mk}" aria-expanded="false" aria-controls="mex">` +
      `<img src="assets/metric_${mk.toLowerCase()}.jpg" alt=""><h3>${esc(m.name)} (${mk}, ${esc(m.unit)})</h3><p>${esc(m.definition)}</p>` +
      `<span class="mcard-more">Example</span></button>`).join("");
    $("#mcards").addEventListener("click", (e) => {
      const card = e.target.closest(".mcard");
      if (!card) return;
      const open = card.getAttribute("aria-expanded") !== "true";
      $$(".mcard", $("#mcards")).forEach((c) => c.setAttribute("aria-expanded", String(open && c === card)));
      const box = $("#mex"), mk = card.dataset.m, ex = mex.metrics[mk];
      box.hidden = !open;
      if (open) box.innerHTML = `<h3>Example: ${esc(lb.metrics[mk].name)} (${mk})</h3><p>${esc(ex.text)}</p><p class="mex-calc">${esc(ex.calc)}</p>`;
    });

    $("#lb-table").addEventListener("click", (e) => {
      const pin = e.target.closest("[data-pin]");
      if (pin) {
        const k = pin.dataset.pin;
        st.pins.has(k) ? st.pins.delete(k) : st.pins.add(k);
        render(); return;
      }
      const th = e.target.closest("th[data-m]");
      if (th) { st.metric = th.dataset.m; render(); return; }
      const tr = e.target.closest("tr.sys");
      if (tr) { const c = tr.dataset.c; st.open.has(c) ? st.open.delete(c) : st.open.add(c); render(); }
    });
    $("#lb-table").addEventListener("keydown", (e) => {
      const th = e.target.closest("th[data-m]");
      if (th && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); st.metric = th.dataset.m; render(); $(`th[data-m="${st.metric}"]`).focus(); }
    });
    $("#compare-clear").addEventListener("click", () => { st.pins.clear(); render(); });
    render();
  }

  // ======================================================================
  // Demo: demo.js (loaded before this file) gets the shared helpers
  // ======================================================================
  function initDemo() {
    if (!window.MPBDemo) throw new Error("demo.js did not load");
    return window.MPBDemo.init({ store, esc, loadJSON, USERS, avatar, $, $$ });
  }

  // ---------- boot ----------
  const page = document.body.dataset.page;
  renderTopbar(page);
  const run = { overview: initOverview, leaderboard: initLeaderboard, demo: initDemo }[page];
  Promise.resolve(run && run()).catch((err) => {
    console.error(err);
    const box = document.createElement("p");
    box.className = "wrap muted";
    box.textContent = "Some content could not be loaded: " + err.message;
    document.body.appendChild(box);
  }).finally(initReveal);
})();
