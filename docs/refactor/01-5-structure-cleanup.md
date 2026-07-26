# 1-5. 구조 정리 — 이벤트 위임 · 함수 분리 · 설정 이동 (동작 변경)

여기부터는 순수 이동이 아니라 내부 구조를 바꾸므로 별도 커밋으로 분리.

- 왜: (a) 카드·맛 스테퍼가 항목마다 리스너를 붙여 관리 지점이 흩어졌고,
  (b) `onComplete`·`buildPanel` 이 50줄을 넘겨 한 함수가 여러 일을 했으며,
  (c) 무료배송 기준 금액이 page.js 에 하드코딩(값=설정 경계 위반)돼 있었다.
- 어떻게:
  - **이벤트 위임**: 카드 리스너 → `cardList` 에 1개, 맛 스테퍼 리스너 2×N →
    `.po-flavors` 에 1개(`data-step` 속성으로 방향 판별). 개별 `addEventListener` 제거.
  - **템플릿 헬퍼**: `renderCard(cfg)` / `renderFlavor(f)` 로 반복 마크업 조립 통일.
    `cardByKey(key)` 로 key→cfg 조회 중복 제거(`open` API 도 재사용).
  - **함수 분리**: `buildPanel` → `renderPanelHead`/`renderFlavorList`/`renderPanelFoot`.
    `onComplete` → `pickEntry`(옵션값 결정·안내) / `applyAndWait`(폴링) / `finishAdd`(마무리).
  - **설정 이동**: `FREE_SHIP_GOAL` → option_config.js `freeShipGoal`(주석 포함),
    page.js 는 `config.freeShipGoal || 40000` 폴백만.
- 영향 파일: `js/pick_option.js`, `js/page.js`, `js/option_config.js`
- 확인: jsdom 스모크 13종 통과 — 카드 하위요소 클릭도 위임으로 패널 오픈, 스테퍼 위임
  합계, 선택완료 활성, 담기(행/suffix/맛구성/추가입력/used), 초과 시 툴팁·미담김,
  구매 가드. node --check 3파일 통과. 개별 스테퍼·카드 리스너 잔존 0.
