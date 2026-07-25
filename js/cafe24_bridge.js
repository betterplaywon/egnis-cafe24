/* ============================================================
 * cafe24_bridge.js — 카페24 연동 전담 모듈
 * ------------------------------------------------------------
 * 골라담기 UI(pick_option.js)와 카페24 기본 옵션/선택상품 목록
 * 사이의 "다리" 입니다. 구매·장바구니·금액 계산은 재구현하지 않고,
 * 카페24 기본 옵션 요소를 조작(버튼 click / select value+change)해
 * 이후 흐름을 전부 카페24 기본 로직에 위임합니다.
 *
 * 이 파일이 담당하는 것:
 *   - 옵션값("30개입_1") 파싱
 *   - 표시방식(셀렉트/텍스트버튼/이미지버튼) 무관 컨트롤 자동 탐지
 *   - 옵션값 선택 적용 (버튼 click / select change)
 *   - 선택상품 목록 컨테이너 학습·관측, 행 조회
 *   - 담긴 행 표시 정리(suffix 제거·맛 구성) · 추가입력 칸 기록
 *   - 구매 버튼 가드 대상 판별
 *
 * UI(상태·렌더링)는 pick_option.js 가, 화면 문구·셀렉터는
 * option_config.js 가 담당합니다. 여기엔 렌더링 코드를 넣지 않습니다.
 *
 * ★ 로드 순서: option_config.js → pick_util.js → cafe24_bridge.js
 *              → pick_option.js → page.js
 *
 * 공개 API: PickOption.bridge.create(CFG, { root: 우리 UI 컨테이너 })
 * ============================================================ */
(function () {
  'use strict';

  var NS = (window.PickOption = window.PickOption || {});
  var U = NS.utils;
  if (!U) {
    console.error('[cafe24-bridge] pick_util.js 가 먼저 로드되어야 합니다.');
    return;
  }
  var classOf = U.classOf;
  var qsFirst = U.findFirst;

  /* 첫 담기 후 목록이 생성되는 스킨 대비 폴백 셀렉터 */
  var ROWS_FALLBACK = [
    '#totalProducts tbody', '#totalProducts', '.xans-product-total tbody',
    '.xans-product-option .option_products', '.option_products',
    '#EC-SPS-Product-Detail-Option-Selected', '.ec-base-table.typeList tbody'
  ];
  /* 옵션 컨트롤 탐색에서 제외할 "선택상품 목록" 영역 —
   * 담긴 행에도 "30개입_1" 텍스트가 있어 버튼으로 오인될 수 있습니다. */
  var ROWS_AREA_SEL = '#totalProducts, .xans-product-total, .option_products, .pd-selected';

  /* 브릿지 인스턴스 생성. root 는 우리 UI(#pickOptionRoot) — 탐색에서 제외합니다. */
  function create(CFG, opts) {
    var TAG = '[cafe24-bridge]';
    var root = (opts && opts.root) || null;

    function log() {
      if (CFG.debug) console.log.apply(console, [TAG].concat([].slice.call(arguments)));
    }

    /* ============================================================
     * 옵션값 파서
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

    /* 선택상품 "행" 부분일치 정규식 (label 기반 — 하드코딩 없음).
     * 담긴 뒤 화면에서 suffix 를 지우므로 _n 부분은 선택적으로 둡니다. */
    var LABEL_ALT = LABELS.map(reEsc).join('|');
    var ROW_ANY_RE = LABELS.length ? new RegExp('(?:' + LABEL_ALT + ')') : null;
    var ROW_VALUE_RE = LABELS.length ? new RegExp('(' + LABEL_ALT + ')\\s*_\\s*(\\d+)') : null;

    /* ============================================================
     * 선택상품 목록 컨테이너 학습·관측
     * 카페24는 옵션 선택 전에는 목록이 비어 있거나 없을 수 있으므로,
     * 알려진 ID/클래스 → 없으면 첫 담기 시점에 "새로 생긴 요소"로 학습합니다.
     * ============================================================ */
    var rowsContainer = qsFirst(CFG.cafe24.productRows) || qsFirst(ROWS_FALLBACK);
    var rowsObserver = null;
    var rowsChangeCb = null;

    function learnRowsContainer() {
      if (rowsContainer && document.contains(rowsContainer)) return rowsContainer;
      var found = qsFirst(CFG.cafe24.productRows) || qsFirst(ROWS_FALLBACK);
      if (!found) {
        /* 최후 수단: 옵션값 텍스트를 포함한 요소의 공통 부모를 찾는다 */
        var candidates = [].filter.call(document.querySelectorAll('tr, li, div'), function (n) {
          if ((root && root.contains(n)) || !n.children.length) return false;
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

    function observeRows() {
      if (!rowsContainer || !window.MutationObserver) return;
      if (rowsObserver) rowsObserver.disconnect();
      rowsObserver = new MutationObserver(function () { if (rowsChangeCb) rowsChangeCb(); });
      rowsObserver.observe(rowsContainer, { childList: true, subtree: true });
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
          if (root && root.contains(node)) return;   /* 우리 UI 제외 */
          if (inRowsArea(node)) return;              /* 담긴 행 제외 */
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
        if (root && root.contains(s)) return;
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

    /* 현재 옵션값 맵 캐시. refresh() 로 재계산합니다. */
    var optionValueMap = collectOptionValues();
    function currentMode() {
      var kinds = {};
      Object.keys(optionValueMap).forEach(function (k) {
        optionValueMap[k].forEach(function (e) { kinds[e.control.kind] = true; });
      });
      return kinds.button ? 'button' : (kinds.select ? 'select' : 'none');
    }

    /* ============================================================
     * 선택상품 행 조회
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

    /* ---------- 선택상품 행 표시 정리 (DOM 삭제 없이 텍스트만) ---------- */
    function tagRow(row, value, label, key, summary) {
      if (!row || row.dataset.pickValue) return;
      row.dataset.pickValue = value;
      row.dataset.pickKey = key;
      var textEl = qsFirst([CFG.cafe24.rowOptionText], row) || row;
      /* "30개입_1" → "30개입" + 맛 구성 줄 표시 (기존 노드 유지, 텍스트 노드만 교체) */
      try {
        var walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
        var node;
        while ((node = walker.nextNode())) {
          if (node.nodeValue && node.nodeValue.indexOf(value) !== -1) {
            node.nodeValue = node.nodeValue.replace(value, label);
          }
        }
        if (summary && !textEl.querySelector('.po-row-flavors')) {
          var line = U.el('span', 'po-row-flavors', U.escapeHtml(summary));
          textEl.appendChild(line);
        }
      } catch (e) { log('row beautify skip', e); }
    }

    /* 수량 입력칸을 추가입력 칸으로 오인하지 않도록 판별.
     * 카페24 선택상품 행의 수량은 <input type="text" class="quantity_opt"> 라
     * 단순히 input[type=text] 로 찾으면 수량칸을 덮어쓰게 됩니다. */
    function isQuantityField(node) {
      var probe = [node.className, node.name, node.id].join(' ');
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
     * 구매 버튼 가드 — 미선택 시 콜백 (카페24 검증 로직은 유지)
     * ------------------------------------------------------------
     * 앞단에서 안내만 덧붙이고, 행이 있으면 카페24 기본 흐름을 그대로 둡니다.
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

    /* onBlocked(): 행이 하나도 없을 때(=옵션 미선택) 호출됩니다. */
    function guardBuyButtons(onBlocked) {
      /* ★ 가드는 반드시 document 캡처 단계에 답니다.
       * 버튼 자신에 addEventListener(..., true) 로 달면, DOM 명세상 AT_TARGET
       * 단계에서는 capture 여부와 무관하게 "등록 순서"로 실행되므로 파싱 시점에
       * 등록된 인라인 onclick(카페24 {$action_buy}) 이 먼저 실행돼 버립니다.
       * 상위 노드의 캡처 리스너는 타겟보다 확실히 먼저 실행됩니다. */
      var BUY_SEL = (CFG.cafe24.buyButtons || []).filter(function (sel) {
        try { document.querySelector(sel); return true; } catch (e) { return false; }
      }).join(', ');
      if (!BUY_SEL) return;
      document.addEventListener('click', function (e) {
        var t = e.target;
        var btn = t && t.closest ? t.closest(BUY_SEL) : null;
        if (!btn || !isBuyButton(btn)) return;
        if (currentRows().length > 0) return;   /* 행이 있으면 카페24 기본 흐름 그대로 */
        e.preventDefault();
        e.stopImmediatePropagation();
        if (onBlocked) onBlocked();
      }, true);
      log('구매 버튼 가드 적용', BUY_SEL);
    }

    /* ============================================================
     * 인스턴스 공개 API
     * ============================================================ */
    return {
      /* 옵션값 맵/모드 재계산 + 목록 컨테이너 재학습 */
      refresh: function () {
        learnRowsContainer();
        optionValueMap = collectOptionValues();
        return optionValueMap;
      },
      optionValues: function () { return optionValueMap; },
      mode: currentMode,
      labels: function () { return LABELS.slice(); },
      apply: applyOptionValue,

      rows: currentRows,
      findRow: findRowByValue,
      rowValue: rowValueOf,
      learn: learnRowsContainer,
      container: function () { return rowsContainer; },

      /* 선택상품 목록 변화 → cb 호출 (컨테이너가 나중에 학습돼도 자동 재관측) */
      onRowsChange: function (cb) {
        rowsChangeCb = cb;
        observeRows();
      },

      tagRow: tagRow,
      writeExtra: writeExtraInput,
      guardBuyButtons: guardBuyButtons,

      /* 진단용 원시 데이터 (표시/판정은 pick_option 의 diagnose 가 담당) */
      inspect: function () {
        learnRowsContainer();
        optionValueMap = collectOptionValues();
        return {
          optionValueMap: optionValueMap,
          mode: currentMode(),
          rowsContainer: rowsContainer,
          rowCount: currentRows().length,
          classOf: classOf
        };
      }
    };
  }

  NS.bridge = { create: create };
})();
