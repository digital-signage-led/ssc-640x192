import { CONFIG } from "./config.js?v=20261026c";
import {
  buildDemoWarnings,
  buildMarqueeText,
  fetchAreaNames,
  fetchFloodData,
  fetchWarningData,
  mergeWarningStates,
  parseActiveWarnings,
  parseFloodWarnings,
} from "./warnings.js";
import { evacForLevel } from "./warning-codes.js";
import {
  clearLiveQuake,
  fetchOsakaQuake,
  hideQuake,
  initQuake,
  runQuakeDemoCycle,
  showLiveQuake,
  startQuakeLoop,
} from "./quake.js?v=20261026d";

const $ = (id) => document.getElementById(id);

const els = {
  machine: $("machine"),
  marquee: $("marquee"),
  marqueeTextA: $("marqueeTextA"),
  marqueeTextB: $("marqueeTextB"),
  chipMarquee: $("chipMarquee"),
  alertList: $("alertList"),
  alertListB: $("alertListB"),
  clockTime: $("clockTime"),
  cardArea: $("cardArea"),
  cardUpdated: $("cardUpdated"),
  cardCount: $("cardCount"),
  cardLevelPill: $("cardLevelPill"),
  cardLevelNum: $("cardLevelNum"),
  cardLevelUnit: $("cardLevelUnit"),
  cardLevelLabel: $("cardLevelLabel"),
  titleTicker: $("titleTicker"),
  titleAlerts: $("titleAlerts"),
  quakeStage: $("quakeStage"),
};

const params = new URLSearchParams(location.search);
const forceDemo = params.has(CONFIG.demoQuery) || params.get("mode") === "demo";
const forceLive = params.get("live") === "1" || params.get("mode") === "live";
/** 地震デモは ?quake=1 のときだけ */
const forceQuake = params.get("quake") === "1" || params.get("mode") === "quake";
/** 自販機本編からの埋め込み。発表がなければすぐ親へ戻す */
const EMBED_SIGNAGE = params.get("embed") === "1";
const EMBED_HOLD_MS = 20000;
/** デモ周回は ?playlist=1 のときだけ。既定は発表中の本番のみ */
const usePlaylist =
  !forceDemo && !forceLive && !forceQuake && CONFIG.playlistByDefault !== false;

/** @type {Map<string, string>} */
let areaNames = new Map();
/** @type {string} */
let lastSignature = "";
let marqueeRaf = 0;
let chipRaf = 0;

/** @type {any[]} */
let cardItems = [];
let cardItemIndex = 0;
let cardRotateTimer = 0;
let cardsAnimating = false;
let sideSwapped = false;
let playlistGen = 0;
let liveQuakeKey_ = "";
let quakePollBusy_ = false;
let embedWarnReady_ = false;
let embedQuakeReady_ = false;
let embedHasWarn_ = false;
let embedHasQuake_ = false;
let embedReported_ = false;

function postParent_(payload) {
  try {
    if (window.parent && window.parent !== window) window.parent.postMessage(payload, "*");
  } catch (eMsg) {}
}

function considerEmbed_() {
  if (!EMBED_SIGNAGE || embedReported_) return;
  if (!embedWarnReady_ || !embedQuakeReady_) return;
  embedReported_ = true;
  const show = embedHasWarn_ || embedHasQuake_;
  /* 描画後に親へ知らせる。先に出すと親が黒い iframe を開く */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      postParent_({ type: "alert-board-status", show: show });
      if (!show) {
        postParent_({ type: "alert-board-done", show: false });
        return;
      }
      setTimeout(() => {
        postParent_({ type: "alert-board-done", show: true });
      }, EMBED_HOLD_MS);
    });
  });
}

function marqueeSpeed() {
  const custom = Number(els.machine?.dataset.speed);
  return Number.isFinite(custom) && custom > 0 ? custom : CONFIG.marqueeSpeedPxPerSec;
}

function setText(el, text) {
  if (el) el.textContent = text;
}

/* 4文字以上の種別名は左右を揃えて改行する（強風注意 → 強風 / 注意） */
function balancedSideTitle(text) {
  const chars = Array.from(String(text || ""));
  const n = chars.length;
  if (n <= 3) return chars.join("");
  const mid = n % 2 === 0 ? n / 2 : Math.ceil(n / 2);
  return `${chars.slice(0, mid).join("")}\n${chars.slice(mid).join("")}`;
}

function signatureOf(items) {
  return items
    .map((i) => `${i.code}:${i.status}:${i.source || ""}`)
    .sort()
    .join("|");
}

function formatTime(iso) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tickClock() {
  if (!els.clockTime) return;
  const now = new Date();
  els.clockTime.textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sideCards() {
  return [
    document.getElementById("sideCardLevel"),
    document.getElementById("sideCardMeta"),
  ].filter(Boolean);
}

function leftStage() {
  return document.querySelector(".face--left .card-stage");
}

function rightStage() {
  return document.querySelector(".face--right .card-stage");
}

function swapSideCardPositions() {
  const left = leftStage();
  const right = rightStage();
  const level = document.getElementById("sideCardLevel");
  const meta = document.getElementById("sideCardMeta");
  if (!left || !right || !level || !meta) return;

  sideSwapped = !sideSwapped;
  if (sideSwapped) {
    left.appendChild(meta);
    right.appendChild(level);
  } else {
    left.appendChild(level);
    right.appendChild(meta);
  }
}

let sideIntroPlayed_ = false;
function presentSideCards(updateFn) {
  if (!sideIntroPlayed_) {
    sideIntroPlayed_ = true;
    updateFn();
    return;
  }
  return animateSideCards(updateFn);
}

async function animateSideCards(updateFn) {
  const cards = sideCards();
  if (!cards.length) {
    updateFn();
    return;
  }
  if (cardsAnimating) {
    updateFn();
    return;
  }
  cardsAnimating = true;
  for (const c of cards) {
    c.classList.remove("is-enter");
    c.classList.add("is-exit");
  }
  await waitMs(380);
  updateFn();
  for (const c of cards) {
    c.classList.remove("is-exit");
    void c.offsetWidth;
    c.classList.add("is-enter");
  }
  await waitMs(420);
  for (const c of cards) c.classList.remove("is-enter");
  cardsAnimating = false;
}

function alertLevelFromState(active, theme, level) {
  if (!active) return 1;
  if (theme === "special" || level >= 5) return 5;
  if (theme === "danger" || level >= 4) return 4;
  if (theme === "warning" || level >= 3) return 3;
  if (theme === "advisory" || level >= 2) return 2;
  return 1;
}

function isDemoPhase() {
  return els.machine?.dataset?.phase === "demo";
}

function applyLevelCard(item, active) {
  const levelCard = $("sideCardLevel");
  if (!active || !item) {
    levelCard?.classList.remove("is-no-level");
    setText(els.cardLevelLabel, "レベル");
    setText(els.cardLevelPill, "なし");
    setText(els.cardLevelNum, "—");
    setText(els.cardLevelUnit, "発表なし");
    return;
  }
  const evac = evacForLevel(item.level || 1);
  const demo = isDemoPhase();
  const hasLevel = item.hasAlertLevel === true && !!item.level;

  // 大雨・土砂・高潮・氾濫：レベル数字あり／雷など：種別表示（数字なし）
  levelCard?.classList.toggle("is-no-level", !hasLevel);
  setText(els.cardLevelLabel, hasLevel ? "レベル" : "種別");
  setText(els.cardLevelPill, demo ? "デモ" : item.category);
  setText(els.cardLevelNum, hasLevel ? String(item.level) : "");
  const unitRaw = demo
    ? `${item.short || item.name}`.replace(/（デモ）$/, "") + "（デモ）"
    : item.short || item.name;
  setText(els.cardLevelUnit, hasLevel ? unitRaw : balancedSideTitle(unitRaw));
  const lv = alertLevelFromState(true, item.theme, item.level || 0);
  els.machine.dataset.level = String(lv);
  els.machine.dataset.theme = item.theme || "advisory";
  els.machine.dataset.evac = evac.label;
}

function applyMetaCard(_item, _active) {
  tickClock();
  setText(
    els.cardArea,
    isDemoPhase() ? `${CONFIG.displayArea}（デモ）` : CONFIG.displayArea,
  );
}

function applySidePair(item, active, { doSwap = false } = {}) {
  if (doSwap) swapSideCardPositions();
  applyLevelCard(item, active);
  applyMetaCard(item, active);
}

function stopCardRotation() {
  if (cardRotateTimer) clearInterval(cardRotateTimer);
  cardRotateTimer = 0;
}

function resetSidePositions() {
  const left = leftStage();
  const right = rightStage();
  const level = document.getElementById("sideCardLevel");
  const meta = document.getElementById("sideCardMeta");
  if (!left || !right || !level || !meta) return;
  left.appendChild(level);
  right.appendChild(meta);
  sideSwapped = false;
}

function startCardRotation(items) {
  stopCardRotation();
  cardItems = items || [];
  cardItemIndex = 0;
  if (cardItems.length === 0) return;
  cardRotateTimer = setInterval(() => {
    if (cardItems.length > 1) {
      cardItemIndex = (cardItemIndex + 1) % cardItems.length;
    }
    const item = cardItems[cardItemIndex];
    animateSideCards(() => {
      applySidePair(item, true, { doSwap: true });
    });
  }, 4500);
}

function stopMarquee() {
  if (marqueeRaf) cancelAnimationFrame(marqueeRaf);
  marqueeRaf = 0;
  if (!els.marquee) return;
  els.marquee.classList.remove("is-running");
  els.marquee.style.transform = "translateX(0)";
  els.marquee.style.removeProperty("--marquee-duration");
}

function startMarquee() {
  stopMarquee();
  if (!els.marquee || !els.marqueeTextA) return;

  const run = () => {
    const half = els.marqueeTextA.getBoundingClientRect().width;
    if (half < 8) return;
    const speed = marqueeSpeed();
    const duration = Math.max(8, half / speed);
    els.marquee.style.setProperty("--marquee-duration", `${duration}s`);
    els.marquee.classList.add("is-running");
  };

  if (document.fonts?.ready) {
    document.fonts.ready.then(run).catch(run);
  } else {
    requestAnimationFrame(() => requestAnimationFrame(run));
  }
}

/** テロップ1周分の所要ミリ秒（フォント待ちは最大2秒） */
async function measureMarqueeOnePassMs() {
  try {
    if (document.fonts?.ready) {
      await Promise.race([document.fonts.ready, waitMs(2_000)]);
    }
  } catch {
    /* ignore */
  }
  await waitMs(80);
  const half = els.marqueeTextA?.getBoundingClientRect().width || 0;
  if (half < 8) return 8_000;
  return Math.max(5_000, Math.round((half / marqueeSpeed()) * 1000));
}

function stopChipTicker() {
  if (chipRaf) cancelAnimationFrame(chipRaf);
  chipRaf = 0;
  if (!els.chipMarquee) return;
  els.chipMarquee.classList.remove("is-running");
  els.chipMarquee.style.transform = "translateX(0)";
  els.chipMarquee.style.removeProperty("--chip-duration");
}

function renderChipTicker(items, opts = {}) {
  const announced = (items || []).filter((item) => item && item.name);
  if (!els.alertList) return;

  stopChipTicker();

  if (!announced.length) {
    els.alertList.innerHTML = `<span class="chip-empty">発表なし</span>`;
    if (els.alertListB) els.alertListB.innerHTML = "";
    els.chipMarquee?.classList.add("is-static");
    return;
  }

  // 入りきる件数は静止。はみ出すときだけ流す。デモは各項目にも明示
  const demoChip = opts.demo
    ? `<span class="chip is-demo">デモ表示</span>`
    : "";
  const html =
    demoChip +
    announced
      .map((item) => {
        const label = opts.demo
          ? String(item.name).startsWith("【デモ】")
            ? item.name
            : `【デモ】${item.name}`
          : item.name;
        return `<span class="chip is-${item.theme || "advisory"}">${label}</span>`;
      })
      .join("");
  els.alertList.innerHTML = html;
  if (els.alertListB) els.alertListB.innerHTML = "";
  els.chipMarquee?.classList.add("is-static");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => startChipTicker(html));
  });
}

function chipContentFits() {
  const viewport = els.chipMarquee?.parentElement;
  if (!viewport || !els.alertList) return true;
  const contentW = els.alertList.scrollWidth;
  const viewW = viewport.clientWidth;
  return contentW <= viewW + 1;
}

function startChipTicker(trackHtml = "") {
  stopChipTicker();
  if (!els.chipMarquee || !els.alertList) return;

  const run = () => {
    if (chipContentFits()) {
      if (els.alertListB) els.alertListB.innerHTML = "";
      els.chipMarquee.classList.add("is-static");
      els.chipMarquee.classList.remove("is-running");
      els.chipMarquee.style.transform = "translateX(0)";
      return;
    }

    // 入りきらないときだけループ用に複製して流す
    if (els.alertListB) {
      els.alertListB.innerHTML = trackHtml || els.alertList.innerHTML;
    }
    els.chipMarquee.classList.remove("is-static");
    const half = els.alertList.getBoundingClientRect().width;
    if (half < 8) return;
    const speed = marqueeSpeed();
    const duration = Math.max(8, half / speed);
    els.chipMarquee.style.setProperty("--chip-duration", `${duration}s`);
    els.chipMarquee.classList.add("is-running");
  };

  if (document.fonts?.ready) {
    document.fonts.ready.then(run).catch(run);
  } else {
    run();
  }
}

function flashNotify() {
  if (!els.machine) return;
  els.machine.classList.remove("is-notifying");
  void els.machine.offsetWidth;
  els.machine.classList.add("is-notifying");
}

function tagOsaka(state) {
  return {
    ...state,
    items: (state.items || []).map((item) => ({
      ...item,
      areas: [CONFIG.displayArea],
    })),
  };
}

function liveQuakeOn_() {
  const stage = els.quakeStage;
  return !!(stage && stage.classList.contains("is-live") && !stage.hasAttribute("hidden"));
}

function render(state, opts = {}) {
  /* 発表中の地震は警報の再描画で消さない */
  if (!liveQuakeOn_()) hideQuake();
  const active = state.items.length > 0;
  const top = state.items[0];
  const theme = top?.theme || "advisory";
  const maxLevel = top?.level || 0;
  const isDemo = opts.phase === "demo";

  els.machine.dataset.active = active ? "true" : "false";
  els.machine.dataset.theme = theme;
  els.machine.dataset.level = String(alertLevelFromState(active, theme, maxLevel));
  els.machine.dataset.phase = opts.phase || (active ? "live" : "idle");

  setText(
    els.cardUpdated,
    isDemo
      ? `更新（デモ） ${formatTime(state.reportDatetime)}`
      : `更新 ${formatTime(state.reportDatetime)}`,
  );
  setText(
    els.cardCount,
    isDemo ? `${state.items.length}件・デモ` : `${state.items.length}件`,
  );
  setText(els.cardArea, isDemo ? `${CONFIG.displayArea}（デモ）` : CONFIG.displayArea);
  setText(els.titleTicker, isDemo ? "警報テロップ（デモ）" : "警報テロップ");
  setText(els.titleAlerts, isDemo ? "発表中の情報（デモ）" : "発表中の情報");

  if (!active) {
    stopMarquee();
    stopChipTicker();
    stopCardRotation();
    const fail = opts.fetchError;
    if (fail) {
      if (els.alertList) {
        els.alertList.innerHTML = `<span class="chip-empty">取得失敗</span>`;
      }
      if (els.alertListB) els.alertListB.innerHTML = "";
      els.chipMarquee?.classList.add("is-static");
      setText(els.cardCount, "—");
      setText(els.cardLevelUnit, "取得失敗");
      const failText =
        "警報データを取得できません　start.bat か node server.mjs で http://127.0.0.1:8080/ を開いてください　　";
      if (els.marqueeTextA) els.marqueeTextA.innerHTML = failText;
      if (els.marqueeTextB) els.marqueeTextB.innerHTML = failText;
    } else {
      renderChipTicker([]);
      const idle = CONFIG.idleMarqueeText;
      if (els.marqueeTextA) els.marqueeTextA.innerHTML = idle;
      if (els.marqueeTextB) els.marqueeTextB.innerHTML = idle;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => startMarquee());
    });
    presentSideCards(() => {
      resetSidePositions();
      if (fail) {
        setText(els.cardLevelPill, "—");
        setText(els.cardLevelNum, "!");
        setText(els.cardLevelUnit, "取得失敗");
        tickClock();
      } else {
        applySidePair(null, false, { doSwap: false });
      }
    });
    if (opts.notify) flashNotify();
    return;
  }

  let text = buildMarqueeText(state);
  if (isDemo) {
    text = `<span class="tag">【デモ表示】</span>これはデモです　本番の気象庁発表ではありません　${text}`;
  }
  if (els.marqueeTextA) els.marqueeTextA.innerHTML = text;
  if (els.marqueeTextB) els.marqueeTextB.innerHTML = text;

  renderChipTicker(state.items, { demo: isDemo });

  presentSideCards(() => {
    resetSidePositions();
    applySidePair(top, true, { doSwap: false });
  });
  startCardRotation(state.items);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => startMarquee());
  });

  if (opts.notify) flashNotify();
}

async function loadLiveState() {
  const raw = await fetchWarningData(CONFIG.areaCode);
  let weather = parseActiveWarnings(raw, areaNames);
  try {
    const floodRaw = await fetchFloodData();
    const flood = parseFloodWarnings(floodRaw, CONFIG.targetAreaCode);
    weather = mergeWarningStates(weather, flood);
  } catch (err) {
    console.warn("氾濫データ取得失敗", err);
  }
  return tagOsaka(weather);
}

function loadDemoState() {
  return tagOsaka(buildDemoWarnings());
}

/**
 * プレイリスト（この順番で必ず回す）:
 * 1) 本番（警報ライブ）10秒
 * 2) 警報デモ1周（上限あり）
 * 3) 地震デモ（震度シーン1周）
 * 各コンテンツ切替のあいだに1秒静止
 * 4) 最初に戻る
 */
async function runPlaylist() {
  const gen = ++playlistGen;
  const gap = CONFIG.phaseGapMs ?? 1_000;

  async function holdStill(ms = gap) {
    stopMarquee();
    stopChipTicker();
    stopCardRotation();
    await waitMs(ms);
  }

  while (gen === playlistGen) {
    /* --- 1) 本番 --- */
    hideQuake();
    let live = {
      items: [],
      headline: "",
      reportDatetime: new Date().toISOString(),
      publishingOffice: "",
    };
    let fetchError = false;
    try {
      live = await loadLiveState();
    } catch (err) {
      console.warn("ライブ取得失敗", err);
      fetchError = true;
    }

    const sig = signatureOf(live.items);
    const changed = sig !== lastSignature;
    lastSignature = sig || "idle";

    render(live, {
      notify: !fetchError && (changed || live.items.length > 0),
      phase: live.items.length ? "live" : "idle",
      fetchError,
    });
    await waitMs(CONFIG.livePhaseMs || 10_000);
    if (gen !== playlistGen) return;
    await holdStill();
    if (gen !== playlistGen) return;

    /* --- 2) 警報デモ --- */
    hideQuake();
    const demo = loadDemoState();
    render(demo, { notify: true, phase: "demo" });
    const onePass = await measureMarqueeOnePassMs();
    const demoMs = Math.min(onePass, CONFIG.demoPhaseMaxMs || 18_000);
    await waitMs(demoMs);
    if (gen !== playlistGen) return;
    await holdStill();
    if (gen !== playlistGen) return;

    /* --- 3) 地震デモ --- */
    try {
      await runQuakeDemoCycle(CONFIG.quakeSceneMs || 2_500, gap);
    } catch (err) {
      console.warn("地震デモ失敗", err);
    }
    if (gen !== playlistGen) return;
    hideQuake();
    await holdStill();
  }
}

async function pollLiveQuake_() {
  if (quakePollBusy_) return;
  quakePollBusy_ = true;
  try {
    const q = await fetchOsakaQuake();
    embedHasQuake_ = !!q;
    embedQuakeReady_ = true;
    if (!q) {
      if (liveQuakeKey_) {
        liveQuakeKey_ = "";
        clearLiveQuake();
      }
      return;
    }
    const key = q.eid + ":" + String(q.localInt);
    if (key === liveQuakeKey_) return;
    liveQuakeKey_ = key;
    showLiveQuake(q);
  } catch (err) {
    embedQuakeReady_ = true;
    console.warn("[地震] 取得失敗（表示中の地震は維持）:", (err && err.message) || err);
  } finally {
    quakePollBusy_ = false;
    considerEmbed_();
  }
}

async function refreshFixed({ demo = false, notifyOnChange = true } = {}) {
  try {
    const state = demo ? loadDemoState() : await loadLiveState();
    const sig = signatureOf(state.items);
    const changed = sig !== lastSignature;
    const becameActive =
      state.items.length > 0 && (lastSignature === "" || lastSignature === "idle");
    const newlyIssued = changed && state.items.some((i) => i.status === "発表");
    lastSignature = sig || "idle";
    embedHasWarn_ = state.items.length > 0;
    embedWarnReady_ = true;
    render(state, {
      notify: notifyOnChange && (becameActive || newlyIssued || demo),
      phase: demo ? "demo" : state.items.length ? "live" : "idle",
    });
    considerEmbed_();
  } catch (err) {
    console.error(err);
    embedHasWarn_ = false;
    embedWarnReady_ = true;
    considerEmbed_();
    if (demo) {
      render(loadDemoState(), { notify: true, phase: "demo" });
    } else {
      render(
        { items: [], headline: "", reportDatetime: "", publishingOffice: "" },
        { notify: false, phase: "idle", fetchError: true },
      );
    }
  }
}

async function boot() {
  if (els.quakeStage) initQuake(els.quakeStage);
  tickClock();
  setInterval(tickClock, 1000);
  requestAnimationFrame(() => startMarquee());
  try {
    areaNames = await fetchAreaNames();
  } catch {
    areaNames = new Map();
  }

  if (forceQuake) {
    startQuakeLoop(CONFIG.quakeSceneMs || 3_500);
    return;
  }

  if (usePlaylist) {
    runPlaylist();
    return;
  }

  /* 地震は警報より短い間隔で見る。発表が入ったらすぐ出す */
  pollLiveQuake_();
  setInterval(pollLiveQuake_, CONFIG.quakePollMs || 10_000);

  await refreshFixed({ demo: forceDemo, notifyOnChange: true });
  setInterval(
    () => refreshFixed({ demo: forceDemo, notifyOnChange: false }),
    CONFIG.pollIntervalMs,
  );
}

boot();
