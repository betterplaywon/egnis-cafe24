/* ============================================================
 * page.js — 상세 페이지 공통 동작 (표시 전용)
 *  - 모바일 옵션 바텀시트 열기/닫기
 *  - 무료배송 진행바 · "총 n세트 / 총 n원" 표시 동기화
 *    (금액 계산은 카페24 값을 "읽기만" 하며 어떤 구매 로직도 대체하지 않음)
 * 로드 순서: option_config.js → pick_util.js → cafe24_bridge.js
 *            → pick_option.js → page.js
 * ============================================================ */
(function () {
  'use strict';

  var U = window.PickOption && window.PickOption.utils;
  if (!U) {
    console.error('[page] pick_util.js 가 먼저 로드되어야 합니다.');
    return;
  }

  /* 무료배송 기준 금액은 option_config.js 의 freeShipGoal 을 사용합니다.
   * (값=설정 / 동작=로직 경계. config 미로드 시에만 폴백 40000) */
  var FREE_SHIP_GOAL = (window.PICK_OPTION_CONFIG && window.PICK_OPTION_CONFIG.freeShipGoal) || 40000;

  U.ready(function () {
    /* ---------- 1. 모바일 옵션 바텀시트 ---------- */
    var sheet = document.getElementById('pdOptionSheet');
    var dim = document.querySelector('.pd-sheet-dim');
    var buybar = document.querySelector('.pd-buybar');
    var isMobile = function () { return window.matchMedia('(max-width: 767px)').matches; };

    function openSheet() {
      if (!sheet || !isMobile()) return;
      sheet.classList.add('is-open');
      /* 딤은 hidden 속성으로도 막혀 있으므로 클래스와 함께 해제합니다. */
      if (dim) { dim.hidden = false; dim.classList.add('is-open'); }
      if (buybar) buybar.classList.add('pd-buybar--sheet');
      document.body.classList.add('pd-sheet-lock');
    }
    function closeSheet() {
      if (!sheet) return;
      sheet.classList.remove('is-open');
      if (dim) { dim.classList.remove('is-open'); dim.hidden = true; }
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

    /* ---------- 2. 합계 / 무료배송 진행바 (표시 전용) ----------
     * 카페24 선택상품 목록에서 세트 수와 금액을 "읽어서" 표시만 갱신.
     * 스킨에 카페24 자체 합계 요소가 있다면 data-cafe24-total 로 지정해
     * 그 텍스트를 우선 사용합니다. */
    var CFG = window.PICK_OPTION_CONFIG || {};
    var rowsSel = (CFG.cafe24 && CFG.cafe24.productRows) || ['#totalProducts .option_products'];
    var container = U.findFirst(rowsSel);
    var parsePrice = U.parsePrice;

    /* 행 목록은 pick_option(브릿지)의 판별 규칙을 우선 사용해 규칙을 단일화합니다.
     * pick_option 이 초기화되지 않은 경우에만 컨테이너 직접 조회로 폴백합니다. */
    function getRows() {
      var PO = window.PickOption;
      if (PO && typeof PO.rows === 'function') return PO.rows();
      if (!container) return [];
      return [].filter.call(
        container.querySelectorAll((CFG.cafe24 && CFG.cafe24.rowItem) || 'tr, li'),
        function (r) { return /개입/.test(r.textContent || ''); }
      );
    }

    function updateSummary() {
      var setsEl = document.querySelector('[data-pd-total-sets]');
      var priceEl = document.querySelector('[data-pd-total-price]');
      var fill = document.querySelector('.pd-freeship__fill');
      var msg = document.querySelector('.pd-freeship__msg');

      var rows = getRows();

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
