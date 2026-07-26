# 문제해결 로그 (몰 검증)

테스트몰에서 발견된 문제 · 원인 · 조치를 항목별로 누적합니다.
**같은 점검을 반복하지 않도록** "이미 확정된 사실"을 먼저 봅니다.

- 작업 배경/단계 → [CONTEXT.md](../CONTEXT.md), 구조 변경 → [refactor/](../refactor/README.md)
- 검증 대상 몰: 테스트몰 `egnisgo.cafe24.com`, 검증 상품 `product_no=11`
  (`[골라담기] 한끼통살 통 닭가슴살 18종`, 상품코드 P000000L)

최종 갱신: 2026-07-26

---

## 이슈 목록

| # | 제목 | 상태 | 파일 |
| --- | --- | --- | --- |
| A | 화면을 덮는 dim / 클릭 불가 (담기 안 됨) | ✅ 원인 확정·해결(환경 문제) | [A-dim-overlay.md](A-dim-overlay.md) |
| B | diagnose "CSS 로드 ❌"(오탐) + 선택완료 버튼 배경 사라짐 | ✅ 수정 완료 | [B-css-load.md](B-css-load.md) |
| C | diagnose "구매 폼 래퍼 ❌" | ✅ 원인 규명(진단 오탐) | [C-buy-form-wrapper.md](C-buy-form-wrapper.md) |
| D | 카페24 옵션 컨트롤 미탐지 (`{$form.option}` 빈 값) | ✅ 원인 확정·수정(스킨 마크업) | [D-option-detection.md](D-option-detection.md) |
| E | 추가 상품 담기 후 금액 계산 오류 | E-1 ✅ 코드 수정 / E-2 ⚠️ 관리자 데이터 | [E-price-calculation.md](E-price-calculation.md) |
| F | 선택 옵션 카드 표시 정리 (구분자·추가금액·수량 스테퍼) | ✅ 수정 완료 | [F-card-display.md](F-card-display.md) |
| G | JS 수정이 몰에 반영 안 됨 — CDN 캐싱 | ✅ 원인 확정·조치 | [G-js-cache.md](G-js-cache.md) |
| H | 모바일 UI 가 device toolbar 에서만 축소 — viewport 메타 부재 | ✅ 원인 확정 | [H-mobile-viewport.md](H-mobile-viewport.md) |

---

## ✅ 이미 확정된 사실 (다시 확인하지 말 것)

- **상품 설정은 정상.** 관리자에서 확인 완료:
  - 진열함 / 판매함, 재고 2,400개(품목 8개 각 300), 대표이미지 등록됨.
  - 옵션: **독립 선택형 + 텍스트버튼 스타일**, 필수옵션 사용,
    값 `10개입_1 · 10개입_2 · 30개입_1 · 30개입_2 · 50개입_1 · 50개입_2 · 100개입_1 · 100개입_2`.
  - → "판매불가/품절/옵션 미연결" 가설은 **기각**. 상품 데이터는 문제 없음.
- **JS 5파일은 최신으로 서빙됨.** diagnose 스택이 `pick_option.js:651` (새 분리 파일).
  `fetch('/css/module/product/pick_option.css')` = **200**, `custom_detail.css` = 200.
  CSS 는 카페24 `optimizer.php` 로 번들되어 `document.styleSheets` 목록엔 파일명이 안 보이는 게 정상.
- **경로 규칙 정상.** CSS·JS 모두 `/css|js/module/product/` 스토어프론트 경로.
- **좌측 상품 이미지 없음(초기 증상)** → 대표이미지 등록 후 **정상 노출**. 해결됨.
- **담기(선택완료 → 선택상품 행 생성) 정상 동작 확인됨.** 시크릿 창 스토어프론트 직접 접속 기준.
  이전에 담기가 막혔던 건 관리자 경유 미리보기 세션의 poxo 오버레이 탓([#A](A-dim-overlay.md)). 코드 정상.
- **검증 환경 규칙: 반드시 시크릿 창 · 로그아웃 · 스토어프론트 URL 직접 접속.**
  관리자에서 상품을 클릭해 열면 분석앱 오버레이(`#atl-ghost`)가 상세를 오염시킨다([#A](A-dim-overlay.md)).

---

## 진단 명령 모음 (콘솔에 붙여넣기)

```js
// ① 연동 자가진단 (가장 먼저)
PickOption.diagnose()

// ② 옵션 모듈이 실제로 무엇을 렌더했는지 (#D 확정용)
[...document.querySelectorAll('.xans-product-option')].map((e,i) =>
  i + ': <' + e.tagName.toLowerCase() + ' class="' + e.className + '"> '
  + e.innerHTML.replace(/\s+/g,' ').trim().slice(0, 220)
).join('\n\n')

// ③ 페이지 어디든 "10개입_1" 값을 가진 클릭 요소가 있는지
[...document.querySelectorAll('a,button,input,li,label,option')]
  .filter(e => /10개입_1/.test((e.textContent||'') + (e.value||'') + (e.getAttribute('rel')||'')))
  .map(e => e.tagName + '.' + e.className)

// ④ 화면 중앙에서 실제로 클릭을 먹는 요소 (#A dim 재현 시)
(() => { const h = document.elementFromPoint(innerWidth/2, innerHeight/2);
  const c = getComputedStyle(h);
  return h.tagName + '.' + h.className + ' | pos=' + c.position + ' pe=' + c.pointerEvents; })()
```

---

## 커밋 이력 (이 로그 관련)

| 커밋 | 내용 |
| --- | --- |
| `58e43e2` | Phase 2·3 detail.html·custom_detail.css 시안 재작성 |
| `a293bb0` | #C 구매 버튼 탐지 셀렉터를 `.pd-actions__*` 로 |
| `cdf4ff9` | #B `.po__head`·선택완료 배경 명시도 + 진단 오탐 수정 |

## 재업로드 필요 파일 (몰 반영)

수정했으면 반드시 몰의 `/js|css/module/product/` 에 **덮어쓰기 업로드** 후 강새로고침:

- `js/option_config.js` (#C)
- `css/pick_option.css` (#B)
- `js/pick_option.js` (#B)
- `js/page.js` (#E-1 총액 계산 수정)
- `js/cafe24_bridge.js` (#F 행 텍스트 정리 + `tagQuantity` 로 `.po-qty` 태깅)
- `css/custom_detail.css` (#F 수량 스테퍼 `[− 1 +]`: `.po-qty__btn{position:static!important}` 로 스킨 절대배치 상쇄)
- `html/detail.html` · `html/snippet_detail_pc.html` · `html/snippet_detail_mobile.html`
  (#G JS 로드를 `@js` 지시자로 전환 — 캐시 자동 무효화, 수동 버전 갱신 불필요)
