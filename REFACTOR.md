# 리팩토링 기록

상세페이지 재구현 과정의 구조 변경을 단계별로 누적 기록합니다.
작업 배경과 진행 상황은 [CONTEXT.md](CONTEXT.md) 를 참고하세요.

기록 형식:

```markdown
## N. <무엇을 바꿨는가>
- 왜: <해결한 문제 / 위반하던 원칙>
- 어떻게: <이동·분리·추출한 대상>
- 영향 파일: <경로 목록>
- 확인: <diagnose() 결과 / 몰에서 확인한 항목>
```

원칙:

- **순수 이동**(코드 위치만 변경)과 **동작 변경**을 같은 항목·같은 커밋에 섞지 않는다.
- 자동 테스트가 없으므로 `git diff` 리뷰가 유일한 안전망이다. 이동 단계에서 diff 에
  이동 외 변경이 보이면 되돌린다.
- 확인 결과는 실패도 그대로 적는다.

---

## 0. 문서 체계 개설

- 왜: 리팩토링과 재구현이 여러 단계에 걸치는데 무엇을 왜 바꿨는지 남는 곳이 없었다.
  이전 작업에서 "어디서 문제가 발생했는지 파악할 수 없다"는 상황이 반복됐다.
- 어떻게: 작업 컨텍스트(CONTEXT.md)와 구조 변경 기록(REFACTOR.md)을 분리해 개설.
  CONTEXT.md 는 현재 상태·결정·진행 상황을, REFACTOR.md 는 단계별 변경 내역을 담는다.
- 영향 파일: `CONTEXT.md`(신규), `REFACTOR.md`(신규)
- 확인: 문서 작업이므로 코드 동작 변화 없음.

### 착수 시점 기준선

| 항목 | 값 |
| --- | --- |
| 기준 커밋 | `499318b fix: main contents 클릭이 안되는 에러 해결중` |
| `js/pick_option.js` | 890줄 (단일 IIFE, 책임 8종 혼재) |
| `js/page.js` | 154줄 |
| `js/option_config.js` | 181줄 |
| `css/custom_detail.css` | 347줄 (약 40% 는 detail.html 이 렌더하지 않는 규칙) |
| `css/pick_option.css` | 219줄 |
| `html/detail.html` | 428줄 |
| 로컬 테스트 | 없음 (`test/`, `preview.html`, `demo.html` 삭제됨) |
| 전역 노출 | `window.PickOption`, `window.PDSheet`, `window.PICK_OPTION_CONFIG` |

---

## 1-1. 공용 헬퍼를 pick_util.js 로 추출 (순수 이동)

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

---

## 1-2/1-3. 카페24 연동 로직을 cafe24_bridge.js 로 분리 (순수 이동)

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
