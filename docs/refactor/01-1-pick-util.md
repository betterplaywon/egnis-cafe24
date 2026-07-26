# 1-1. 공용 헬퍼를 pick_util.js 로 추출 (순수 이동)

- 왜: `ready` / 후보 셀렉터 순회 / `parsePrice` 가 pick_option.js 와 page.js 에 각각
  구현돼 있었다 (동일 로직 2벌). `fmt`·`money`·`el`·`escapeHtml`·`classOf` 도 한 파일에만
  있어 재사용이 어려웠다. 파일이 나뉠 예정이므로 공용 헬퍼를 먼저 한 곳에 모은다.
- 어떻게:
  - `js/pick_util.js` 신규 — `PickOption.utils` 에 `ready`/`findFirst`/`fmt`/`money`/
    `parsePrice`/`el`/`escapeHtml`/`classOf` 8종. 카페24 연동·화면 로직은 넣지 않음.
  - pick_option.js: 중복 정의(`qsFirst`/`fmt`/`money`/`el`/`escapeHtml`/지역 `classOf`)를
    제거하고 `U.*` 로 참조. `ready` 기반 부트 → `U.ready(boot)`. `U` 부재 시 로드 순서
    안내 후 중단하는 가드 추가.
  - page.js: 지역 `parsePrice`·후보 셀렉터 for 루프 제거 → `U.parsePrice`/`U.findFirst`.
  - **재대입 → 추가로 변경**: pick_option.js 끝의 `window.PickOption = {...}` 이
    pick_util 이 붙인 `.utils` 를 덮어쓰고 있었다. `API` 객체를 만들어 네임스페이스에
    키를 "추가"하는 방식으로 교체 (전역 노출은 여전히 `window.PickOption` 하나).
- 영향 파일: `js/pick_util.js`(신규), `js/pick_option.js`, `js/page.js`
- 확인: jsdom 스모크 — 로드 체인(config→util→pick→page) 정상, `PickOption.utils` 8키 유지,
  공개 API 5종(getState/rescan/open/reset/diagnose) 유지, 카드 4개 렌더, 상태 정상.
  `node --check` 4개 파일 통과. `git diff` 상 이동 외 변경 없음(가드 추가 제외).
