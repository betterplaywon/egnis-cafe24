/* ============================================================
 * pick_option.js — 골라담기 옵션 UI (카페24 연동)
 * ------------------------------------------------------------
 * - 카페24 기본 옵션(select)을 "그대로" 사용합니다.
 *   카드 UI 는 select 값을 바꾸고 change 이벤트를 발생시킬 뿐,
 *   선택상품 목록 생성/수량/금액/장바구니/구매는 모두 카페24 기본
 *   로직이 처리합니다. (재구현 없음)
 * - 옵션값 suffix(_1, _2) 로 개입수별 담기 횟수를 제한합니다.
 * - 설정은 전부 option_config.js (window.PICK_OPTION_CONFIG)
 *
 * 공개 API
 *   PickOption.getState()  // { qty10: {label,used,max}, ... }
 *   PickOption.rescan()    // 선택상품 목록 강제 재동기화
 *   PickOption.open(key)   // 특정 개입수 맛선택 패널 열기
 *   PickOption.reset()     // 카드/패널 선택 상태 초기화 (목록은 유지)
 * ============================================================ */
(function () {
  'use strict';

  var TAG = '[pick-option]';
  var CFG = window.PICK_OPTION_CONFIG;
  var U = window.PickOption && window.PickOption.utils;
  var BRIDGE = window.PickOption && window.PickOption.bridge;

  /* ---------- 0. 부트 가드 ---------- */
  if (!CFG) {
    console.error(TAG + ' option_config.js 가 먼저 로드되어야 합니다.');
    return;
  }
  if (!U || !BRIDGE) {
    console.error(TAG + ' pick_util.js / cafe24_bridge.js 가 먼저 로드되어야 합니다. ' +
      '로드 순서: option_config.js → pick_util.js → cafe24_bridge.js → pick_option.js → page.js');
    return;
  }
  function boot() {
    var root = document.getElementById('pickOptionRoot');
    if (!root) {
      console.error(TAG + ' #pickOptionRoot 컨테이너가 없습니다.');
      return;
    }
    init(root);
  }
  U.ready(boot);

  /* ---------- 유틸 (공용 헬퍼는 pick_util.js) ---------- */
  var fmt = U.fmt;
  var money = U.money;
  var el = U.el;
  var escapeHtml = U.escapeHtml;

  function log() {
    if (CFG.debug) console.log.apply(console, [TAG].concat([].slice.call(arguments)));
  }

  /* ============================================================
   * INIT
   * ============================================================ */
  function init(root) {
    var state = {
      selectedKey: null,          // 현재 선택된 개입수 카드 key
      flavorQty: {},              // { flavorId: 스테퍼값 }
      used: {},                   // { key: 사용된 suffix 값 Set }
      busy: false,                // 담기 처리 중 (연타 방지)
      isMobile: window.innerWidth < (CFG.mobile.breakpoint || 768)
    };
    CFG.counts.forEach(function (c) { state.used[c.key] = []; });

    /* ============================================================
     * 카페24 연동 — 옵션값 파싱·컨트롤 탐지·행 관측은 전부 브릿지가 담당.
     * 이 파일은 상태(state)와 렌더링만 책임집니다.
     * ============================================================ */
    var bridge = BRIDGE.create(CFG, { root: root });
    var LABELS = bridge.labels();

    if (bridge.mode() === 'none') {
      console.warn(TAG + ' 카페24 옵션 컨트롤을 찾지 못했습니다. 다음을 확인하세요.\n' +
        '  1) 상세페이지에 카페24 기본 옵션 영역(.xans-product-option / 텍스트버튼 목록)이 실제로 존재하는지\n' +
        '     — 스킨 템플릿에서 해당 모듈 블록이 누락되면 UI 는 떠도 담기가 동작하지 않습니다.\n' +
        '  2) 관리자 옵션값이 "' + (LABELS[0] || '10개입') + '_1" 형태(suffix 포함)로 등록되어 있는지\n' +
        '  3) option_config.js 의 counts[].label 이 옵션값의 suffix 앞부분과 일치하는지\n' +
        '  콘솔에서 PickOption.diagnose() 를 실행하면 현재 탐지 상태를 확인할 수 있습니다.');
    } else {
      log('옵션 컨트롤 확정 — 표시방식:', bridge.mode(), bridge.optionValues());
    }
    if (!bridge.container()) {
      log('선택상품 목록 컨테이너 미발견 — 첫 담기 시 자동 학습합니다.');
    }

    /* ============================================================
     * RENDER — 카드 목록
     * ============================================================ */
    function cardByKey(key) {
      return CFG.counts.filter(function (c) { return c.key === key; })[0] || null;
    }
    /* 개입수 카드 하나의 마크업 (반복 조립을 헬퍼로 통일) */
    function renderCard(c) {
      var li = el('li', 'po-card');
      li.dataset.key = c.key;
      var badgeHtml = c.badge
        ? '<span class="po-card__badge po-card__badge--' + c.badge.type + '">' + escapeHtml(c.badge.text) + '</span>'
        : '';
      li.innerHTML =
        '<button type="button" class="po-card__btn" role="radio" aria-checked="false">' +
        '  <span class="po-card__radio" aria-hidden="true"></span>' +
        '  <span class="po-card__label">' + escapeHtml(c.label) + '</span>' +
        '  <span class="po-card__info">' +
        '    <span class="po-card__priceline">' +
        '      <strong class="po-card__price">' + money(c.price) + '</strong>' +
        '      <span class="po-card__discount">(' + escapeHtml(c.discount) + ')</span>' +
             badgeHtml +
        '    </span>' +
        '    <span class="po-card__unit">' + escapeHtml(c.unitPrice) + '</span>' +
        '  </span>' +
        '</button>';
      return li;
    }

    root.classList.add('po');
    root.innerHTML = '';

    var section = el('div', 'po__section');
    var head = el('button', 'po__head', '<span>' + escapeHtml(CFG.texts.sectionTitle) + '</span><i class="po__chev" aria-hidden="true"></i>');
    head.type = 'button';
    head.setAttribute('aria-expanded', 'true');
    var body = el('div', 'po__body');
    head.addEventListener('click', function () {
      var open = section.classList.toggle('is-collapsed') === false;
      head.setAttribute('aria-expanded', String(open));
    });
    section.appendChild(head);
    section.appendChild(body);

    var cardList = el('ul', 'po__cards');
    cardList.setAttribute('role', 'radiogroup');
    body.appendChild(cardList);

    var cardEls = {};
    CFG.counts.forEach(function (c) {
      var li = renderCard(c);
      cardList.appendChild(li);
      cardEls[c.key] = li;
    });
    /* 이벤트 위임: 카드마다 리스너를 붙이지 않고 목록에 한 번만 (config 규칙) */
    cardList.addEventListener('click', function (e) {
      var li = e.target.closest ? e.target.closest('.po-card') : null;
      if (!li || !cardList.contains(li)) return;
      var cfg = cardByKey(li.dataset.key);
      if (cfg) onCardClick(cfg);
    });

    /* ============================================================
     * RENDER — 맛 선택 패널 (PC: 인라인 / MO: 바텀시트 옵션)
     * ============================================================ */
    var panelWrap = el('div', 'po-panel');           // 패널 컨테이너
    var overlay = el('div', 'po-overlay');           // 모바일 시트용 딤
    panelWrap.hidden = true;
    overlay.hidden = true;
    body.appendChild(panelWrap);
    root.appendChild(overlay);
    document.documentElement.style.setProperty('--po-bottom-offset', (CFG.mobile.bottomOffset || 0) + 'px');

    overlay.addEventListener('click', closePanel);

    /* 딤 표시 — hidden 속성과 .is-open 클래스를 함께 토글합니다.
     * 스킨 CSS 가 hidden 을 덮어써도 클래스가 없으면 화면을 가리지 않습니다. */
    function setOverlay(show) {
      overlay.hidden = !show;
      overlay.classList.toggle('is-open', !!show);
    }

    function useSheet() {
      state.isMobile = window.innerWidth < (CFG.mobile.breakpoint || 768);
      return state.isMobile && CFG.mobile.mode === 'sheet';
    }
    window.addEventListener('resize', function () {
      var asSheet = useSheet() && !panelWrap.hidden;
      panelWrap.classList.toggle('po-panel--sheet', asSheet);
      setOverlay(asSheet);
      /* 시트 모드가 아니게 되면 body 스크롤 잠금도 반드시 함께 해제 (QA 9) */
      document.body.classList.toggle('po-lock', asSheet);
    });

    /* 패널 = 헤드 + 맛 목록 + 푸터. 각 부분을 렌더 헬퍼로 나눠 조립합니다. */
    function buildPanel(countCfg) {
      panelWrap.innerHTML = '';
      var sheet = useSheet();
      panelWrap.classList.toggle('po-panel--sheet', sheet);
      panelWrap.appendChild(renderPanelHead(countCfg, sheet));
      panelWrap.appendChild(renderFlavorList(countCfg));
      panelWrap.appendChild(renderPanelFoot(countCfg));
      updatePanel(countCfg);
    }

    function renderPanelHead(countCfg, sheet) {
      var head = el('div', 'po-panel__head',
        (sheet ? '<span class="po-panel__grab" aria-hidden="true"></span>' : '') +
        '<strong class="po-panel__title">' + escapeHtml(fmt(CFG.texts.flavorTitle, { label: countCfg.label })) + '</strong>' +
        '<button type="button" class="po-panel__close" aria-label="닫기">&times;</button>');
      head.querySelector('.po-panel__close').addEventListener('click', closePanel);
      return head;
    }

    /* 맛 항목 하나의 마크업 (반복 조립을 헬퍼로 통일) */
    function renderFlavor(f) {
      var li = el('li', 'po-flavor' + (f.soldOut ? ' is-soldout' : ''));
      li.dataset.flavor = f.id;
      li.innerHTML =
        '<span class="po-flavor__thumb">' +
        (f.img ? '<img src="' + escapeHtml(f.img) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
        (f.soldOut ? '<span class="po-flavor__soldout">' + escapeHtml(CFG.texts.soldOutBadge) + '</span>' : '') +
        '</span>' +
        '<span class="po-flavor__info">' +
        (f.badge ? '<em class="po-flavor__badge">' + escapeHtml(f.badge) + '</em>' : '') +
        '  <strong class="po-flavor__name">' + escapeHtml(f.name) + '</strong>' +
        '  <span class="po-flavor__meta">' + escapeHtml(f.meta || '') + '</span>' +
        '</span>' +
        '<span class="po-stepper">' +
        '  <button type="button" class="po-stepper__btn po-stepper__btn--minus" data-step="-1" aria-label="빼기"' + (f.soldOut ? ' disabled' : '') + '>&minus;</button>' +
        '  <span class="po-stepper__value" aria-live="polite">0</span>' +
        '  <button type="button" class="po-stepper__btn po-stepper__btn--plus" data-step="1" aria-label="더하기"' + (f.soldOut ? ' disabled' : '') + '>+</button>' +
        '</span>';
      return li;
    }

    function renderFlavorList(countCfg) {
      var list = el('ul', 'po-flavors');
      CFG.flavors.forEach(function (f) { list.appendChild(renderFlavor(f)); });
      /* 이벤트 위임: 맛마다 리스너 2개를 붙이지 않고 목록에 한 번만 (config 규칙) */
      list.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.po-stepper__btn') : null;
        if (!btn || btn.disabled) return;
        var li = btn.closest('.po-flavor');
        if (!li || li.classList.contains('is-soldout')) return;
        step(li.dataset.flavor, parseInt(btn.dataset.step, 10) || 0, countCfg);
      });
      return list;
    }

    function renderPanelFoot(countCfg) {
      var foot = el('div', 'po-panel__foot');
      foot.innerHTML =
        '<div class="po-panel__tooltip" hidden></div>' +
        '<div class="po-panel__total">' +
        '  <span>' + escapeHtml(CFG.texts.totalLabel) + '</span>' +
        '  <strong class="po-panel__counter"></strong>' +
        '</div>' +
        '<button type="button" class="po-panel__complete" disabled>' + escapeHtml(CFG.texts.completeBtn) + '</button>';
      foot.querySelector('.po-panel__complete').addEventListener('click', function () {
        onComplete(countCfg);
      });
      return foot;
    }

    function selectedTotal(countCfg) {
      var unit = CFG.unitSize || 1;
      var sum = 0;
      Object.keys(state.flavorQty).forEach(function (id) { sum += state.flavorQty[id] * unit; });
      return sum;
    }

    function step(flavorId, dir, countCfg) {
      var unit = CFG.unitSize || 1;
      var cur = state.flavorQty[flavorId] || 0;
      var total = selectedTotal(countCfg);
      if (dir > 0 && total + unit > countCfg.count) {
        showTooltip(countCfg); // 초과 시 안내만
        return;
      }
      var next = Math.max(0, cur + dir);
      state.flavorQty[flavorId] = next;
      updatePanel(countCfg);
    }

    function updatePanel(countCfg) {
      var total = selectedTotal(countCfg);
      var counter = panelWrap.querySelector('.po-panel__counter');
      var complete = panelWrap.querySelector('.po-panel__complete');
      if (counter) counter.textContent = fmt(CFG.texts.totalCounter, { selected: total, count: countCfg.count });
      if (complete) complete.disabled = (total !== countCfg.count) || state.busy;
      panelWrap.querySelectorAll('.po-flavor').forEach(function (li) {
        var v = state.flavorQty[li.dataset.flavor] || 0;
        var valEl = li.querySelector('.po-stepper__value');
        if (valEl) valEl.textContent = v;
        li.classList.toggle('is-picked', v > 0);
        var minus = li.querySelector('.po-stepper__btn--minus');
        if (minus && !li.classList.contains('is-soldout')) minus.disabled = v === 0;
      });
      hideTooltip();
    }

    var tooltipTimer = null;
    function showTooltip(countCfg) {
      var tip = panelWrap.querySelector('.po-panel__tooltip');
      if (!tip) return;
      var total = selectedTotal(countCfg);
      tip.innerHTML = fmt(CFG.texts.tooltipRemain, {
        selected: total,
        remain: Math.max(0, countCfg.count - total)
      });
      tip.hidden = false;
      clearTimeout(tooltipTimer);
      tooltipTimer = setTimeout(hideTooltip, 2500);
    }
    function hideTooltip() {
      var tip = panelWrap.querySelector('.po-panel__tooltip');
      if (tip) tip.hidden = true;
      clearTimeout(tooltipTimer);
    }

    function openPanel(countCfg) {
      state.selectedKey = countCfg.key;
      state.flavorQty = {};
      Object.keys(cardEls).forEach(function (k) {
        var active = k === countCfg.key;
        cardEls[k].classList.toggle('is-active', active);
        cardEls[k].querySelector('.po-card__btn').setAttribute('aria-checked', String(active));
      });
      buildPanel(countCfg);
      panelWrap.hidden = false;
      var sheet = useSheet();
      setOverlay(sheet);
      if (sheet) document.body.classList.add('po-lock');
    }
    function closePanel() {
      panelWrap.hidden = true;
      setOverlay(false);
      document.body.classList.remove('po-lock');
    }

    function onCardClick(countCfg) {
      if (cardEls[countCfg.key].classList.contains('is-maxed')) {
        /* "소진"과 "옵션값 미등록"은 원인이 다르므로 안내를 구분합니다. */
        if (!(state.used[countCfg.key] || []).length) {
          toast(fmt(CFG.texts.toastSoldOut || '{label}은(는) 현재 선택할 수 없어요',
            { label: countCfg.label }), 'warn');
          console.warn(TAG + ' "' + countCfg.label + '" 의 선택 가능한 옵션값이 없습니다. ' +
            '관리자에 "' + countCfg.label + '_1" 형태의 옵션값이 등록·판매중인지 확인하세요.');
        } else {
          toast(fmt(CFG.texts.toastMaxed, { label: countCfg.label, max: countCfg.maxAdd }), 'warn');
        }
        return;
      }
      openPanel(countCfg);
    }

    /* ============================================================
     * 담기 (선택완료) — 카페24 select 값 변경으로 위임
     * ============================================================ */
    /* 아직 담지 않은 suffix 옵션값 1개를 고른다 (없으면 null = 소진) */
    function nextAvailableEntry(countCfg) {
      var candidates = bridge.optionValues()[countCfg.label] || [];
      var used = state.used[countCfg.key] || [];
      for (var i = 0; i < candidates.length; i++) {
        var c = candidates[i];
        if (c.disabled) continue;
        if (used.indexOf(c.value) === -1) return c;
      }
      return null;
    }

    function flavorSummary() {
      var parts = [];
      CFG.flavors.forEach(function (f) {
        var v = state.flavorQty[f.id] || 0;
        if (v > 0) parts.push(f.name + '*' + v);
      });
      return parts.join(' + ');
    }

    /* 담기 = 검증 → 옵션값 선택(카페24 위임) → 행 생성 확인(폴링) → 마무리.
     * 세 단계를 pickEntry / applyAndWait / finishAdd 로 나눕니다. */
    function onComplete(countCfg) {
      if (state.busy) return;
      if (selectedTotal(countCfg) !== countCfg.count) { showTooltip(countCfg); return; }
      /* 담기 직전 재탐지 — 카페24가 옵션 UI 를 다시 그렸을 수 있고,
       * 다른 경로로 행이 추가/삭제됐을 수도 있습니다. */
      bridge.refresh();
      rescan();

      var entry = pickEntry(countCfg);
      if (!entry) return;   /* 안내 토스트는 pickEntry 내부에서 처리 */

      state.busy = true;
      var completeBtn = panelWrap.querySelector('.po-panel__complete');
      if (completeBtn) completeBtn.disabled = true;

      var summary = flavorSummary();
      var beforeRows = bridge.rows().length;

      /* ★ 카페24 기본 로직 위임 지점:
       * 텍스트버튼형 → 해당 버튼 클릭 (카페24가 버튼 선택 상태까지 갱신)
       * 셀렉트형     → select 값 변경 + change 트리거
       * 이후 선택상품 행 생성·수량·금액 계산은 전부 카페24가 처리합니다. */
      try {
        bridge.apply(entry);
      } catch (err) {
        /* 카페24 핸들러가 예외를 던져도 busy 가 영구 잠기지 않도록 */
        console.warn(TAG + ' 옵션 적용 중 오류', err);
        state.busy = false;
        if (completeBtn) completeBtn.disabled = false;
        toast('옵션을 담는 중 오류가 발생했습니다.', 'warn');
        return;
      }

      applyAndWait(entry.value, beforeRows, function (newRow) {
        finishAdd(newRow, entry.value, countCfg, summary);
      });
    }

    /* 담을 옵션값 1개 결정. 연동 미탐지/소진이면 안내 토스트 후 null 반환. */
    function pickEntry(countCfg) {
      if (!Object.keys(bridge.optionValues()).length) {
        toast('옵션 연동을 찾지 못했습니다. 관리자 옵션값 등록을 확인해 주세요.', 'warn');
        console.warn(TAG + ' 담기 실패: 카페24 옵션 컨트롤 미탐지. ' +
          'PickOption.diagnose() 로 상세 상태를 확인하세요. ' +
          '(옵션값 "' + countCfg.label + '_1" 등록 여부 / 기본 옵션 영역 존재 여부)');
        return null;
      }
      var entry = nextAvailableEntry(countCfg);
      if (entry == null) {
        markMaxed();
        toast(fmt(CFG.texts.toastMaxed, { label: countCfg.label, max: countCfg.maxAdd }), 'warn');
        return null;
      }
      return entry;
    }

    /* 행 추가 확인 (최대 1.5초 폴링) 후 done(newRow|null) 호출.
     * 개수 증가가 아니라 "해당 옵션값이 담긴 행"을 직접 찾습니다 —
     * 목록이 위로 쌓이는 스킨/합계행이 있는 스킨에서도 정확합니다. */
    function applyAndWait(value, beforeRows, done) {
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        bridge.learn();                /* 목록이 이제 막 생겼을 수 있으므로 매번 재확인 */
        var rows = bridge.rows();
        var newRow = bridge.findRow(value) ||
          (rows.length > beforeRows ? rows[rows.length - 1] : null);
        if (newRow || tries > 15) {
          clearInterval(timer);
          done(newRow || null);
        }
      }, 100);
    }

    /* 담기 마무리 — 행 표시 정리·추가입력 기록·토스트·상태 복귀 */
    function finishAdd(newRow, value, countCfg, summary) {
      if (newRow) {
        bridge.tagRow(newRow, value, countCfg.label, countCfg.key, summary);
        bridge.writeExtra(newRow, summary);
        toast(CFG.texts.toastAdded, 'ok');
      } else {
        console.warn(TAG + ' 선택상품 행 추가를 감지하지 못했습니다. ' +
          'PickOption.diagnose() 로 목록 컨테이너 탐지 상태와 옵션값(' + value + ') 등록 여부를 확인하세요.');
        toast('상품을 담지 못했습니다. 옵션 설정을 확인해 주세요.', 'warn');
      }
      rescan();
      state.busy = false;
      closePanel();
      resetCards();
    }

    function resetCards() {
      state.selectedKey = null;
      state.flavorQty = {};
      Object.keys(cardEls).forEach(function (k) {
        cardEls[k].classList.remove('is-active');
        cardEls[k].querySelector('.po-card__btn').setAttribute('aria-checked', 'false');
      });
    }

    /* ============================================================
     * RESCAN — 선택상품 목록 ↔ 카드 상태 동기화
     * (행 조회·표시 정리·추가입력은 브릿지가 담당)
     * ============================================================ */
    function rescan() {
      CFG.counts.forEach(function (c) { state.used[c.key] = []; });
      bridge.rows().forEach(function (row) {
        var value = bridge.rowValue(row);
        if (!value) return;
        var base = value.replace(/_\d+$/, '');
        CFG.counts.forEach(function (c) {
          if (c.label === base && state.used[c.key].indexOf(value) === -1) {
            state.used[c.key].push(value);
          }
        });
      });
      markMaxed();
      log('rescan', getState());
    }

    function markMaxed() {
      /* 옵션 연동 자체가 안 잡힌 상태에서는 카드를 잠그지 않습니다.
       * (전부 반투명해지면 원인이 "소진"인지 "연동 실패"인지 알 수 없음 —
       *  클릭 시 진단 토스트가 뜨도록 열어 둡니다) */
      var map = bridge.optionValues();
      var noIntegration = !Object.keys(map).length;
      CFG.counts.forEach(function (c) {
        var available = (map[c.label] || []).filter(function (v) { return !v.disabled; }).length;
        /* 실제 담을 수 있는 횟수 = 등록된 suffix 개수와 config maxAdd 중 작은 값.
         * 옵션값이 아예 없으면(available 0) 담을 수 없으므로 소진 처리합니다. */
        var max = noIntegration ? c.maxAdd : Math.min(c.maxAdd, available);
        var maxed = (state.used[c.key] || []).length >= max;
        var btn = cardEls[c.key].querySelector('.po-card__btn');
        cardEls[c.key].classList.toggle('is-maxed', maxed);
        if (maxed) btn.setAttribute('aria-disabled', 'true');
        else btn.removeAttribute('aria-disabled');
      });
    }

    /* 선택상품 목록 변화 → 카드 상태 재동기화 (컨테이너 학습 시 자동 재관측) */
    bridge.onRowsChange(rescan);
    rescan();

    /* 구매 버튼 가드 — 미선택 시 토스트 (카페24 검증 로직은 유지) */
    bridge.guardBuyButtons(function () { toast(CFG.texts.toastNeedOption, 'warn'); });

    /* ============================================================
     * TOAST
     * ============================================================ */
    var toastEl = el('div', 'po-toast');
    toastEl.hidden = true;
    document.body.appendChild(toastEl);
    var toastTimer = null;
    function toast(msg, type) {
      toastEl.className = 'po-toast po-toast--' + (type || 'ok');
      toastEl.innerHTML = '<i class="po-toast__icon" aria-hidden="true"></i><span>' + escapeHtml(msg) + '</span>';
      toastEl.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2200);
    }

    /* ============================================================
     * PUBLIC API
     * ============================================================ */
    function getState() {
      var out = {};
      CFG.counts.forEach(function (c) {
        out[c.key] = {
          label: c.label,
          used: (state.used[c.key] || []).length,
          max: c.maxAdd
        };
      });
      return out;
    }
    /* 네임스페이스에 메서드를 "추가" 합니다. 재대입하면 pick_util.js 가 붙인
     * PickOption.utils(및 이후 cafe24_bridge 가 붙일 .bridge)가 지워집니다. */
    var API = {
      getState: getState,
      rescan: function () {
        bridge.refresh();
        rescan();
        return getState();
      },
      open: function (key) {
        var c = cardByKey(key);
        if (c) onCardClick(c);
      },
      reset: function () { resetCards(); closePanel(); },

      /* 선택상품 "행" 목록 — page.js 의 합계 표시가 같은 판별 규칙을 쓰도록 노출.
       * (행 판별 규칙이 pick_option 과 page.js 에 두 벌 존재하지 않게 함) */
      rows: function () { return bridge.rows(); },

      /* 연동 상태 진단 — 콘솔에서 PickOption.diagnose() 실행 */
      diagnose: function () {
        var insp = bridge.inspect();
        var map = insp.optionValueMap;
        var classOf = insp.classOf;
        var rows = [];
        Object.keys(map).forEach(function (base) {
          map[base].forEach(function (e) {
            rows.push({
              옵션값: e.value,
              조작방식: e.control.kind === 'button' ? '버튼 click()' : 'select + change',
              대상: e.control.el.tagName.toLowerCase() +
                (e.control.el.className ? '.' + classOf(e.control.el).split(/\s+/).join('.') : ''),
              사용가능: e.disabled ? '❌ 비활성' : '✅'
            });
          });
        });
        var MODE_LABEL = { button: '텍스트버튼형 (버튼 click)', select: '셀렉트형 (value+change)', none: '❌ 미탐지' };
        var info = {
          '옵션 표시방식': MODE_LABEL[insp.mode],
          '인식된 옵션값 수': rows.length,
          '개입수별 사용가능': map,
          '선택상품 목록': insp.rowsContainer || '⏳ 미발견 (첫 담기 시 학습)',
          '현재 행 수': insp.rowCount,
          '카드 상태': getState()
        };
        if (!rows.length) {
          info['조치'] = '기본 옵션 영역이 페이지에 있는지 + 옵션값이 "' +
            (LABELS[0] || '10개입') + '_1" 형태인지 확인하세요.';
        }
        console.table && rows.length && console.table(rows);
        console.log(TAG + ' 진단 결과', info);
        return info;
      }
    };
    Object.keys(API).forEach(function (k) { window.PickOption[k] = API[k]; });

    root.insertBefore(section, overlay);
    log('초기화 완료');
  }
})();
