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
