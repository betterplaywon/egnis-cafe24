# 1-2/1-3. 카페24 연동 로직을 cafe24_bridge.js 로 분리 (순수 이동)

- 왜: pick_option.js(890줄)에 옵션값 파싱·컨트롤 탐지·조작·행 관측·표시 정리·구매 가드가
  UI(상태·렌더링)와 뒤섞여 있어, 화면 문제인지 연동 문제인지 파일 단위로 갈라낼 수 없었다.
- 어떻게:
  - `js/cafe24_bridge.js` 신규 — `PickOption.bridge.create(CFG, { root })` 인스턴스가
    아래를 소유. 내부 상태(`rowsContainer`/`optionValueMap`/observer)를 브릿지가 캡슐화.
    - 옵션값 파서: `parseOptionValue`/`looksLikeOptionValue`/정규식(VALUE_RE 등)
    - 컨트롤 탐지: `scanButtons`/`findSelect`/`collectOptionValues`/`nodeOptionValue`/
      `isDisabledLike`/`hasClickHint`/`inRowsArea`
    - 조작: `apply(entry)` (버튼 `click()` / select `value`+`change`)
    - 목록: `learn`/`rows`/`findRow`/`rowValue`/`onRowsChange`(observer)/`container`
    - 표시·추가입력: `tagRow`/`writeExtra`(+ `isQuantityField`)
    - 구매 가드: `guardBuyButtons(onBlocked)` (관심상품 제외 규칙 포함, document 캡처)
    - 진단 원시 데이터: `inspect()`
  - pick_option.js(890→556줄): 위 로직을 전부 브릿지 호출로 교체. 남은 책임은
    카드/맛 패널 렌더, 스테퍼 상태, `onComplete` 오케스트레이션, 토스트, 공개 API.
    `optionValueMap`/`currentRows` 등 지역 상태 제거 → `bridge.optionValues()`/`bridge.rows()`.
    `window.PickOption` 재대입 없이 API 키 추가는 1-1 그대로 유지.
- 영향 파일: `js/cafe24_bridge.js`(신규 430줄), `js/pick_option.js`(-355/+40)
- 확인: jsdom 스모크 13종 전부 통과 — 텍스트버튼형 탐지(3옵션값), 30개입 담기 →
  행 생성·suffix 제거·맛 구성·추가입력 기록·rescan(used=1), 2회째 담기 → 소진 is-maxed,
  행 있을 때 바로구매 정상 진행(가드 통과)·관심상품 가드 제외. `node --check` 5파일 통과.
  동작 변경 없음(순수 이동). diagnose 는 `insp.mode` 를 직접 사용하도록만 조정.

> 로드 순서가 5단계로 늘어남: option_config → pick_util → **cafe24_bridge** → pick_option → page.
> html/detail.html·snippet 의 스크립트 태그는 Phase 2/4 에서 갱신 예정.
