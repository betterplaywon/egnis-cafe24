/* ============================================================
 * page.js — 상세 페이지 공통 동작 (표시 전용)
 *  - 탭 전환/스크롤 이동
 *  - 모바일 옵션 바텀시트 열기/닫기
 *  - 무료배송 진행바 · "총 n세트 / 총 n원" 표시 동기화
 *    (금액 계산은 카페24 값을 "읽기만" 하며 어떤 구매 로직도 대체하지 않음)
 * 로드 순서: option_config.js → pick_option.js → page.js
 * ============================================================ */
(function () {
  'use strict';

  var FREE_SHIP_GOAL = 40000; // 무료배송 기준 금액(원). 몰 정책에 맞게 수정

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    /* ---------- 1. 탭 ---------- */
    var tabs = document.querySelectorAll('.pd-tabs__tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        var target = document.querySelector(tab.getAttribute('data-target') || '');
        if (target && typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    /* ---------- 2. 모바일 옵션 바텀시트 ---------- */
    var sheet = document.getElementById('pdOptionSheet');
    var dim = document.querySelector('.pd-sheet-dim');
    var buybar = document.querySelector('.pd-buybar');
    var isMobile = function () { return window.matchMedia('(max-width: 767px)').matches; };

    function openSheet() {
      if (!sheet || !isMobile()) return;
      sheet.classList.add('is-open');
      if (dim) dim.classList.add('is-open');
      if (buybar) buybar.classList.add('pd-buybar--sheet');
      document.body.classList.add('pd-sheet-lock');
    }
    function closeSheet() {
      if (!sheet) return;
      sheet.classList.remove('is-open');
      if (dim) dim.classList.remove('is-open');
      if (buybar) buybar.classList.remove('pd-buybar--sheet');
      document.body.classList.remove('pd-sheet-lock');
    }
    window.PDSheet = { open: openSheet, close: closeSheet };

    if (dim) dim.addEventListener('click', closeSheet);
    var handle = document.querySelector('.pd-sheet-handle');
    if (handle) handle.addEventListener('click', closeSheet);

    /* 모바일 하단 "바로 구매하기 / 장바구니"
     *  - 시트가 닫혀 있으면: 시트만 연다 (구매 진행 안 함)
     *  - 시트가 열려 있으면: data-proxy 로 지정한 "카페24 원본 버튼"을 대신 클릭한다.
     *    → 구매/장바구니 로직을 재구현하지 않고 카페24 기본 동작을 그대로 실행.
     *    (원본 버튼은 우측 패널에 있고 모바일에서는 화면에 없을 수 있으므로
     *     하단 구매바가 프록시 역할을 합니다) */
    document.querySelectorAll('[data-open-sheet]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        if (isMobile() && sheet && !sheet.classList.contains('is-open')) {
          e.preventDefault();
          e.stopPropagation();
          openSheet();
          return;
        }
        var sel = btn.getAttribute('data-proxy');
        if (!sel) return;
        var target = null;
        try { target = document.querySelector(sel); } catch (err) { /* ignore */ }
        if (!target) {
          console.warn('[page] data-proxy 대상을 찾지 못했습니다: ' + sel +
            ' — detail.html 의 카페24 구매 버튼에 pd-buy-main / pd-cart-main 클래스가 있는지 확인하세요.');
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        target.click();   /* 카페24 인라인 onclick 실행 */
      }, true);
    });
    window.addEventListener('resize', function () { if (!isMobile()) closeSheet(); });

    /* ---------- 3. 합계 / 무료배송 진행바 (표시 전용) ----------
     * 카페24 선택상품 목록에서 세트 수와 금액을 "읽어서" 표시만 갱신.
     * 스킨에 카페24 자체 합계 요소가 있다면 data-cafe24-total 로 지정해
     * 그 텍스트를 우선 사용합니다. */
    var CFG = window.PICK_OPTION_CONFIG || {};
    var rowsSel = (CFG.cafe24 && CFG.cafe24.productRows) || ['#totalProducts .option_products'];
    var container = null;
    for (var i = 0; i < rowsSel.length; i++) {
      try { container = document.querySelector(rowsSel[i]); } catch (e) {}
      if (container) break;
    }

    function parsePrice(text) {
      var m = String(text || '').replace(/[,\s]/g, '').match(/(\d{3,})원?/);
      return m ? parseInt(m[1], 10) : 0;
    }

    function updateSummary() {
      var setsEl = document.querySelector('[data-pd-total-sets]');
      var priceEl = document.querySelector('[data-pd-total-price]');
      var fill = document.querySelector('.pd-freeship__fill');
      var msg = document.querySelector('.pd-freeship__msg');
      if (!container) return;

      var rows = [].filter.call(
        container.querySelectorAll((CFG.cafe24 && CFG.cafe24.rowItem) || 'tr, li'),
        function (r) { return /개입/.test(r.textContent || ''); }
      );

      /* 카페24 합계 요소가 있으면 그 값을 신뢰 */
      var cafeTotal = document.querySelector('[data-cafe24-total]');
      var total = cafeTotal ? parsePrice(cafeTotal.textContent) : rows.reduce(function (sum, r) {
        var priceCell = r.querySelector('.price, [class*="price"]');
        var qtyInput = r.querySelector('input[type="number"], .po-stepper__value');
        var qty = qtyInput ? parseInt(qtyInput.value || qtyInput.textContent, 10) || 1 : 1;
        return sum + parsePrice(priceCell ? priceCell.textContent : '') * qty;
      }, 0);

      if (setsEl) setsEl.textContent = rows.length;
      if (priceEl) priceEl.textContent = total.toLocaleString('ko-KR');

      if (fill) fill.style.width = Math.min(100, (total / FREE_SHIP_GOAL) * 100) + '%';
      if (msg) {
        if (total >= FREE_SHIP_GOAL) {
          msg.classList.add('is-done');
          msg.innerHTML = '무료배송 혜택 적용!';
        } else {
          msg.classList.remove('is-done');
          msg.innerHTML = '<em>' + (FREE_SHIP_GOAL - total).toLocaleString('ko-KR') + '원</em> 더 담으면 <em>무료배송</em>';
        }
      }

      var selectedWrap = document.querySelector('.pd-selected');
      if (selectedWrap) selectedWrap.setAttribute('data-empty', rows.length === 0 ? 'true' : 'false');
    }

    if (container && window.MutationObserver) {
      new MutationObserver(updateSummary).observe(container, { childList: true, subtree: true, characterData: true });
    }
    document.addEventListener('input', function (e) {
      if (e.target && container && container.contains(e.target)) updateSummary();
    });
    updateSummary();
  });
})();
