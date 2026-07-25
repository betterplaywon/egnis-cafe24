# 문제해결 로그 (몰 검증)

테스트몰에서 발견된 문제 · 원인 · 조치를 한 곳에 누적합니다.
**같은 점검을 반복하지 않도록** "이미 확정된 사실"을 먼저 봅니다.

- 작업 배경/단계 → [CONTEXT.md](CONTEXT.md), 구조 변경 → [REFACTOR.md](REFACTOR.md)
- 검증 대상 몰: 테스트몰 `egnisgo.cafe24.com`, 검증 상품 `product_no=11`
  (`[골라담기] 한끼통살 통 닭가슴살 18종`, 상품코드 P000000L)

최종 갱신: 2026-07-25

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

---

## 이슈 트래킹

### #A. 화면을 덮는 dim / 클릭 불가 — ✅ 원인 규명(내 코드 아님)

- 증상: 상세 좌측에 빗금 무늬가 덮이고 클릭이 막힘.
- 진단: `document.elementFromPoint(중앙)` = `DIV.disable` (pos=absolute, pe=auto, 흰 배경).
  내 오버레이는 전부 정상(`.po-overlay`·`.pd-sheet-dim`·`.po-panel` 모두 `hidden`/`display:none`).
- 원인: **카페24 기본 스킨의 `.disable` 레이어.** 우리 딤/오버레이가 아님.
- 상태: 상품이 정상 판매 상태가 되면 사라지는 성격. 상품 설정 정상 확인됐으므로
  재현되면 `.disable` 의 소속 모듈을 다시 특정한다(중앙 클릭 요소 재확인).

### #B. diagnose "CSS 로드 ❌" (오탐) + 선택완료 버튼 배경 사라짐 — ✅ 수정 완료

- 증상: diagnose 1번 항목 ❌. `.po__head` 배경 = `rgba(0,0,0,0)`.
- 원인: `.po button { background:none }`(명시도 0,1,1)이 `.po__head` /
  `.po-panel__complete`(0,1,0)를 **명시도로 이겨** 배경을 지움. 진단이 하필 그 배경을 봐서 오탐.
  → 부수효과로 **선택완료 버튼 배경(검정)도 투명해지는 실제 시각 버그**였음.
- 조치(커밋 `cdf4ff9`):
  - `css/pick_option.css`: `.po .po__head`, `.po .po-panel__complete` 로 명시도 상향.
  - `js/pick_option.js`: 진단 CSS 판정을 배경 대신 `.po-card__btn` 의 `display:flex` 로 변경.
- 재검증: 3파일 업로드 후 diagnose 1번이 ✅ + 선택완료 버튼이 검정으로 보이면 완료.

### #C. diagnose "구매 폼 래퍼 ❌" — ✅ 원인 규명(진단 오탐)

- 증상: diagnose 2번 항목 ❌. 콘솔 확인 결과 `buyBtnFound:true` + `buyBtnInDetail:false`.
- 1차 원인(수정 `a293bb0`): 시안 리스타일로 원본 버튼 클래스(`btnSubmit`/`btnNormal.sizeL`)를
  제거해 `buyButtons` 가 버튼을 못 찾던 문제 → `buyButtons` 선두에
  `.pd-actions .pd-actions__buy, .pd-actions .pd-actions__cart` 추가로 **탐지는 복구**됨.
- 2차 원인(진짜 오탐): 버튼은 찾았지만 판정이 `closest('[module="product_detail"]')` 를 봤는데,
  **카페24가 `module="product_detail"` 속성을 처리하며 제거하고 `class="xans-product-detail"`
  로 바꾼다**(모든 `module=*` 이 `xans-product-*` 클래스로 치환됨). 그래서 속성으로는 못 찾음.
  버튼은 폼 안에 정상적으로 있음 = 기능 문제 아님.
- 조치(커밋 예정): `js/pick_option.js` 진단 판정을
  `closest('[module="product_detail"], .xans-product-detail')` 로 확장.
- 재검증: `pick_option.js` 업로드 후 diagnose 2번 ✅.
  ⚠️ 현재도 2번 ❌ 로 보이면 = `.xans-product-detail` 판정을 넣은 최신 `pick_option.js`
  (커밋 `5fd5e3e`)가 아직 업로드 안 된 것. CSS(✅)만 반영된 이전 버전이 도는 상태.

### #D. 카페24 옵션 컨트롤 미탐지 (`{$form.option}` 빈 값) — ✅ 원인 확정·수정 (스킨 마크업)

- **진짜 원인(순정 detail.html 대조로 확정): 옵션 `<table>` 에서 `module="product_option"` 누락.**
  - 베이직 순정: `<table ... module="product_option"> … <tbody module="product_option">`
    → `module` 을 **`<table>` 과 `<tbody>` 양쪽**에 붙인다.
  - 우리 detail.html: `<table class="pd-cafe24-option">` (module 없음) + `<tbody module="product_option">`.
    → `<table>` 에서 module 을 빼서 카페24가 옵션을 **바인딩하지 않음** → `{$form.option}`·
    `{$option_name}` 빈 값 → 옵션 UI 미출력 → 담기 불가.
  - 이전 코드 주석의 "table 에 module 붙이면 렌더 제외" 는 **틀린 설명이었음**(순정이 반증).
- 조치(커밋 `6acfbe1`): 옵션 `<table>` 에 `module="product_option"` 추가(순정과 동일), 주석 정정.
- 재검증 결과:
  - [x] diagnose 3번(옵션 컨트롤) **✅** — 옵션값 8개(`10개입_1…100개입_2`) 전부 인식,
        표시방식 텍스트버튼형(버튼 click), 대상 `<a>`, 목록 `div#totalProducts`.
  - [ ] 카드 담기 → 선택상품 행 생성 동작 확인 (다음 단계).
  - [ ] 숨김(`.pd-cafe24-option` clip) 상태에서도 `.click()` 으로 담기가 되는지 확인.

<details><summary>(과거 기록) 오판했던 가설 — 상품 설정 원인설</summary>

이전엔 옵션 미출력을 "독립 선택형이라 `{$form.option}` 로 렌더 안 됨(상품 설정 특성)" 으로
추정했으나, 순정 스킨에선 같은 상품(독립선택형)의 옵션이 정상 렌더됨을 확인 → **스킨 마크업
문제**로 확정됨. 독립선택형 여부는 원인이 아니었다.
</details>

- 증상: diagnose 3번 ❌. `optionValues {}`, `selectCount: 0`,
  `.xans-product-option` tbody 가 `<th></th><td><p class="value"></p>` 로 **완전히 빔**
  (`{$option_name}`·`{$form.option}` 둘 다 빈 값), 페이지 어디에도 `10개입_1` 요소 없음
  (`tenPackEls: []`).
- **제약(중요): 옵션 구성방식 "독립 선택형" 은 과제 필수 조건이라 변경 불가.**
  관리자 세팅(옵션 사용함 / 독립 선택형 / 직접 입력하기 / 텍스트버튼 / 필수옵션 /
  값 10개입_1…100개입_2 / 개입수 구성별 금액 차이)은 그대로 두고 **스킨에서 대응**해야 한다.
  `_1`·`_2` suffix = 같은 개입수의 추가 가능 횟수(30개입_1·_2 → 최대 2번). 금액 차이는
  개입수(10/30/50/100) 구성별이며 같은 개입수의 _1·_2 는 동일 금액. → 조합형 전환 제안은 철회.
- 현상: `{$option_name}`·`{$form.option}` 모두 빈 값, 페이지에 옵션 UI 자체가 없음.
  또한 `.xans-product-option` 이 4개(빈 옵션 tbody ×2 + #totalProducts 옵션 서브행 ×2) —
  **product_detail 블록이 2번 렌더된 정황**(추가 조사 필요).
- 다음 확인(서버 원본 HTML 로 렌더 방식 판정 — DOM 아님):
  ```js
  fetch(location.href,{cache:'no-store'}).then(r=>r.text()).then(h=>{
    console.log('"10개입"', /10개입/.test(h), '| <select>', (h.match(/<select/g)||[]).length,
      '| product_option', (h.match(/product_option/g)||[]).length,
      '| optJS', /aOptionData|EC_FRONT|option_value|iOptionCnt/.test(h));
  });
  ```
  - raw 에 옵션 있음 → DOM 에서 사라지는 지점 수정.
  - raw 없음 + optJS true → 독립선택형은 JS 렌더 → 컨테이너 추가 + 렌더 후 숨김.
  - 둘 다 없음 → 옵션 모듈 블록을 독립선택형 기본 스킨 구조로 정면 교체.
- 참고: `.pd-cafe24-option` 은 `clip`/1px 로 숨기는데 CSS 는 DOM 에서 요소를 제거하지
  못하므로, "옵션이 DOM 에 아예 없음"은 숨김 탓이 아니다(서버/JS 렌더 자체가 안 된 것).

- **서버 원본 HTML 판정 결과(확정):**
  - `"10개입"` 은 옵션 UI 가 아니라 **SEO JSON-LD(`offers`)** 안에만 존재.
  - 옵션/상품 스크립트 = 우리 5파일 + 카페24 `/ind-script/il_3` 번들뿐.
    별도 옵션 렌더 스크립트 없음.
  - 옵션엔진 흔적 = `aOptionColorchip`(컬러칩)만. **옵션을 그리는 `aOptionData` 류가
    서버 출력에 아예 없음.** `{$option_name}` 도 빈 값.
  - → **카페24 서버가 이 `module="product_option"` 에 옵션을 바인딩/출력하지 않음.**
    CSS/JS/숨김 무관한 **서버 렌더 단계 문제**. 원인은 스킨 옵션 모듈 구조(또는 순정 대비 누락).
  - 부수 관찰: `.xans-product-option` 4개 = product_detail 이 2번 렌더된 정황(추가 확인 필요:
    `document.querySelectorAll('.xans-product-detail').length`).

- **다음 결정 단계(순정 스킨 대조 — 진행 예정):**
  - [ ] 카페24 베이직 **순정 detail.html** 에서 이 상품(product_no=11)의 옵션이 렌더되는지 확인.
        렌더되면 → 우리 스킨이 깨뜨린 것 → 옵션 모듈 블록을 순정 기준으로 정면 교체.
        안 되면 → 상품/카페24 레벨(독립선택형+텍스트버튼+직접입력 조합) 특성 → 별도 대응.
  - [ ] 순정 옵션 모듈 블록(`module="product_option"` 테이블)을 확보해 우리 detail.html 과 diff.

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
