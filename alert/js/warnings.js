import { CONFIG } from "./config.js";
import { resolveWarning, themeForLevel, evacForLevel } from "./warning-codes.js";

/**
 * 令和8年体系 r8 JSON から発表中の警報・注意報を抽出する
 * targetAreaCode がある場合は当該市区町村（class20）のみ対象
 * @param {unknown} payload
 * @param {Map<string, string>} areaNames
 */
export function parseActiveWarnings(payload, areaNames = new Map()) {
  if (!Array.isArray(payload)) {
    return { items: [], headline: "", reportDatetime: "", publishingOffice: "" };
  }

  const target = CONFIG.targetAreaCode ? String(CONFIG.targetAreaCode) : "";

  /** @type {Map<string, { code: string, name: string, category: string, level: number, short: string, areas: Set<string>, status: string }>} */
  const byCode = new Map();
  let headline = "";
  let reportDatetime = "";
  let publishingOffice = "";
  let newestMs = -Infinity;

  for (const entry of payload) {
    if (!entry || typeof entry !== "object") continue;
    const warning = entry.warning;
    if (!warning) continue;

    const class20 = Array.isArray(warning.class20Items) ? warning.class20Items : [];
    const class10 = Array.isArray(warning.class10Items) ? warning.class10Items : [];
    // 市区町村指定時は class20 のみ（街の防災情報ページと同じ）
    const areas = target
      ? class20.filter((a) => String(a.areaCode) === target)
      : [...class20, ...class10];

    let hitActive = false;
    for (const area of areas) {
      const areaCode = String(area.areaCode || "");
      const areaName =
        areaNames.get(areaCode) || (target ? CONFIG.displayArea : areaCode);
      const kinds = Array.isArray(area.kinds) ? area.kinds : [];

      for (const kind of kinds) {
        if (!kind || !kind.code) continue;
        if (!CONFIG.activeStatuses.has(kind.status)) continue;
        hitActive = true;

        const meta = resolveWarning(kind.code);
        const key = String(kind.code).padStart(2, "0");
        if (!byCode.has(key)) {
          byCode.set(key, {
            code: key,
            name: meta.name,
            category: meta.category,
            level: meta.level,
            short: meta.short,
            hazard: meta.hazard || "",
            hasAlertLevel: meta.hasAlertLevel === true,
            areas: new Set(),
            status: kind.status,
          });
        }
        const item = byCode.get(key);
        item.areas.add(areaName);
        if (kind.status === "発表") item.status = kind.status;
      }
    }

    if (!hitActive) continue;
    const t = entry.reportDatetime ? Date.parse(entry.reportDatetime) : NaN;
    if (Number.isFinite(t) && t >= newestMs) {
      newestMs = t;
      if (entry.headlineText) headline = entry.headlineText;
      if (entry.reportDatetime) reportDatetime = entry.reportDatetime;
      if (entry.publishingOffice) publishingOffice = entry.publishingOffice;
    }
  }

  const items = [...byCode.values()]
    .map((item) => ({
      ...item,
      areas: [...item.areas],
      theme: themeForLevel(item.level),
    }))
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, "ja"));

  return { items, headline, reportDatetime, publishingOffice };
}

/** 指定河川洪水予報（氾濫）JSON — bosai/flood */
const FLOOD_CODE_MAP = {
  /* flood_xml の item.code → 警報コード体系 */
  "20": "18", // レベル２氾濫注意報
  "30": "04", // レベル３氾濫警報（想定）
  "40": "40", // レベル４氾濫危険警報（想定）
  "50": "51", // レベル５氾濫特別警報（想定）
};

export async function fetchFloodData() {
  const urls = [
    "/api/flood",
    "http://127.0.0.1:8080/api/flood",
    "https://www.jma.go.jp/bosai/flood/data/r8/flood_xml.json",
  ];
  let lastErr = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        lastErr = new Error(`氾濫データ取得失敗 (${res.status})`);
        continue;
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("氾濫データ取得失敗");
}

/**
 * 氾濫注意報・警報（河川単位）を市区町村向けに抽出
 * @param {unknown} payload
 * @param {string} targetAreaCode
 */
export function parseFloodWarnings(payload, targetAreaCode = CONFIG.targetAreaCode) {
  if (!Array.isArray(payload)) {
    return { items: [], headline: "", reportDatetime: "", publishingOffice: "" };
  }
  const target = String(targetAreaCode || "");
  /** @type {Map<string, any>} */
  const byCode = new Map();
  let reportDatetime = "";
  let publishingOffice = "";
  let newestMs = -Infinity;

  for (const entry of payload) {
    if (!entry || typeof entry !== "object") continue;
    const name = String(entry.item?.name || "");
    if (!name || name.includes("解除")) continue;
    if (entry.infoType === "取消") continue;

    const areas = Array.isArray(entry.class20Codes)
      ? entry.class20Codes.map(String)
      : [];
    if (target && !areas.includes(target)) continue;

    const floodCode = String(entry.item?.code || "").padStart(2, "0");
    const warnCode = FLOOD_CODE_MAP[floodCode] || floodCode;
    const meta = resolveWarning(warnCode);
    const river = entry.riverName || entry.item?.areas?.[0]?.name || "河川";
    const key = warnCode;

    if (!byCode.has(key) || (meta.level || 0) >= (byCode.get(key).level || 0)) {
      byCode.set(key, {
        code: key,
        name: meta.name.startsWith("レベル") ? meta.name : name.replace(/（発表）$/, ""),
        category: meta.category,
        level: meta.level,
        short: meta.short,
        hazard: meta.hazard || "河川氾濫",
        hasAlertLevel: true,
        areas: new Set([river]),
        status: "発表",
        theme: themeForLevel(meta.level),
        source: "flood",
      });
    } else {
      byCode.get(key).areas.add(river);
    }

    const t = entry.reportDatetime ? Date.parse(entry.reportDatetime) : NaN;
    if (Number.isFinite(t) && t >= newestMs) {
      newestMs = t;
      reportDatetime = entry.reportDatetime || reportDatetime;
      publishingOffice = entry.publishingOffice || publishingOffice;
    }
  }

  const items = [...byCode.values()].map((item) => ({
    ...item,
    areas: [...item.areas],
  }));

  return { items, headline: "", reportDatetime, publishingOffice };
}

/** 警報・注意報と氾濫情報を合流（同一コードは高いレベル優先） */
export function mergeWarningStates(base, extra) {
  const byCode = new Map();
  for (const item of base.items || []) {
    byCode.set(item.code, { ...item, areas: [...(item.areas || [])] });
  }
  for (const item of extra.items || []) {
    const prev = byCode.get(item.code);
    if (!prev || (item.level || 0) > (prev.level || 0)) {
      byCode.set(item.code, {
        ...item,
        areas: [...new Set([...(prev?.areas || []), ...(item.areas || [])])],
      });
    } else {
      prev.areas = [...new Set([...prev.areas, ...(item.areas || [])])];
    }
  }
  const items = [...byCode.values()].sort(
    (a, b) => b.level - a.level || a.name.localeCompare(b.name, "ja"),
  );
  const reportDatetime =
    [base.reportDatetime, extra.reportDatetime]
      .filter(Boolean)
      .sort()
      .at(-1) || base.reportDatetime || extra.reportDatetime || "";
  return {
    items,
    headline: base.headline || extra.headline || "",
    reportDatetime,
    publishingOffice: base.publishingOffice || extra.publishingOffice || "",
  };
}

export async function fetchWarningData(areaCode = CONFIG.areaCode) {
  const code = encodeURIComponent(areaCode);
  const urls = [
    `/api/warning?code=${code}`,
    `http://127.0.0.1:8080/api/warning?code=${code}`,
    `https://www.jma.go.jp/bosai/warning/data/r8/${code}.json`,
  ];

  let lastErr = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        lastErr = new Error(`警報データ取得失敗 (${res.status}) ${url}`);
        continue;
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("警報データ取得失敗");
}

export async function fetchAreaNames() {
  const urls = [
    "/api/area",
    "http://127.0.0.1:8080/api/area",
    "https://www.jma.go.jp/bosai/common/const/area.json",
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      const map = new Map();

      const class20 = data?.class20s || {};
      for (const [code, info] of Object.entries(class20)) {
        if (info?.name) map.set(code, info.name);
      }
      const class10 = data?.class10s || {};
      for (const [code, info] of Object.entries(class10)) {
        if (info?.name) map.set(code, info.name);
      }
      const offices = data?.offices || {};
      for (const [code, info] of Object.entries(offices)) {
        if (info?.name) map.set(code, info.name);
      }
      return map;
    } catch {
      /* try next */
    }
  }
  return new Map();
}

/**
 * 流れ文字用メッセージを組み立てる
 * @param {{ items: any[], headline: string, publishingOffice: string }} state
 */
export function buildMarqueeText(state) {
  if (!state.items.length) return "";

  const parts = state.items.map((item) => {
    const areaText =
      item.areas.length <= 3
        ? item.areas.join("・")
        : `${item.areas.slice(0, 3).join("・")}ほか${item.areas.length - 3}地域`;
    const evac = evacForLevel(item.level || 1);
    return `<span class="tag">【${item.category}】</span>${item.name}（${areaText}）　<span class="tag">【避難】</span>${evac.label}／${evac.action}`;
  });

  const head = state.headline
    ? `<span class="tag">【気象情報】</span>${state.headline}　`
    : `<span class="tag">【気象情報】</span>警報・注意報が発表されています　`;
  const office = state.publishingOffice ? `　出典：${state.publishingOffice}` : "";
  return `${head}${parts.join("　　／　　")}　　気象情報にご注意ください${office}　　`;
}

/** デモ用（舞鶴市）— 文言に必ず「デモ」を含め、本番と取り違えないようにする */
export function buildDemoWarnings() {
  return {
    items: [
      {
        code: "33",
        name: "【デモ】レベル５大雨特別警報",
        category: "特別警報",
        level: 5,
        short: "大雨特別（デモ）",
        hazard: "大雨",
        hasAlertLevel: true,
        areas: ["舞鶴市"],
        status: "発表",
        theme: "special",
      },
      {
        code: "51",
        name: "【デモ】レベル５氾濫特別警報",
        category: "特別警報",
        level: 5,
        short: "氾濫特別（デモ）",
        hazard: "河川氾濫",
        hasAlertLevel: true,
        areas: ["舞鶴市"],
        status: "発表",
        theme: "special",
      },
      {
        code: "49",
        name: "【デモ】レベル４土砂災害危険警報",
        category: "危険警報",
        level: 4,
        short: "土砂危険（デモ）",
        hazard: "土砂災害",
        hasAlertLevel: true,
        areas: ["舞鶴市"],
        status: "発表",
        theme: "danger",
      },
      {
        code: "48",
        name: "【デモ】レベル４高潮危険警報",
        category: "危険警報",
        level: 4,
        short: "高潮危険（デモ）",
        hazard: "高潮",
        hasAlertLevel: true,
        areas: ["舞鶴市"],
        status: "発表",
        theme: "danger",
      },
      {
        code: "03",
        name: "【デモ】レベル３大雨警報",
        category: "警報",
        level: 3,
        short: "大雨警報（デモ）",
        hazard: "大雨",
        hasAlertLevel: true,
        areas: ["舞鶴市"],
        status: "発表",
        theme: "warning",
      },
      {
        code: "14",
        name: "【デモ】雷注意報",
        category: "注意報",
        level: 2,
        short: "雷（デモ）",
        hazard: "雷",
        hasAlertLevel: false,
        areas: ["舞鶴市"],
        status: "発表",
        theme: "advisory",
      },
    ],
    headline:
      "【デモ】これはデモ表示です。本番の気象庁発表ではありません。舞鶴市にレベル５大雨特別警報・レベル５氾濫特別警報が発表されている想定です。",
    reportDatetime: new Date().toISOString(),
    publishingOffice: "デモ（本番の気象庁発表ではありません）",
  };
}

/**
 * リアル発表とデモを合流（同一コードはリアル優先）
 * @param {{ items: any[], headline?: string, reportDatetime?: string, publishingOffice?: string }} live
 * @param {{ items: any[], headline?: string, reportDatetime?: string, publishingOffice?: string }} demo
 */
export function mergeLiveAndDemo(live, demo) {
  const byCode = new Map();
  for (const item of demo.items || []) {
    byCode.set(item.code, {
      ...item,
      areas: [CONFIG.displayArea],
      source: "demo",
    });
  }
  for (const item of live.items || []) {
    byCode.set(item.code, {
      ...item,
      areas: [CONFIG.displayArea],
      source: "live",
    });
  }

  const items = [...byCode.values()].sort(
    (a, b) => b.level - a.level || a.name.localeCompare(b.name, "ja"),
  );

  const liveCount = (live.items || []).length;
  const headline =
    live.headline ||
    demo.headline ||
    (liveCount
      ? "舞鶴市に警報・注意報が発表されています。"
      : "【デモ表示】舞鶴市の警報・注意報サンプルを表示しています。");

  return {
    items,
    headline,
    reportDatetime: live.reportDatetime || demo.reportDatetime || new Date().toISOString(),
    publishingOffice: live.publishingOffice
      ? `${live.publishingOffice}${liveCount ? "" : "／デモ併記"}`
      : demo.publishingOffice || "京都地方気象台",
  };
}
