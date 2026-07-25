# 작업 컨텍스트 — 상세페이지 재구현

이 문서는 **지금 무엇을 왜 하고 있는지**를 추적합니다.
새 세션을 시작하거나 작업을 이어받을 때 이 파일부터 읽습니다.

- 단계별 리팩토링 상세 기록 → [REFACTOR.md](REFACTOR.md)
- 프로젝트 규칙 → [CLAUDE.md](CLAUDE.md)
- 설치·설정 가이드 → [README.md](README.md)
- 몰 검증 항목 → [QA_CHECKLIST.md](QA_CHECKLIST.md)

최종 갱신: 2026-07-25

---

## 1. 왜 재구현하는가

기존 [html/detail.html](html/detail.html) · [css/custom_detail.css](css/custom_detail.css) 는
서로 얽혀 있어 문제가 생겨도 발생 지점을 특정할 수 없다. 코드 탐색으로 확인한 원인:

| # | 문제 | 근거 |
| --- | --- | --- |
| 1 | 책임이 한 파일에 뭉침 | [js/pick_option.js](js/pick_option.js) 890줄에 옵션값 파싱·컨트롤 탐지·카페24 조작·행 관측·상태·렌더링·토스트·구매 가드가 전부 있음 |
| 2 | 실제 몰의 "선택한 옵션" 영역에 적용되는 CSS가 없음 | custom_detail.css 의 `.pd-selected-item` 계열은 삭제된 preview 목업 전용. 실제 카페24는 `#totalProducts` 안에 `<table><tr><p class="product">` 를 렌더 |
| 3 | 오버레이 방어 코드 3중 누적 | `.pd-sheet-dim`/`.po-overlay` 가 `hidden` 속성 + `.is-open` + `pointer-events` + `!important` 로 중복 방어. 직전 커밋 `fix: main contents 클릭이 안되는 에러 해결중` 미해결 |
| 4 | 죽은 코드 약 40% | `.hd*` `.gnb*` `.hd-promo*` `.pd-float*` 는 카페24에서 `layout.html` 소관이라 detail.html 이 렌더하지 않음 |

**목표** — 동작을 바꾸지 않는 리팩토링으로 경계를 먼저 세우고, 그 위에 detail.html 과
custom_detail.css 를 시안(PC/모바일) 기준으로 새로 작성한다.
구매·장바구니·금액 계산은 지금과 동일하게 **전부 카페24에 위임**한다.

---

## 2. 확정된 결정

| 결정 | 내용 | 이유 |
| --- | --- | --- |
| JS 구조 | 책임별 파일 분리 (`pick_util` / `cafe24_bridge` / `pick_option` / `page`) | 화면 문제와 연동 문제를 파일 단위로 갈라내기 위해 |
| 전역 노출 | `window.PickOption` **하나**에 `utils` / `bridge` / 공개 메서드를 붙임 | 파일이 늘어도 전역 오염은 1개 유지 (CLAUDE.md 원칙) |
| CSS 범위 | custom_detail.css 는 **상세영역 전용**. 헤더·GNB·프로모션바·플로팅 제외 | detail.html 이 렌더하지 않는 죽은 코드 제거. 상단부는 layout.html 소관이라 별도 작업 |
| 선택한 옵션 UI | **실제 카페24 `<table>` 마크업**을 CSS 로 카드화 (DOM 삭제·이동 없음) | 목업이 아닌 실제 렌더 결과가 유일한 기준 |
| 로컬 테스트 | `test/` · `preview.html` · `demo.html` **생성하지 않음** | 목업이 실제 스킨 DOM 과 갈라져 틀린 통과를 만들었음. 매 변경을 몰에 마이그레이션해 확인하는 워크플로 |
| 검증 수단 | `PickOption.diagnose()` 를 실제 몰 DOM 자가진단으로 강화 | 업로드 파일이 늘지 않고, 목업이 아니라 진짜 스킨을 봄 |
| 기록 | 리팩토링 내역은 REFACTOR.md 에 단계별 누적 | 무엇을 왜 옮겼는지 추적 |

---

## 3. 진행 상황

| Phase | 내용 | 상태 |
| --- | --- | --- |
| 0 | CONTEXT.md · REFACTOR.md 개설 | ✅ 완료 |
| 1-1 | `js/pick_util.js` — 공용 헬퍼 추출 (`ready`/`findFirst`/`fmt`/`money`/`parsePrice`/`el`/`escapeHtml`/`classOf`) | ✅ 완료 |
| 1-2 | `js/cafe24_bridge.js` — 옵션값 파서·컨트롤 탐지·조작·행 관측·추가입력·구매버튼 판별 이동 | ✅ 완료 |
| 1-3 | `js/pick_option.js` 축소 — 상태 + 렌더링만 (890→556줄, 1-2 와 함께 완료) | ✅ 완료 |
| 1-4 | `js/page.js` — 합계 표시를 `PickOption.rows()` 로, 행 판별 규칙 단일화 | ⏳ 진행 예정 |
| 1-5 | 구조 정리 — 이벤트 위임 / 50줄 초과 함수 분리 / `freeShipGoal` 설정 이동 | ⏳ |
| 1-6 | `PickOption.diagnose()` 자가진단 강화 | ⏳ |
| 2 | `html/detail.html` 신규 작성 | ⏳ |
| 3 | `css/custom_detail.css` 신규 작성 | ⏳ |
| 4 | CLAUDE.md · cleanup.md · README.md · QA_CHECKLIST.md 정리 | ⏳ |

> 1-1 ~ 1-4 는 **순수 이동**이며 로직을 바꾸지 않는다. 동작 변경은 1-5 부터.
> 두 종류를 같은 커밋에 섞지 않는다 — 자동 테스트가 없으므로 `git diff` 가 유일한 안전망이다.

---

## 4. 파일 현재 상태

| 파일 | 역할 | 상태 |
| --- | --- | --- |
| [js/option_config.js](js/option_config.js) | 옵션 UI 설정값 (개입수·맛·문구·셀렉터·모바일) | 유지 · `freeShipGoal` 추가 예정 |
| `js/pick_util.js` | 공용 DOM·문자열 헬퍼 | 신규 예정 |
| `js/cafe24_bridge.js` | 카페24 탐지 / 조작 / 행 관측 | 신규 예정 |
| [js/pick_option.js](js/pick_option.js) | 골라담기 상태 + 렌더링 | 축소 예정 (현 890줄) |
| [js/page.js](js/page.js) | 탭 · 모바일 시트 · 합계 표시 동기화 | 중복 제거 예정 |
| [css/pick_option.css](css/pick_option.css) | 골라담기 UI 스타일 | 유지 · 토큰 파생 + 시안 차이만 수정 |
| [css/custom_detail.css](css/custom_detail.css) | 페이지 전체 스타일 | **전량 재작성 예정** |
| [html/detail.html](html/detail.html) | 스킨 템플릿 | **신규 작성 예정** |
| [html/before_detail.html](html/before_detail.html) | 변경 전 참고본 | 유지 (업로드 안 함) |
| [html/snippet_detail_pc.html](html/snippet_detail_pc.html) · [html/snippet_detail_mobile.html](html/snippet_detail_mobile.html) | 옵션 영역 이식 스니펫 | 로드 순서 5단계로 갱신 예정 |

**로드 순서 (변경 후)**

```
option_config.js → pick_util.js → cafe24_bridge.js → pick_option.js → page.js
```

**경로 규칙 (불변)** — CSS `/css/module/product/*.css`(`@css` 지시자),
JS `/js/module/product/*.js`, 이미지만 파일업로더 `/web/upload/pick_option/`.

---

## 5. 절대 건드리지 않는 것 (삭제 시 구매 실패)

- `<div module="product_detail">` 구매 폼 래퍼 — 옵션·수량·선택상품목록·구매버튼이 이 안에 있어야 함
- `tbody module="product_option"` 의 `{$form.option}`, `module="product_quantity"`, `module="product_addoption"`
  → **`display:none` 숨김까지만** 허용 (골라담기가 이 안의 버튼을 `click()` 함)
- `{$total.total_id}` 블록의 다중 `<tbody>` 와 "옵션선택 또는 세트상품 선택시 상품이 추가되는 영역입니다" 주석
- `{$total.total_price_id}` · `data-cafe24-total`
- `module="product_action"` 의 `{$action_buy}` / `{$action_basket}` / `{$action_wishlist}` onclick

---

## 6. 검증 방법

로컬 자동 테스트 없음. 각 Phase 완료 시:

1. `git diff` 리뷰 — 순수 이동인지, 디버그 로그·임시 주석이 섞이지 않았는지
2. 테스트몰 마이그레이션 후 상세페이지 콘솔에서 `PickOption.diagnose()` → 점검표 전부 ✅
3. PC(1440px) / 모바일(390px) 수동 시나리오
   - 개입수 카드 → 맛 선택 → 선택완료 → 선택한 옵션 카드가 시안대로 렌더
   - 수량 +/- → 총 n세트 · 총 n원 · 무료배송 진행바 갱신
   - 삭제(X) → 0세트 복귀 + 카드 `is-maxed` 해제
   - 옵션 미선택 구매 클릭 → `옵션을 선택해 주세요` 토스트 / 행이 있으면 정상 진행
   - 30개입 2회 담기 → 소진 표시, 관심상품 버튼은 가드에 걸리지 않을 것
   - 모바일 2단 시트 (구매바 → 옵션 시트 → 맛 시트), 딤 클릭으로 닫힘
   - **시트를 닫은 뒤 본문 링크·탭이 정상 클릭되는지** (아래 열린 이슈 회귀 확인)
4. 결과를 REFACTOR.md 에 기록. 실패는 숨기지 않는다.

> 몰 업로드는 **과제용 테스트몰 한정**. 운영몰에는 어떤 변경도 적용하지 않는다.

---

## 7. 열린 이슈

| # | 이슈 | 상태 |
| --- | --- | --- |
| 1 | `main contents 클릭이 안되는 에러` (직전 커밋 499318b) — 닫힌 오버레이가 본문 클릭을 먹는 것으로 추정 | 미해결. Phase 3 에서 딤을 `.is-open` 단일 진실 소스로 재작성, Phase 1-6 에서 `elementFromPoint` 로 회귀 감지 |
| 2 | 시안 상단부(프로모션바·헤더·GNB)는 `layout.html` 소관이라 이번 범위 밖 | 별도 작업으로 분리 |
| 3 | 시안에는 있으나 카페24 치환변수가 없는 문구(개당 단가, 쿠폰 배너, 오늘 N명) | 정적 마크업 + "관리자에서 교체" 주석으로 처리 |

## 8. 사용자 요청 변경 이력

- **탭 클릭 기능 제거** (2026-07-25) — 상세정보·리뷰·영양정보·구매안내 탭의 클릭 전환
  동작이 불필요하다는 요청. page.js 의 탭 전환/스크롤 로직 삭제. Phase 2 detail.html
  재작성 시 탭은 **정적 라벨(클릭 동작 없음)** 로 렌더한다 (`data-target`·스크롤 없음).
