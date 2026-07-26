# #D. 카페24 옵션 컨트롤 미탐지 (`{$form.option}` 빈 값) — ✅ 원인 확정·수정 (스킨 마크업)

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
