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

  /* ---------- 0. 부트 가드 ---------- */
  if (!CFG) {
    console.error(TAG + ' option_config.js 가 먼저 로드되어야 합니다.');
    return;
  }
  if (!U) {
    console.error(TAG + ' pick_util.js 가 먼저 로드되어야 합니다. ' +
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
  var qsFirst = U.findFirst;
  var fmt = U.fmt;
  var money = U.money;
  var el = U.el;
  var escapeHtml = U.escapeHtml;
  var classOf = U.classOf;

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
     * 옵션값 파서
     * ------------------------------------------------------------
     * 카드 label 로 "30개입_1" 형태의 카페24 옵션값을 식별합니다.
     * label 목록에 없는 문자열은 옵션값으로 보지 않습니다(오탐 방지).
     * ============================================================ */
    var LABELS = CFG.counts.map(function (c) { return c.label; }).filter(Boolean);
    function reEsc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    var VALUE_RE = LABELS.length
      ? new RegExp('^(' + LABELS.map(reEsc).join('|') + ')\\s*_\\s*(\\d+)$')
      : null;
    function parseOptionValue(text) {
      if (!VALUE_RE) return null;
      var m = String(text == null ? '' : text).trim().match(VALUE_RE);
      return m ? { base: m[1], suffix: parseInt(m[2], 10) } : null;
    }
    function looksLikeOptionValue(text) { return !!parseOptionValue(text); }

    /* 선택상품 "행"을 알아보기 위한 부분일치 정규식 (label 기반 — 하드코딩 없음).
     * 담긴 뒤 화면에서 suffix 를 지우므로 _n 부분은 선택적으로 둡니다. */
    var LABEL_ALT = LABELS.map(reEsc).join('|');
    var ROW_ANY_RE = LABELS.length ? new RegExp('(?:' + LABEL_ALT + ')') : null;
    var ROW_VALUE_RE = LABELS.length ? new RegExp('(' + LABEL_ALT + ')\\s*_\\s*(\\d+)') : null;

    /* ============================================================
     * 선택상품 목록 자동 탐지
     * 카페24는 옵션 선택 전에는 목록이 비어 있거나 없을 수 있으므로,
     * 알려진 ID/클래스 → 없으면 첫 담기 시점에 "새로 생긴 요소"로 학습합니다.
     * ============================================================ */
    var ROWS_FALLBACK = [
      '#totalProducts tbody', '#totalProducts', '.xans-product-total tbody',
      '.xans-product-option .option_products', '.option_products',
      '#EC-SPS-Product-Detail-Option-Selected', '.ec-base-table.typeList tbody'
    ];
    /* 옵션 컨트롤 탐색에서 제외할 "선택상품 목록" 영역 —
     * 담긴 행에도 "30개입_1" 텍스트가 있어 버튼으로 오인될 수 있습니다. */
    var ROWS_AREA_SEL = '#totalProducts, .xans-product-total, .option_products, .pd-selected';
    var rowsContainer = qsFirst(CFG.cafe24.productRows) || qsFirst(ROWS_FALLBACK);

    /* 목록 컨테이너를 나중에 학습 (첫 담기 후 생성되는 스킨 대응) */
    function learnRowsContainer() {
      if (rowsContainer && document.contains(rowsContainer)) return rowsContainer;
      var found = qsFirst(CFG.cafe24.productRows) || qsFirst(ROWS_FALLBACK);
      if (!found) {
        /* 최후 수단: 옵션값 텍스트를 포함한 요소의 공통 부모를 찾는다 */
        var candidates = [].filter.call(document.querySelectorAll('tr, li, div'), function (n) {
          if (root.contains(n) || !n.children.length) return false;
          return looksLikeOptionValue((n.textContent || '').trim().split(/\s+/)[0]);
        });
        if (candidates.length) found = candidates[0].parentNode;
      }
      if (found) {
        rowsContainer = found;
        observeRows();
        log('선택상품 목록 컨테이너 학습 완료', found);
      }
      return rowsContainer;
    }

    /* ============================================================
     * 카페24 옵션 컨트롤 자동 탐지 (표시방식 무관)
     * ------------------------------------------------------------
     * 표시방식(셀렉트/텍스트버튼/이미지버튼)마다 마크업이 전혀 다르므로
     * 클래스명이 아니라 "옵션값 텍스트"로 조작 대상을 찾습니다.
     *
     *   셀렉트형     → <select> 의 <option> : value 설정 + change 트리거
     *   텍스트버튼형 → 값 텍스트를 가진 <a>/<button>/<input> : 네이티브 click()
     *
     * ★ 텍스트버튼형에서 select 값만 바꾸면 카페24 버튼 UI 의 "선택 상태"가
     *   갱신되지 않습니다(QA 2). 그래서 버튼이 있으면 버튼 클릭을 우선하고,
     *   선택 표시·행 생성·금액 계산은 전부 카페24 자체 핸들러에 위임합니다.
     * ============================================================ */
    function inRowsArea(node) {
      if (rowsContainer && rowsContainer.contains(node)) return true;
      return !!(node.closest && node.closest(ROWS_AREA_SEL));
    }
    function isDisabledLike(node) {
      if (node.disabled) return true;
      if (node.getAttribute && node.getAttribute('aria-disabled') === 'true') return true;
      return /disabled|soldout|sold_out|nostock|out_of_stock/i.test(classOf(node));
    }
    function hasClickHint(node) {
      if (node.getAttribute && node.getAttribute('onclick')) return true;
      return /option|btn|button|select/i.test(classOf(node));
    }
    /* 요소가 나타내는 옵션값 문자열 (속성 우선, 없으면 텍스트) */
    function nodeOptionValue(node) {
      var attrs = ['value', 'data-value', 'rel', 'data-option-value', 'title'];
      for (var i = 0; i < attrs.length; i++) {
        var v = node.getAttribute && node.getAttribute(attrs[i]);
        if (v && parseOptionValue(v)) return String(v).trim();
      }
      var t = (node.textContent || '').trim();
      return parseOptionValue(t) ? t : null;
    }

    /* 옵션값 텍스트를 가진 클릭 대상 수집 (텍스트버튼/이미지버튼형) */
    function scanButtons() {
      var found = [];
      function collect(selector, requireHint) {
        [].forEach.call(document.querySelectorAll(selector), function (node) {
          if (root.contains(node)) return;      /* 우리 UI 제외 */
          if (inRowsArea(node)) return;         /* 담긴 행 제외 */
          if (requireHint && !hasClickHint(node)) return;
          var v = nodeOptionValue(node);
          if (v) found.push({ el: node, value: v });
        });
      }
      collect('a, button, input[type="button"], input[type="radio"], label', false);
      /* 인터랙티브 태그가 전혀 없는 스킨 대비 (클릭 힌트가 있는 요소만) */
      if (!found.length) collect('li, span, div, p', true);
      /* 중첩 매칭 제거: 같은 값이면 가장 안쪽 요소만 클릭 대상으로 (핸들러는 버블링됨) */
      return found.filter(function (a) {
        return !found.some(function (b) { return b !== a && a.el.contains(b.el); });
      });
    }

    /* 옵션값 패턴이 가장 많이 일치하는 select (셀렉트형 / 버튼형의 내부 select) */
    function findSelect() {
      var pref = qsFirst(CFG.cafe24.optionSelect);
      var best = null, bestScore = 0;
      [].forEach.call(document.querySelectorAll('select'), function (s) {
        if (root.contains(s)) return;
        var score = 0;
        [].forEach.call(s.options, function (o) {
          if (parseOptionValue(o.value) || parseOptionValue(o.text)) score++;
        });
        if (s === pref) score += 0.5;  /* 동점이면 config 지정 셀렉터 우선 */
        if (score > bestScore) { bestScore = score; best = s; }
      });
      return bestScore >= 1 ? best : null;
    }

    /* 옵션값 인덱싱: "30개입_1" → { base, suffix, value, control, disabled } */
    function collectOptionValues() {
      var map = {};
      function add(value, parsed, control, disabled) {
        (map[parsed.base] = map[parsed.base] || []).push({
          base: parsed.base, suffix: parsed.suffix, value: value,
          control: control, disabled: !!disabled
        });
      }
      /* 1) 텍스트버튼/이미지버튼형 */
      scanButtons().forEach(function (b) {
        var p = parseOptionValue(b.value);
        if (p) add(b.value, p, { kind: 'button', el: b.el }, isDisabledLike(b.el));
      });
      /* 2) 셀렉트형 */
      var sel = findSelect();
      if (sel) {
        [].forEach.call(sel.options, function (opt) {
          var raw = (opt.value || '').trim();
          var byValue = parseOptionValue(raw);
          var p = byValue || parseOptionValue(opt.text);
          if (!p) return;
          /* 식별용 문자열은 "30개입_1", 실제 select 에 넣을 값은 opt.value */
          add(byValue ? raw : (opt.text || '').trim(), p,
            { kind: 'select', el: sel, value: opt.value }, opt.disabled);
        });
      }
      /* 같은 옵션값이 버튼·셀렉트 양쪽에 있으면 버튼 클릭을 우선 */
      Object.keys(map).forEach(function (k) {
        var uniq = {};
        map[k].forEach(function (e) {
          var prev = uniq[e.value];
          if (!prev || (prev.control.kind === 'select' && e.control.kind === 'button')) uniq[e.value] = e;
        });
        map[k] = Object.keys(uniq).map(function (v) { return uniq[v]; })
          .sort(function (a, b) { return a.suffix - b.suffix; });
      });
      return map;
    }

    /* 옵션값 하나를 카페24에 "선택시킨다" — 이후 흐름은 전부 카페24 기본 로직 */
    function applyOptionValue(entry) {
      var c = entry && entry.control;
      if (!c) return false;
      if (c.kind === 'button') {
        /* 네이티브 click: 인라인 onclick·jQuery 핸들러·기본 동작을 모두 실행시킨다 */
        c.el.click();
        return true;
      }
      c.el.value = c.value;
      if (window.jQuery) window.jQuery(c.el).trigger('change');
      else c.el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    var optionValueMap = collectOptionValues();
    var optionMode = (function () {
      var kinds = {};
      Object.keys(optionValueMap).forEach(function (k) {
        optionValueMap[k].forEach(function (e) { kinds[e.control.kind] = true; });
      });
      return kinds.button ? 'button' : (kinds.select ? 'select' : 'none');
    })();

    if (optionMode === 'none') {
      console.warn(TAG + ' 카페24 옵션 컨트롤을 찾지 못했습니다. 다음을 확인하세요.\n' +
        '  1) 상세페이지에 카페24 기본 옵션 영역(.xans-product-option / 텍스트버튼 목록)이 실제로 존재하는지\n' +
        '     — 스킨 템플릿에서 해당 모듈 블록이 누락되면 UI 는 떠도 담기가 동작하지 않습니다.\n' +
        '  2) 관리자 옵션값이 "' + (LABELS[0] || '10개입') + '_1" 형태(suffix 포함)로 등록되어 있는지\n' +
        '  3) option_config.js 의 counts[].label 이 옵션값의 suffix 앞부분과 일치하는지\n' +
        '  콘솔에서 PickOption.diagnose() 를 실행하면 현재 탐지 상태를 확인할 수 있습니다.');
    } else {
      log('옵션 컨트롤 확정 — 표시방식:', optionMode, optionValueMap);
    }
    if (!rowsContainer) {
      log('선택상품 목록 컨테이너 미발견 — 첫 담기 시 자동 학습합니다.');
    }

    /* ============================================================
     * RENDER — 카드 목록
     * ============================================================ */
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
      li.querySelector('.po-card__btn').addEventListener('click', function () {
        onCardClick(c);
      });
      cardList.appendChild(li);
      cardEls[c.key] = li;
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

    function buildPanel(countCfg) {
      panelWrap.innerHTML = '';
      var sheet = useSheet();
      panelWrap.classList.toggle('po-panel--sheet', sheet);

      var head = el('div', 'po-panel__head',
        (sheet ? '<span class="po-panel__grab" aria-hidden="true"></span>' : '') +
        '<strong class="po-panel__title">' + escapeHtml(fmt(CFG.texts.flavorTitle, { label: countCfg.label })) + '</strong>' +
        '<button type="button" class="po-panel__close" aria-label="닫기">&times;</button>');
      head.querySelector('.po-panel__close').addEventListener('click', closePanel);
      panelWrap.appendChild(head);

      var list = el('ul', 'po-flavors');
      CFG.flavors.forEach(function (f) {
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
          '  <button type="button" class="po-stepper__btn po-stepper__btn--minus" aria-label="빼기"' + (f.soldOut ? ' disabled' : '') + '>&minus;</button>' +
          '  <span class="po-stepper__value" aria-live="polite">0</span>' +
          '  <button type="button" class="po-stepper__btn po-stepper__btn--plus" aria-label="더하기"' + (f.soldOut ? ' disabled' : '') + '>+</button>' +
          '</span>';
        if (!f.soldOut) {
          li.querySelector('.po-stepper__btn--minus').addEventListener('click', function () { step(f.id, -1, countCfg); });
          li.querySelector('.po-stepper__btn--plus').addEventListener('click', function () { step(f.id, +1, countCfg); });
        }
        list.appendChild(li);
      });
      panelWrap.appendChild(list);

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
      panelWrap.appendChild(foot);

      updatePanel(countCfg);
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
      var candidates = optionValueMap[countCfg.label] || [];
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

    function onComplete(countCfg) {
      if (state.busy) return;
      var total = selectedTotal(countCfg);
      if (total !== countCfg.count) { showTooltip(countCfg); return; }
      /* 담기 직전 재탐지 — 카페24가 옵션 UI 를 다시 그렸을 수 있고,
       * 다른 경로로 행이 추가/삭제됐을 수도 있습니다. */
      optionValueMap = collectOptionValues();
      rescan();

      if (!Object.keys(optionValueMap).length) {
        toast('옵션 연동을 찾지 못했습니다. 관리자 옵션값 등록을 확인해 주세요.', 'warn');
        console.warn(TAG + ' 담기 실패: 카페24 옵션 컨트롤 미탐지. ' +
          'PickOption.diagnose() 로 상세 상태를 확인하세요. ' +
          '(옵션값 "' + countCfg.label + '_1" 등록 여부 / 기본 옵션 영역 존재 여부)');
        return;
      }

      var entry = nextAvailableEntry(countCfg);
      if (entry == null) {
        markMaxed();
        toast(fmt(CFG.texts.toastMaxed, { label: countCfg.label, max: countCfg.maxAdd }), 'warn');
        return;
      }
      var value = entry.value;

      state.busy = true;
      var completeBtn = panelWrap.querySelector('.po-panel__complete');
      if (completeBtn) completeBtn.disabled = true;

      var summary = flavorSummary();
      var beforeRows = currentRows().length;

      /* ★ 카페24 기본 로직 위임 지점:
       * 텍스트버튼형 → 해당 버튼 클릭 (카페24가 버튼 선택 상태까지 갱신)
       * 셀렉트형     → select 값 변경 + change 트리거
       * 이후 선택상품 행 생성·수량·금액 계산은 전부 카페24가 처리합니다. */
      try {
        applyOptionValue(entry);
      } catch (err) {
        /* 카페24 핸들러가 예외를 던져도 busy 가 영구 잠기지 않도록 */
        console.warn(TAG + ' 옵션 적용 중 오류', err);
        state.busy = false;
        if (completeBtn) completeBtn.disabled = false;
        toast('옵션을 담는 중 오류가 발생했습니다.', 'warn');
        return;
      }

      /* 행 추가 확인 (최대 1.5초 폴링) 후 마무리.
       * 개수 증가가 아니라 "해당 옵션값이 담긴 행"을 직접 찾습니다 —
       * 목록이 위로 쌓이는 스킨/합계행이 있는 스킨에서도 정확합니다. */
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        learnRowsContainer();          /* 목록이 이제 막 생겼을 수 있으므로 매번 재확인 */
        var rows = currentRows();
        var newRow = findRowByValue(value) ||
          (rows.length > beforeRows ? rows[rows.length - 1] : null);
        if (newRow || tries > 15) {
          clearInterval(timer);
          if (newRow) {
            tagRow(newRow, value, countCfg, summary);
            writeExtraInput(newRow, summary);
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
      }, 100);
    }

    function resetCards() {
      state.selectedKey = null;
      state.flavorQty = {};
      Object.keys(cardEls).forEach(function (k) {
        cardEls[k].classList.remove('is-active');
        cardEls[k].querySelector('.po-card__btn').setAttribute('aria-checked', 'false');
      });
    }

    /* ---------- 선택상품 행 표시 정리 (DOM 삭제 없이 텍스트만) ---------- */
    function tagRow(row, value, countCfg, summary) {
      if (!row || row.dataset.pickValue) return;
      row.dataset.pickValue = value;
      row.dataset.pickKey = countCfg.key;
      var textEl = qsFirst([CFG.cafe24.rowOptionText], row) || row;
      /* "30개입_1" → "30개입" + 맛 구성 줄 표시 (기존 노드 유지, 텍스트 노드만 교체) */
      try {
        var walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
        var node;
        while ((node = walker.nextNode())) {
          if (node.nodeValue && node.nodeValue.indexOf(value) !== -1) {
            node.nodeValue = node.nodeValue.replace(value, countCfg.label);
          }
        }
        if (summary && !textEl.querySelector('.po-row-flavors')) {
          var line = el('span', 'po-row-flavors', escapeHtml(summary));
          textEl.appendChild(line);
        }
      } catch (e) { log('row beautify skip', e); }
    }

    /* 수량 입력칸을 추가입력 칸으로 오인하지 않도록 판별.
     * 카페24 선택상품 행의 수량은 <input type="text" class="quantity_opt"> 라
     * 단순히 input[type=text] 로 찾으면 수량칸을 덮어쓰게 됩니다. */
    function isQuantityField(el) {
      var probe = [el.className, el.name, el.id].join(' ');
      return /quantity|qty|amount|count/i.test(probe);
    }

    function writeExtraInput(row, summary) {
      if (!CFG.cafe24.writeFlavorToExtraInput || !summary) return;
      var cands = [];
      /* 행 안의 추가입력 칸 우선 (행마다 추가입력이 붙는 스킨) */
      if (row) {
        try { cands = cands.concat([].slice.call(row.querySelectorAll(CFG.cafe24.extraInputSelector))); }
        catch (e) { /* 잘못된 셀렉터 무시 */ }
      }
      /* 없으면 공용 추가입력 영역 */
      cands = cands.concat([].slice.call(document.querySelectorAll(
        '.xans-product-addoption textarea, .xans-product-addoption input[type="text"]')));

      for (var i = 0; i < cands.length; i++) {
        var input = cands[i];
        if (isQuantityField(input) || input.value) continue;
        input.value = summary;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
    }

    /* ============================================================
     * RESCAN — 선택상품 목록 ↔ 카드 상태 동기화
     * ============================================================ */
    function currentRows() {
      var box = rowsContainer && document.contains(rowsContainer) ? rowsContainer : learnRowsContainer();
      if (!box || !ROW_ANY_RE) return [];
      var matched = [].filter.call(
        box.querySelectorAll(CFG.cafe24.rowItem),
        function (r) {
          /* 헤더/합계 행 제외 */
          if (r.closest && r.closest('thead, tfoot')) return false;
          /* 옵션값 패턴 또는 pickValue 태그가 있는 행만 */
          if (r.dataset.pickValue) return true;
          return ROW_ANY_RE.test(r.textContent || '');
        }
      );
      /* 중첩 제거: tr 안에 li 가 또 있는 스킨에서 한 상품이 2번 세어지는 것을 방지.
       * 바깥쪽 행만 남깁니다. */
      return matched.filter(function (a) {
        return !matched.some(function (b) { return b !== a && b.contains(a); });
      });
    }

    /* 특정 옵션값이 담긴 행 찾기 (담기 성공 판정 · 표시 정리 대상 확정용) */
    function findRowByValue(value) {
      var list = currentRows();
      for (var i = list.length - 1; i >= 0; i--) {
        var r = list[i];
        if (r.dataset.pickValue === value) return r;
        if (!r.dataset.pickValue && (r.textContent || '').indexOf(value) !== -1) return r;
      }
      return null;
    }

    function rowValueOf(row) {
      if (row.dataset.pickValue) return row.dataset.pickValue;
      var m = ROW_VALUE_RE && (row.textContent || '').match(ROW_VALUE_RE);
      return m ? m[1] + '_' + m[2] : null;
    }

    function rescan() {
      CFG.counts.forEach(function (c) { state.used[c.key] = []; });
      currentRows().forEach(function (row) {
        var value = rowValueOf(row);
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
      var noIntegration = !Object.keys(optionValueMap).length;
      CFG.counts.forEach(function (c) {
        var available = (optionValueMap[c.label] || []).filter(function (v) { return !v.disabled; }).length;
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

    var rowsObserver = null;
    function observeRows() {
      if (!rowsContainer || !window.MutationObserver) return;
      if (rowsObserver) rowsObserver.disconnect();
      rowsObserver = new MutationObserver(function () { rescan(); });
      rowsObserver.observe(rowsContainer, { childList: true, subtree: true });
    }
    observeRows();
    rescan();

    /* ============================================================
     * 구매 버튼 가드 — 미선택 시 토스트 (카페24 검증 로직은 유지)
     * ============================================================ */
    var EXCLUDE = CFG.cafe24.buyButtonsExclude || [];
    /* 구매 흐름이 아닌 버튼(관심상품·추천메일 등)은 가드에서 제외 */
    function isBuyButton(btn) {
      var probe = ((btn.textContent || '') + ' ' + (btn.getAttribute('onclick') || '')).toLowerCase();
      for (var i = 0; i < EXCLUDE.length; i++) {
        if (probe.indexOf(String(EXCLUDE[i]).toLowerCase()) !== -1) return false;
      }
      return true;
    }
    /* ★ 가드는 반드시 document 캡처 단계에 답니다.
     * 버튼 자신에 addEventListener(..., true) 로 달면, DOM 명세상 AT_TARGET
     * 단계에서는 capture 여부와 무관하게 "등록 순서"로 실행되므로 파싱 시점에
     * 등록된 인라인 onclick(카페24 {$action_buy}) 이 먼저 실행돼 버립니다.
     * 상위 노드의 캡처 리스너는 타겟보다 확실히 먼저 실행됩니다. */
    var BUY_SEL = (CFG.cafe24.buyButtons || []).filter(function (sel) {
      try { document.querySelector(sel); return true; } catch (e) { return false; }
    }).join(', ');

    if (BUY_SEL) {
      document.addEventListener('click', function (e) {
        var t = e.target;
        var btn = t && t.closest ? t.closest(BUY_SEL) : null;
        if (!btn || !isBuyButton(btn)) return;
        if (currentRows().length > 0) return;   /* 행이 있으면 카페24 기본 흐름 그대로 */
        e.preventDefault();
        e.stopImmediatePropagation();
        toast(CFG.texts.toastNeedOption, 'warn');
      }, true);
      log('구매 버튼 가드 적용', BUY_SEL);
    }

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
        learnRowsContainer();
        optionValueMap = collectOptionValues();
        rescan();
        return getState();
      },
      open: function (key) {
        var c = CFG.counts.filter(function (x) { return x.key === key; })[0];
        if (c) onCardClick(c);
      },
      reset: function () { resetCards(); closePanel(); },

      /* 연동 상태 진단 — 콘솔에서 PickOption.diagnose() 실행 */
      diagnose: function () {
        learnRowsContainer();
        optionValueMap = collectOptionValues();
        var rows = [];
        Object.keys(optionValueMap).forEach(function (base) {
          optionValueMap[base].forEach(function (e) {
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
          '옵션 표시방식': MODE_LABEL[rows.length ? (rows[0].조작방식.indexOf('버튼') === 0 ? 'button' : 'select') : 'none'],
          '인식된 옵션값 수': rows.length,
          '개입수별 사용가능': optionValueMap,
          '선택상품 목록': rowsContainer || '⏳ 미발견 (첫 담기 시 학습)',
          '현재 행 수': currentRows().length,
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
