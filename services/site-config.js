/**
 * 案件設定の読込（sites/AC-XXXX.json → SignageConfig）
 * 同期読込。後続スクリプトより前に置く。
 * ?site=AC-0002 / ?site=0002 / ?project= / ?ac=
 */
(function (global) {
  'use strict';

  var SITE_RE = /^AC-[0-9]{4}$/;
  var GAS = 'https://script.google.com/macros/s/AKfycbzSTsappgfJTaJruOBJsbnCXSTPkeTBp39CXpvoSZsPQ0mWGs4KjSonC8_eZ2b1EeUXTQ/exec';

  function sitesBase() {
    var src = (document.currentScript && document.currentScript.src) || '';
    if (!src) return './sites/';
    return new URL('../sites/', src).href;
  }

  function loadJson(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    try { xhr.send(null); } catch (e) { throw e; }
    if (xhr.status && xhr.status !== 200) throw new Error('HTTP ' + xhr.status + ' ' + url);
    if (!xhr.responseText) throw new Error('empty ' + url);
    return JSON.parse(xhr.responseText);
  }

  function resolveSiteId(catalog) {
    var raw = '';
    try {
      var q = new URLSearchParams(global.location.search);
      raw = q.get('site') || q.get('project') || q.get('ac') || '';
    } catch (e) {}
    var id = String(raw || '').trim().toUpperCase();
    if (/^[0-9]{4}$/.test(id)) id = 'AC-' + id;
    if (SITE_RE.test(id)) return { siteId: id, source: 'query' };
    var fallback = (catalog && catalog.defaultSite) || 'AC-0002';
    return { siteId: fallback, source: raw ? 'invalid-fallback' : 'default' };
  }

  function withVer(src, ver) {
    if (!src) return '';
    if (String(src).indexOf('?') >= 0) return src;
    return src + '?v=' + ver;
  }

  function apply(site) {
    var logo = site.logo || {};
    var moe = site.moe || {};
    var jma = site.jma || {};
    var ui = site.ui || {};
    var ver = site.releasePin || '2026.10.16.02';
    global.SignageConfig = {
      projectId: site.projectId,
      status: site.status || 'active',
      site: {
        customer: site.customer || '',
        rental: site.rental || site.customer || '',
        label: site.siteName || site.customer || '',
        address: site.location || '',
        locationLabel: site.siteName || ''
      },
      moe: {
        gasUrl: moe.gasUrl || GAS,
        point: moe.point || '',
        fallbackPoint: moe.fallbackPoint || '',
        pointName: moe.pointName || '',
        alertArea: moe.alertArea || '',
        region: moe.region || '',
        prefecture: moe.prefecture || ''
      },
      jma: {
        amedasPoint: jma.amedasPoint || '',
        amedasSupplementPoint: jma.amedasSupplementPoint || jma.amedasPoint || '',
        forecastArea: jma.forecastArea || '',
        forecastWeatherArea: jma.forecastWeatherArea || jma.forecastArea || '',
        forecastLabel: jma.forecastLabel || site.siteName || '',
        warnArea: jma.warnArea || '',
        warnCity: jma.warnCity || '',
        warnCityLabel: jma.warnCityLabel || site.siteName || ''
      },
      geo: { lat: Number(site.latitude), lon: Number(site.longitude) },
      timeZone: site.timeZone || 'Asia/Tokyo',
      refreshMs: (site.updateSettings && site.updateSettings.refreshMs) || 60000,
      footSource: site.footSource || 'データ提供：気象庁、環境省',
      ui: ui
    };
    var textSrc = logo.textSrc || logo.src || '';
    var markSrc = logo.markSrc || logo.src || '';
    global.SIGNAGE_CONFIG = {
      logoSrc: withVer(textSrc, ver),
      logoAlt: logo.alt || site.customer || site.siteName || '',
      logoPanelBg: logo.panelBg || '#FFFFFF',
      logoCorpSrc: '',
      footLogoSrc: withVer(markSrc, ver),
      footBannerSrc: withVer(logo.bannerSrc || textSrc, ver),
      sideHdrLogoSrc: withVer(textSrc, ver),
      weatherLogoSrc: withVer(markSrc, ver),
      weatherLogoAlt: logo.alt || site.customer || site.siteName || ''
    };
    global.AlertCubeSite = { siteId: site.projectId, status: site.status || 'active' };
    try {
      var name = site.siteName || site.projectName || site.projectId;
      if (name && global.document) global.document.title = name + ' 自販機 640×192 · ' + site.projectId;
    } catch (e) {}
  }

  var base = sitesBase();
  var catalog = null;
  try { catalog = loadJson(base + 'index.json'); } catch (e) { catalog = null; }
  global.SiteCatalog = catalog;
  var resolved = resolveSiteId(catalog);
  var site = null;
  try {
    site = loadJson(base + resolved.siteId + '.json');
  } catch (e1) {
    if (resolved.siteId !== 'AC-0000') {
      try { site = loadJson(base + 'AC-0000.json'); resolved = { siteId: 'AC-0000', source: 'template-fallback' }; } catch (e2) {}
    }
  }
  if (!site) throw new Error('site config missing: ' + resolved.siteId);
  apply(site);
})(typeof window !== 'undefined' ? window : this);
