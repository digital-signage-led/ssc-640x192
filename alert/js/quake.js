import { CONFIG } from "./config.js?v=20261026c";

/** 販売機 地震緊急 640×192 · E.Q1.0（デモ） */

export const CONTENT_VERSION = "E.Q1.0";
export const LOCAL_CITY = "舞鶴市";

/** 気象庁震度階級カラー＋ゆれの状況（参考図準拠） */
export const INT_META = {
  0: { cls: "i0", label: "0", fg: "#212121", desc: "人はゆれを感じない" },
  1: { cls: "i1", label: "1", fg: "#212121", desc: "屋内にいる人の一部がわずかにゆれを感じる" },
  2: { cls: "i2", label: "2", fg: "#0D47A1", desc: "照明などのつり下げ物が、わずかにゆれる" },
  3: { cls: "i3", label: "3", fg: "#1565C0", desc: "棚にある食器類が音を立てることがある" },
  4: {
    cls: "i4",
    label: "4",
    fg: "#F9A825",
    desc: "つり下げ物は大きくゆれ、棚にある食器類は音を立てる",
  },
  5: {
    cls: "i5l",
    label: "5弱",
    fg: "#F9A825",
    desc: "耐震性の低い建物では壁などにひびが入ることがある",
  },
  "5u": {
    cls: "i5u",
    label: "5強",
    fg: "#EF6C00",
    desc: "耐震性の低い建物では壁などに大きなひび割れが生じることがある",
  },
  6: {
    cls: "i6l",
    label: "6弱",
    fg: "#E53935",
    desc: "耐震性の低い建物では、壁などのタイルが落下することがある",
  },
  "6u": {
    cls: "i6u",
    label: "6強",
    fg: "#B71C1C",
    desc: "耐震性の低い建物では、傾くものや倒れるものが多くなる",
  },
  7: {
    cls: "i7",
    label: "7",
    fg: "#9C27B0",
    desc: "耐震性の低い建物では、傾くものや倒れるものがさらに多くなる",
  },
};

/** デモシーン（本番の緊急地震速報ではありません） */
export const SCENES = [
  {
    severe: "",
    localInt: 1,
    epicenter: "京都府北部",
    depth: 30,
    mag: 3.2,
    alert: "【デモ】緊急地震速報　揺れに注意",
  },
  {
    severe: "",
    localInt: 2,
    epicenter: "滋賀県北部",
    depth: 20,
    mag: 4.0,
    alert: "【デモ】緊急地震速報　強い揺れに警戒",
  },
  {
    severe: "",
    localInt: 3,
    epicenter: "京都府南部",
    depth: 15,
    mag: 4.4,
    alert: "【デモ】緊急地震速報　強い揺れに警戒",
  },
  {
    severe: "is-severe",
    localInt: 4,
    epicenter: "奈良県",
    depth: 12,
    mag: 5.0,
    alert: "【デモ】緊急地震速報　強い揺れが来ます",
  },
  {
    severe: "is-severe",
    localInt: 5,
    epicenter: "京都府北部",
    depth: 10,
    mag: 5.4,
    alert: "【デモ】緊急地震速報　強い揺れが来ます",
  },
  {
    severe: "is-severe",
    localInt: "5u",
    epicenter: "兵庫県南東部",
    depth: 10,
    mag: 5.8,
    alert: "【デモ】緊急地震速報　強い揺れが来ます",
  },
  {
    severe: "is-extreme",
    localInt: 6,
    epicenter: "和歌山県北部",
    depth: 8,
    mag: 6.2,
    alert: "【デモ】緊急地震速報　ただちに身を守って",
  },
  {
    severe: "is-extreme",
    localInt: "6u",
    epicenter: "和歌山県北部",
    depth: 8,
    mag: 6.6,
    alert: "【デモ】緊急地震速報　ただちに身を守って",
  },
  {
    severe: "is-extreme",
    localInt: 7,
    epicenter: "和歌山県北部",
    depth: 5,
    mag: 7.0,
    alert: "【デモ】緊急地震速報　ただちに身を守って",
  },
];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let sceneIndex = 0;
let enterTimer = 0;
let cycleTimer = 0;
let cycleGen = 0;
let root = null;

function intMeta(v) {
  return INT_META[v] || INT_META[Number(v)] || INT_META[0];
}

function fitNowrap(el, maxPx, minPx) {
  if (!el) return;
  let size = maxPx;
  el.style.fontSize = size + "px";
  while (size > minPx && el.scrollWidth > el.clientWidth + 1) {
    size -= 1;
    el.style.fontSize = size + "px";
  }
}

function fitWrap(el, maxPx, minPx, maxH) {
  if (!el) return;
  let size = maxPx;
  el.style.fontSize = size + "px";
  while (size > minPx && el.scrollHeight > maxH + 1) {
    size -= 1;
    el.style.fontSize = size + "px";
  }
}

function alertIconHtml() {
  return (
    '<span class="quake-alert-icon" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12 2L22 20H2L12 2Z" fill="#fff" fill-opacity=".95"/>' +
    '<path d="M12 9v5" stroke="#C62828" stroke-width="2.4" stroke-linecap="round"/>' +
    '<circle cx="12" cy="17" r="1.3" fill="#C62828"/>' +
    "</svg></span>"
  );
}

function refitQuakeText() {
  requestAnimationFrame(() => {
    if (!root || root.hasAttribute("hidden")) return;
    const main = $("#quakeFrontMain", root);
    fitNowrap(main, main && main.classList.contains("is-wide") ? 26 : 32, 20);
    fitNowrap($("#quakeFrontSub", root), 16, 12);
    fitNowrap($("#quakeAdviceAct", root), 16, 12);
    fitWrap($("#quakeAdviceDesc", root), 14, 11, 36);
  });
}

function setTicker(text) {
  if (!root) return;
  const item =
    '<span class="quake-ticker-item">' +
    alertIconHtml() +
    '<span class="quake-alert-text"></span></span>';
  const half = item + item + item;
  const track = $("#quakeTickerTrack", root);
  if (!track) return;
  track.innerHTML = half + half;
  track.querySelectorAll(".quake-alert-text").forEach((n) => {
    n.textContent = text;
  });
  track.style.animation = "none";
  void track.offsetWidth;
  track.style.animation = "";
}

function setAdvice(action, desc) {
  if (!root) return;
  const act = $("#quakeAdviceAct", root);
  const dsc = $("#quakeAdviceDesc", root);
  if (act) act.textContent = action;
  if (dsc) dsc.textContent = desc;
  refitQuakeText();
}

function setFront(s) {
  if (!root) return;
  const meta = intMeta(s.localInt);
  const main = $("#quakeFrontMain", root);
  if (!main) return;
  const text = `${LOCAL_CITY} 震度${meta.label}（デモ）`;
  main.textContent = text;
  main.style.setProperty("--int-fg", meta.fg);
  main.classList.toggle("is-wide", text.length >= 8);
  const sub = $("#quakeFrontSub", root);
  if (sub) sub.textContent = `【デモ】震源 ${s.epicenter} / M${s.mag}`;
  refitQuakeText();
}

function setSideIntensity(v) {
  if (!root) return;
  const meta = intMeta(v);
  const label = String(meta.label);
  const wide = label.length > 1;
  $$(".quake-card-side", root).forEach((card) => {
    card.className = `quake-card quake-card-side ${meta.cls}`;
  });
  $$(".js-quake-side-int", root).forEach((el) => {
    el.classList.toggle("is-wide", wide);
    const m = label.match(/^(\d)(弱|強)$/);
    if (m) {
      el.innerHTML =
        `<span class="int-num">${m[1]}</span>` +
        `<span class="int-mod">${m[2]}</span>`;
    } else {
      el.textContent = label;
    }
  });
}

function setSideTicker(s) {
  const meta = intMeta(s.localInt);
  setAdvice("【デモ】身の安全を確保してください", meta.desc);
}

function playEnter() {
  if (!root) return;
  root.classList.add("is-enter");
  if (enterTimer) clearTimeout(enterTimer);
  enterTimer = setTimeout(() => {
    root?.classList.remove("is-enter");
  }, 520);
}

export function applyScene(idx) {
  if (!root) return;
  const s = SCENES[idx % SCENES.length];
  sceneIndex = idx % SCENES.length;
  const keepEnter = root.classList.contains("is-enter");
  root.classList.remove("is-severe", "is-extreme", "is-enter", "is-live");
  if (s.severe) root.classList.add(s.severe);
  if (keepEnter) root.classList.add("is-enter");

  setTicker(s.alert);
  setFront(s);
  setSideIntensity(s.localInt);
  setSideTicker(s);
  playEnter();
}

export function initQuake(stageEl) {
  root = stageEl;
  sceneIndex = 0;
}

export function hideQuake() {
  stopQuakeCycle();
  document.body.classList.remove("is-quake");
  const machine = document.getElementById("machine");
  machine?.classList.remove("is-hidden");
  if (!root) return;
  root.classList.remove("is-visible", "is-severe", "is-extreme", "is-enter", "is-live");
  root.setAttribute("hidden", "");
}

export function showQuake() {
  if (!root) return;
  root.removeAttribute("hidden");
  root.classList.add("is-visible");
  document.body.classList.add("is-quake");
  refitQuakeText();
  const machine = document.getElementById("machine");
  machine?.classList.add("is-hidden");
}

export function stopQuakeCycle() {
  cycleGen += 1;
  if (cycleTimer) {
    clearTimeout(cycleTimer);
    cycleTimer = 0;
  }
  if (enterTimer) {
    clearTimeout(enterTimer);
    enterTimer = 0;
  }
}

/**
 * デモシーンを1周（各 sceneMs）再生して完了する
 * シーン切替のあいだに gapMs 静止
 * @param {number} sceneMs
 * @param {number} gapMs
 */
export function runQuakeDemoCycle(sceneMs = 3500, gapMs = 1000) {
  const myGen = ++cycleGen;
  if (cycleTimer) {
    clearTimeout(cycleTimer);
    cycleTimer = 0;
  }
  showQuake();
  applyScene(0);

  return new Promise((resolve) => {
    let i = 0;
    const finish = () => {
      resolve();
    };
    const step = () => {
      if (myGen !== cycleGen) {
        finish();
        return;
      }
      i += 1;
      if (i >= SCENES.length) {
        finish();
        return;
      }
      applyScene(i);
      cycleTimer = setTimeout(step, sceneMs + Math.max(0, gapMs));
    };
    cycleTimer = setTimeout(step, sceneMs + Math.max(0, gapMs));
  });
}

/**
 * 地震デモのみ連続再生（?quake=1）
 * @param {number} sceneMs
 */
export function startQuakeLoop(sceneMs = 3500) {
  const gen = ++cycleGen;
  if (cycleTimer) {
    clearTimeout(cycleTimer);
    cycleTimer = 0;
  }
  showQuake();
  applyScene(0);

  const tick = () => {
    if (gen !== cycleGen) return;
    applyScene(sceneIndex + 1);
    cycleTimer = setTimeout(tick, sceneMs);
  };
  cycleTimer = setTimeout(tick, sceneMs);
}

/** 舞鶴市（政令市のような区分割はない） */
export function isTargetCityCode(code) {
  return String(code || "") === String(CONFIG.quakeCityCode || "2620200");
}

export function shindoKey(raw) {
  const s = String(raw || "").trim();
  if (s === "5-" || s === "５弱" || s === "5弱") return 5;
  if (s === "5+" || s === "５強" || s === "5強") return "5u";
  if (s === "6-" || s === "６弱" || s === "6弱") return 6;
  if (s === "6+" || s === "６強" || s === "6強") return "6u";
  if (s === "7" || s === "７") return 7;
  const n = Number(s);
  if (n >= 1 && n <= 4) return n;
  return null;
}

function shindoRank(key) {
  if (key === "5u") return 5.5;
  if (key === "6u") return 6.5;
  const n = Number(key);
  return Number.isFinite(n) ? n : 0;
}

function quakeTimeMs(item) {
  if (!item) return 0;
  const at = Date.parse(item.at || item.rdt || "");
  if (Number.isFinite(at)) return at;
  const c = String(item.ctt || "");
  if (c.length < 14) return 0;
  return Date.UTC(
    Number(c.slice(0, 4)),
    Number(c.slice(4, 6)) - 1,
    Number(c.slice(6, 8)),
    Number(c.slice(8, 10)) - 9,
    Number(c.slice(10, 12)),
    Number(c.slice(12, 14)),
  );
}

function alertForRank(ttl, rank) {
  const head = ttl && !/取消/.test(ttl) ? ttl : "地震情報";
  if (rank >= 6) return `${head}　ただちに身を守って`;
  if (rank >= 4) return `${head}　強い揺れに警戒`;
  if (rank >= 3) return `${head}　揺れに注意`;
  return `${head}　${LOCAL_CITY}で揺れを観測`;
}

/**
 * 舞鶴市が震度に入っている発表だけ返す。新しいものを優先。
 * @param {unknown} list
 * @param {number} now
 */
export function pickOsakaQuake(list, now = Date.now()) {
  if (!Array.isArray(list)) return null;
  const showMs = CONFIG.quakeShowMs || 3 * 60 * 60 * 1000;
  let best = null;
  for (const item of list) {
    const ift = String(item?.ift || "");
    const ttl = String(item?.ttl || "");
    if (ift.includes("取消") || ttl.includes("取消")) continue;
    if (ift && ift !== "発表") continue;
    let key = null;
    let rank = 0;
    for (const block of item.int || []) {
      for (const city of block.city || []) {
        if (!isTargetCityCode(city.code)) continue;
        const next = shindoKey(city.maxi || block.maxi);
        const nextRank = shindoRank(next);
        if (next != null && nextRank >= rank) {
          key = next;
          rank = nextRank;
        }
      }
    }
    if (key == null) continue;
    const atMs = quakeTimeMs(item);
    if (!atMs || now - atMs > showMs || atMs > now + 120000) continue;
    if (!best || atMs > best.atMs || (atMs === best.atMs && rank > best.rank)) {
      best = {
        atMs,
        eid: String(item.eid || item.ctt || atMs),
        ttl: ttl || "地震情報",
        epicenter: String(item.anm || ""),
        mag: String(item.mag || ""),
        localInt: key,
        rank,
        alert: alertForRank(ttl || "地震情報", rank),
      };
    }
  }
  return best;
}

const QUAKE_LIST_URLS = [
  "/api/quake",
  "http://127.0.0.1:8080/api/quake",
  "https://www.jma.go.jp/bosai/quake/data/list.json",
];

export async function fetchOsakaQuake(now = Date.now()) {
  let lastErr = null;
  for (const url of QUAKE_LIST_URLS) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        lastErr = new Error("quake HTTP " + res.status);
        continue;
      }
      return pickOsakaQuake(await res.json(), now);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("地震情報取得失敗");
}

function setFrontLive(s) {
  if (!root) return;
  const meta = intMeta(s.localInt);
  const main = $("#quakeFrontMain", root);
  if (!main) return;
  const text = `${LOCAL_CITY} 震度${meta.label}`;
  main.textContent = text;
  main.style.setProperty("--int-fg", meta.fg);
  main.classList.toggle("is-wide", text.length >= 8);
  const sub = $("#quakeFrontSub", root);
  if (sub) {
    const place = s.epicenter ? `震源 ${s.epicenter}` : "震源 ---";
    const mag = s.mag ? ` / M${s.mag}` : "";
    sub.textContent = place + mag;
  }
  refitQuakeText();
}

function setSideTickerLive(s) {
  const meta = intMeta(s.localInt);
  setAdvice("身の安全を確保してください", meta.desc);
}

/** 発表中の地震情報をすぐ出す（デモ文言なし） */
export function showLiveQuake(q) {
  if (!root || !q) return;
  stopQuakeCycle();
  root.classList.remove("is-severe", "is-extreme");
  root.classList.add("is-live");
  if (q.rank >= 6) root.classList.add("is-extreme");
  else if (q.rank >= 4) root.classList.add("is-severe");
  setTicker(q.alert);
  setFrontLive(q);
  setSideIntensity(q.localInt);
  setSideTickerLive(q);
  showQuake();
  playEnter();
}

export function clearLiveQuake() {
  root?.classList.remove("is-live");
  hideQuake();
}
