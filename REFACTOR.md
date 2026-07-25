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

---

## 1-4. page.js 합계 표시가 브릿지 행 판별 규칙을 공유

- 왜: page.js 가 선택상품 행을 `/개입/.test(textContent)` 로 독자 판별하고 있었다.
  브릿지의 `rows()`(thead/tfoot 제외·중첩 행 제거·label 정규식)와 규칙이 두 벌이라,
  스킨이 바뀌면 두 곳을 따로 고쳐야 했다.
- 어떻게:
  - pick_option 공개 API 에 `rows()` 추가 → `bridge.rows()` 노출.
  - page.js `getRows()`: `PickOption.rows()` 가 있으면 그것을, 없으면(초기화 실패 시)
    기존 컨테이너 직접 조회로 폴백. 합계·세트 수·무료배송·data-empty 는 이 목록 기준.
- 영향 파일: `js/pick_option.js`(+3), `js/page.js`
- 확인: jsdom 페이지 스모크 8종 통과 — `PickOption.rows` 노출, 30개입 담기 → 1세트·
  70,500원·무료배송 메시지·진행바 100%·선택영역 표시 전환. node --check 통과.

---

## 1-5. 구조 정리 — 이벤트 위임 · 함수 분리 · 설정 이동 (동작 변경)

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

---

## 1-6. PickOption.diagnose() 자가진단 강화 (이 프로젝트의 검증 수단)

- 왜: 로컬 테스트를 두지 않기로 했으므로, 몰 상세페이지에서 상태를 한 번에 판정할
  수단이 필요하다. 특히 직전 미해결 이슈(`main contents 클릭 불가`)의 회귀를 감지해야 한다.
- 어떻게: `diagnose()` 가 옵션값/컨트롤 표 외에 **6개 점검을 ✅/❌ + 조치 문구**로 출력.
  1. 스크립트 로드(util·bridge) 2. CSS 로드(`.po__head` 배경색 마커) 3. 구매 폼 래퍼
  (`[module=product_detail]` 안에 구매버튼) 4. 옵션 컨트롤 탐지(mode≠none) 5. 선택상품
  목록 컨테이너 6. **본문 클릭 가능** — `document.elementFromPoint(화면 중앙)` 이
  `.po-overlay`/`.pd-sheet-dim` 이면 ❌(닫힌 딤이 본문을 덮음). 반환값은
  `{ health, info, optionValues }` 로 확장.
- 영향 파일: `js/pick_option.js`
- 확인: jsdom 양성 7종(6항목 전부 ✅) + 음성 3종(옵션·구매버튼 없을 때 ❌ + 조치 문구)
  통과. node --check 통과.

---

### Phase 1 요약

`js/pick_option.js` 890줄 단일 IIFE → 4파일 분리:
- `pick_util.js`(~90줄) 공용 헬퍼 · `cafe24_bridge.js`(~430줄) 카페24 연동 ·
  `pick_option.js`(~650줄) 상태+렌더링 · `page.js` 표시 동기화(브릿지 행 규칙 공유).
- 전역 노출은 여전히 `window.PickOption` 1개(`utils`/`bridge`/공개 메서드).
- 로드 순서 5단계 고정. 동작 불변(순수 이동) + 구조 정리 + 진단 강화.
- 검증: 각 단계 jsdom 스모크 + node --check. 이후 몰에서 diagnose() 로 최종 확인.
