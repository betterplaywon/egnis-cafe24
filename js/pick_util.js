/* ============================================================
 * pick_util.js — 공용 헬퍼
 * ------------------------------------------------------------
 * pick_option.js 와 page.js 에 각각 구현돼 있던 DOM 조회·문자열
 * 처리 헬퍼를 한 곳으로 모은 파일입니다. 여기에는 카페24 연동 로직도
 * 화면 로직도 넣지 않습니다 — 어디서든 쓰는 순수 헬퍼만 둡니다.
 *
 * ★ 로드 순서: option_config.js → pick_util.js → cafe24_bridge.js
 *              → pick_option.js → page.js
 *
 * 공개 API: PickOption.utils
 * ============================================================ */
(function () {
  'use strict';

  /* 전역은 window.PickOption 하나만 씁니다. 파일이 나뉘어도 네임스페이스는 1개. */
  var NS = (window.PickOption = window.PickOption || {});

  /* DOM 준비 후 실행 */
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* 후보 셀렉터 배열을 돌며 페이지에 존재하는 첫 번째 요소를 반환.
   * 스킨마다 DOM 이 달라 config 의 셀렉터는 전부 "후보 배열" 입니다.
   * 잘못된 셀렉터가 섞여 있어도 페이지를 깨뜨리지 않도록 예외를 삼킵니다. */
  function findFirst(candidates, ctx) {
    var list = Array.isArray(candidates) ? candidates : [candidates];
    for (var i = 0; i < list.length; i++) {
      try {
        var found = (ctx || document).querySelector(list[i]);
        if (found) return found;
      } catch (e) { /* 잘못된 셀렉터 무시 */ }
    }
    return null;
  }

  /* "{label} 맛 선택" 같은 문구의 {키} 를 map 값으로 치환 */
  function fmt(tpl, map) {
    return String(tpl).replace(/\{(\w+)\}/g, function (_, key) {
      return map[key] != null ? map[key] : '';
    });
  }

  /* 24700 → "24,700원" */
  function money(n) {
    return Number(n).toLocaleString('ko-KR') + '원';
  }

  /* "70,500원" → 70500 (금액이 없으면 0) */
  function parsePrice(text) {
    var m = String(text || '').replace(/[,\s]/g, '').match(/(\d{3,})원?/);
    return m ? parseInt(m[1], 10) : 0;
  }

  /* 요소 생성 단축 */
  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* className 은 SVG 에서 SVGAnimatedString 이라 문자열로 정규화해 씁니다. */
  function classOf(node) {
    var c = node && node.className;
    return String(c && c.baseVal != null ? c.baseVal : (c || ''));
  }

  NS.utils = {
    ready: ready,
    findFirst: findFirst,
    fmt: fmt,
    money: money,
    parsePrice: parsePrice,
    el: el,
    escapeHtml: escapeHtml,
    classOf: classOf
  };
})();
