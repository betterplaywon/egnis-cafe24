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
      var wasOpen = sheet.classList.contains('is-open');
      sheet.classList.remove('is-open');
      if (dim) { dim.classList.remove('is-open'); dim.hidden = true; }
      if (buybar) buybar.classList.remove('pd-buybar--sheet');
      document.body.classList.remove('pd-sheet-lock');
      /* 옵션 시트가 "실제로 열려 있던" 경우에만 그 위의 맛 선택 시트를 함께 정리합니다.
       * (맛 시트를 열어 둔 채 바깥 시트를 닫으면 po-lock 이 남아 본문 스크롤이 잠긴 채
       *  풀리지 않던 문제 방지) PC 는 이 시트를 열지 않아 wasOpen=false → 영향 없음.
       *  특히 resize 시 !isMobile 이면 closeSheet 가 호출되므로, 이 가드로 PC 인라인
       *  패널이 리사이즈만으로 닫히거나 선택이 초기화되지 않게 합니다. */
      if (wasOpen && window.PickOption && typeof window.PickOption.reset === 'function') {
        window.PickOption.reset();
      }
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

      /* 총 상품금액 = 카페24가 각 선택상품 행에 렌더한 "가격" 셀의 합.
       * 금액을 우리가 계산하지 않고, 카페24가 표시한 행 가격을 그대로 더합니다.
       * 카페24 기본 스킨의 행 가격 셀은 클래스 없는 <td class="right"> 첫 <span>이고
       * (custom_detail.css 도 동일 셀을 가격으로 스타일), 그 옆 .mileage(적립금)만
       * 클래스를 가집니다. 그래서 첫 span 을 가격으로 읽고 .mileage 는 제외합니다.
       * (행 가격은 이미 해당 행 수량이 반영된 값이므로 수량을 다시 곱하지 않습니다.) */
      var rowsTotal = rows.reduce(function (sum, r) {
        var priceCell = r.querySelector('td.right > span:not(.mileage)') ||
          r.querySelector('.right span:not(.mileage)');
        return sum + parsePrice(priceCell ? priceCell.textContent : '');
      }, 0);

      /* 카페24 자체 합계 요소가 "실제로 채워져 있으면"(0 이 아니면) 그 값을 신뢰.
       * 독립 선택형+추가금액 구성에서는 이 요소가 비어 있을(0) 수 있어, 그때는
       * 위 행 가격 합계로 폴백합니다. (요소 존재만으로 신뢰하면 항상 0 이 됩니다.) */
      var cafeTotal = document.querySelector('[data-cafe24-total]');
      var cafeVal = cafeTotal ? parsePrice(cafeTotal.textContent) : 0;
      var total = cafeVal > 0 ? cafeVal : rowsTotal;

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
