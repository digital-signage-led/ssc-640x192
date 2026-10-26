export const CONFIG = {
  /** 京都府（府県予報区）— JSON 取得用 */
  areaCode: "260000",
  areaLabel: "京都府",
  /**
   * 表示対象の市区町村（二次細分）
   * 気象庁: https://www.jma.go.jp/bosai/#pattern=default&area_type=class20s&area_code=2620200
   */
  targetAreaCode: "2620200",
  /** サイネージ上の地域表示 */
  displayArea: "舞鶴市",
  /** 警報ポーリング間隔（ミリ秒）※ライブ固定モード用 */
  pollIntervalMs: 60_000,
  /** 地震情報の確認間隔。発表後すぐに出す */
  quakePollMs: 10_000,
  /** 舞鶴市を含む地震情報を出しておく時間 */
  quakeShowMs: 3 * 60 * 60 * 1000,
  /** 震度の市区町村コード（舞鶴市） */
  quakeCityCode: "2620200",
  /** デモ（?demo=1） / ライブのみ（?live=1） / 地震デモ（?quake=1） */
  demoQuery: "demo",
  /**
   * 既定は気象庁の発表中だけ表示。
   * デモ周回は ?playlist=1 / ?demo=1 / ?quake=1 のときだけ。
   */
  playlistByDefault: false,
  /** 本番（ライブ）表示時間（ミリ秒） */
  livePhaseMs: 10_000,
  /** 警報デモ：テロップ1周。ただし上限を超えない */
  demoPhaseMaxMs: 18_000,
  /** 地震デモ：各震度シーンの表示時間（ミリ秒） */
  quakeSceneMs: 2_500,
  /** コンテンツ切替時の静止（ミリ秒） */
  phaseGapMs: 1_000,
  /** サイネージ: 物理ピクセル640×192に合わせる */
  signagePixelLock: true,
  /** 発表中として扱う status */
  activeStatuses: new Set(["発表", "継続", "警報から注意報", "注意報から警報"]),
  /** 流れ文字の速さ（px/秒） */
  marqueeSpeedPxPerSec: 78,
  /** 発表中チップは1件でも流す（発表中の情報カード内） */
  chipScrollMinCount: 1,
  /** 発表なしテロップ */
  idleMarqueeText:
    "現在、舞鶴市では警報・注意報は発表されていません　　気象情報をご確認ください　　",
};
