# 골라담기 옵션 UI — 설치 및 설정 가이드

카페24 상품 상세페이지에 Figma 시안 기반 "골라담기" 커스텀 옵션 UI를 얹는 패키지입니다.
**구매/장바구니/금액 계산은 전부 카페24 기본 로직에 위임**하며, 이 UI는 카페24 기본
옵션을 대신 "조작"하는 역할만 합니다 — 텍스트버튼형이면 해당 버튼을 클릭하고,
셀렉트형이면 `<select>` 값을 바꾸고 `change` 를 발생시킵니다.

# 구현 내용을 확인할 수 있는 URL

https://egnisgo.cafe24.com/product/detail.html?product_no=11

## 파일 구성

| 파일 | 역할 | 수정 대상 |
| --- | --- | --- |
| `js/option_config.js` | 개입수/맛/문구/뱃지/셀렉터 등 **모든 설정값** | ✅ 값 변경은 이 파일만 |
| `js/pick_option.js` | 골라담기 렌더링 + 카페24 연동 로직 | ❌ 수정 불필요 |
| `css/pick_option.css` | 골라담기 UI 스타일 (`:root` 변수로 색상 조정) | 색상만 필요 시 |
| `html/detail.html` | **페이지 전체 스킨 템플릿** (프로모션바·헤더·GNB·2컬럼·구매바) — ★CAFE24 주석 위치에 모듈/변수 연결 | ⚠️ 스킨에 맞게 **필수 조정** |
| `css/custom_detail.css` | 페이지 전체 스타일 (헤더/갤러리/탭/우측 패널/모바일 시트·구매바) | 색상만 필요 시 |
| `js/page.js` | 탭 전환, 모바일 옵션 바텀시트, 합계·무료배송 진행바 **표시 동기화** (카페24 값 읽기 전용) | `FREE_SHIP_GOAL` 만 |
| `html/snippet_detail_pc.html` | (옵션 영역만 이식할 때 쓰는) PC 삽입 스니펫 | 스킨에 맞게 조정 |
| `html/snippet_detail_mobile.html` | 모바일 삽입 스니펫 | 스킨에 맞게 조정 |
| `html/preview.html` + `assets/` | 페이지 전체를 카페24 모킹으로 보는 로컬 미리보기 (몰 업로드 금지) | — |
| `html/demo.html` | 골라담기 영역만 보는 최소 미리보기 (셀렉트형 모킹) | — |
| `test/` | jsdom 자동 테스트 3종 + 텍스트버튼형 픽스처 (몰 업로드 금지) | — |

전체 페이지 스킨의 로드 순서:
`(스킨 원본)detail.css → custom_detail.css → pick_option.css → (본문) → option_config.js → pick_option.js → page.js`

## 1. 카페24 관리자 사전 설정 (필수)

1. **옵션 등록** — 상품에 필수 옵션 1개(예: 옵션명 `개입수`)를 만들고, 옵션값을
   **suffix 포함**으로 등록합니다. suffix 개수 = 해당 개입수를 담을 수 있는 최대 횟수.

   ```
   10개입_1, 10개입_2, 30개입_1, 30개입_2, 50개입_1, 50개입_2, 100개입_1
   ```

2. **품목 생성 / 추가금액** — 옵션값 전부에 대해 품목을 생성하고, 개입수별
   판매가가 되도록 추가금액을 설정합니다 (예: 기본가 24,700원 = 10개입,
   `30개입_1`/`_2` 추가금액 +45,800원 → 70,500원). 같은 개입수의 suffix 값들은
   추가금액·재고를 동일하게 맞춥니다.
3. **(선택) 추가입력 옵션** — 맛 구성 문자열(`떡볶이맛(10개입)*1 + ...`)을 주문서에
   남기려면 텍스트형 추가입력 옵션을 1개 등록합니다. 없으면 화면 표시만 됩니다.
4. `option_config.js` 의 `counts[].label / maxAdd / price` 를 위 관리자 설정과
   **반드시 일치**시킵니다. (가격 표기는 화면용이며 결제 금액의 기준은 품목입니다)

## 2. 설치

### 방법 A — 전체 스킨 템플릿 (`html/detail.html`, 시안 레이아웃 적용)

`html/detail.html` 은 **기본 스킨의 카페24 모듈을 전부 보존한 채** 레이아웃만
좌(이미지·탭)/우(정보·옵션·구매)로 재구성한 통합본입니다. 관리자 > 디자인 >
스킨 편집 > `product/detail.html` 에 붙여넣은 뒤, 파일 안의 안내대로
아래 두 가지만 원본에서 이어붙이면 됩니다.

1. `module="product_setproduct"` / `module="product_addproduct"` 블록
   (이 상품엔 안 쓰이지만 다른 상품이 깨지지 않도록 유지)
2. 파일 하단의 `coupon_productdetail.html` import 와 `module="product_additional"` 블록

주의할 점:

- **구매 폼은 카페24가 `<div module="product_detail">` 을 감싸 자동 생성**합니다.
  옵션·수량·선택상품목록·구매버튼을 이 div 밖으로 빼면 옵션값이 전송되지 않아
  장바구니/바로구매가 실패합니다.
- 기본 옵션 테이블은 `.pd-cafe24-option` 으로 **화면에서만 감춥니다.**
  골라담기가 이 안의 옵션 버튼을 `click()` 하므로 삭제하면 담기가 동작하지 않습니다.
- `{$total.total_id}` 블록 안의 "상품이 추가되는 영역" 주석과 빈 `<tbody>` 는
  카페24가 참조하므로 그대로 두세요.
- 하단 모바일 구매바는 `data-proxy` 로 카페24 원본 버튼(`.pd-buy-main` /
  `.pd-cart-main`)을 대신 클릭합니다. 구매 로직을 재구현하지 않습니다.
- `css/custom_detail.css` 의 헤더·GNB·프로모션바 스타일은 `layout.html` 에 해당 마크업을
  추가했을 때만 적용됩니다. 옵션 UI 동작과는 무관합니다.

### 방법 B — 옵션 영역만 이식 (스니펫)

1. 카페24 관리자 > 디자인 > **스마트디자인 편집창**에 CSS/JS 를 올립니다.
   ★ **CSS·JS 는 파일업로더(`/web/upload/...`)를 쓰지 않습니다.** 아래 "경로 규칙" 참고.

   | 저장소 파일 | 업로드 위치 / 파일명 |
   | --- | --- |
   | `css/pick_option.css` | 편집창 `css/module/product/pick_option.css` |
   | `css/custom_detail.css` | 편집창 `css/module/product/custom_detail.css` |
   | `js/option_config.js`, `js/pick_option.js`, `js/page.js` | 편집창 `js/module/product/` |
   | 맛 썸네일 이미지 | 파일업로더 `web > upload > pick_option` |

2. PC `detail.html` 에 `html/snippet_detail_pc.html` 내용을 삽입:
   - `<!--@css(/css/module/product/pick_option.css)-->` 는 옵션 영역 위쪽 아무 곳이나
   - `<div id="pickOptionRoot"></div>` 는 **기본 옵션 영역 바로 아래,
     선택상품 목록(#totalProducts) 위**
   - JS 3개는 페이지 하단에, 반드시
     `option_config.js → pick_option.js → page.js` 순서
3. 모바일 스킨은 `html/snippet_detail_mobile.html` 참고. 반응형 단일 스킨이면 PC 삽입만으로 동작.
4. 기본 옵션 UI 는 스니펫의 `<style>` 로 **display:none 처리만** 합니다.
   DOM/이벤트를 삭제하면 구매 흐름이 깨지므로 절대 제거하지 않습니다.
   `#totalProducts`(선택상품 목록), 수량, 총금액, 구매 버튼 영역은 숨기지 않습니다.

## 2-1. 경로 규칙 (필수)

**CSS·JS 는 스토어프론트 경로만 사용합니다. 파일업로더 경로는 사용하지 않습니다.**

파일업로더는 스킨과 다른 도메인(`ecimg.cafe24img.com`)으로 서빙되어
상품 상세페이지에서 CSS·JS 가 로드되지 않습니다. 실제로 이 경로를 쓴 동안
스타일과 스크립트가 전부 404 였고 UI 가 깨졌습니다.

| 종류 | 사용할 경로 | 로드 방식 |
| --- | --- | --- |
| CSS | `/css/module/product/*.css` | `<!--@css(...)-->` 지시자 |
| JS | `/js/module/product/*.js` | `<script src="...">` |
| 이미지 | `/web/upload/pick_option/...` | 파일업로더 (예외 — 이미지만) |

- ❌ `<link rel="stylesheet" href="/web/upload/...">`
- ❌ `<script src="/web/upload/...">`
- ✅ `<!--@css(/css/module/product/pick_option.css)-->`
- ✅ `<script src="/js/module/product/pick_option.js"></script>`

CSS 는 `<link>` 대신 `@css` 지시자를 씁니다. 카페24가 스킨 버전에 맞는
캐시 파라미터를 붙여 주므로 수정 후 반영이 확실합니다.

⚠️ `/css/module/product/detail.css` 는 **스킨 원본 파일**입니다.
이 저장소의 `css/custom_detail.css` 는 이름 그대로
`/css/module/product/custom_detail.css` 에 업로드해 원본을 덮어쓰지 않도록 합니다.

원본 `detail.css` 를 우리 CSS 로 덮어쓰면 카페24 기본 모듈
(`product_image`, `product_detaildesign`, `product_action`, `ec-base-*` 등)의
스타일이 통째로 사라져 상세페이지가 깨집니다. 실제로 이 문제가 발생했고,
스킨 원본 복원 + 파일명 분리로 해결했습니다.

## 3. option_config.js 설정 항목

### counts — 개입수 카드

| 키 | 설명 |
| --- | --- |
| `key` | 내부 상태 키 (`PickOption.getState()` 의 키) |
| `label` | 카드 표시명. **옵션값의 suffix 앞부분과 일치 필수** (`30개입_1` → `30개입`) |
| `count` | 맛 선택 합계 목표 개수 |
| `price` / `discount` / `unitPrice` | 카드 가격 표기 (표시용) |
| `badge` | `{ text, type: 'primary'│'danger' }` 또는 `null` |
| `maxAdd` | 담기 가능 최대 횟수 = 등록한 suffix 개수 |

### flavors — 맛 목록

| 키 | 설명 |
| --- | --- |
| `name` / `meta` | 표시명, 부가정보(kcal·단백질) |
| `img` | 썸네일 경로 (`/web/upload/pick_option/...`) |
| `badge` | 이름 위 강조 문구 (예: `신제품 출시!`) |
| `soldOut` | `true` 면 품절 처리(비활성) |

`unitSize` : 스테퍼 1당 개수(기본 10). `texts` : 토스트/툴팁/타이틀 문구
(`{selected} {remain} {label} {count} {max}` 자동 치환).

### cafe24 — 스킨 연동 셀렉터

각 항목은 **후보 배열**이며 페이지에 존재하는 첫 번째를 사용합니다.
스킨이 다르면 개발자도구로 실제 요소를 확인해 배열 맨 앞에 추가하세요.

| 키 | 설명 |
| --- | --- |
| `optionSelect` | 기본 옵션 `<select>` 후보. **셀렉트형에서만 필요** — 아래 자동 탐지가 우선입니다 |
| `productRows` / `rowItem` | 선택상품 목록 컨테이너 / 행 |
| `rowOptionText` | 행 내 옵션명 요소 — suffix 를 지우고 맛 구성을 표시(표시만 변경, DOM 유지) |
| `writeFlavorToExtraInput` | 추가입력 옵션에 맛 구성 문자열 기록 여부 |
| `buyButtons` | 미선택 구매 클릭 시 토스트를 띄울 버튼들 |

#### 옵션 컨트롤 자동 탐지 (셀렉터 수정이 대부분 불필요한 이유)

표시방식마다 마크업이 완전히 다르므로, 클래스명이 아니라 **옵션값 텍스트**로
조작 대상을 찾습니다. `counts[].label` + `_숫자` 패턴에 맞는 요소를 문서에서 검색합니다.

| 표시방식 | 탐지 대상 | 담기 동작 |
| --- | --- | --- |
| 텍스트버튼형 / 이미지버튼형 | 값 텍스트(또는 `value`/`rel`/`data-value`)를 가진 `<a>` `<button>` `<input>` | 해당 요소를 **네이티브 `click()`** |
| 셀렉트형 | 옵션값을 가진 `<select>` | `value` 설정 + `change` 트리거 |

버튼과 select 가 둘 다 있으면 **버튼 클릭을 우선**합니다. 버튼을 클릭해야
카페24가 버튼 UI 의 선택 상태까지 갱신하기 때문입니다(QA 2). select 값만 바꾸면
행은 생기지만 기본 옵션 UI 는 선택되지 않은 것처럼 남습니다.

탐지 범위에서 `#pickOptionRoot` 와 선택상품 목록 영역은 제외됩니다
(담긴 행에도 `30개입_1` 텍스트가 있어 옵션 버튼으로 오인될 수 있기 때문).

### mobile

`mode: 'sheet'`(바텀시트, 시안 기준) 또는 `'inline'`.
`bottomOffset` 을 하단 고정 구매바 높이(px)로 맞추면 시트/토스트가 버튼과 겹치지 않습니다.

## 4. 동작 방식 요약

1. 개입수 카드 클릭 → `is-active`, 맛 선택 패널(모바일은 바텀시트) 오픈
2. 스테퍼로 합계 = `count` 가 되면 `선택완료` 활성화. 초과 시 툴팁
   `현재 n개 선택됨 · 옵션을 X개 더 선택해 주세요`
3. `선택완료` → 미사용 suffix 옵션값을 카페24에 선택시킴
   (텍스트버튼형: 해당 버튼 `click()` / 셀렉트형: `value` + `change`)
   → **카페24가 선택상품 행 생성·금액 계산** → 토스트 `선택한 상품이 추가되었습니다`
   → 담기 성공 판정은 행 개수 증가가 아니라 **해당 옵션값이 담긴 행을 직접 확인**
4. 행 텍스트의 `30개입_1` 은 `30개입` + 맛 구성 줄로 **표시만** 정리 (DOM/이벤트 유지)
5. `MutationObserver` 가 선택상품 목록 변화를 감지해 자동 `rescan` —
   행 삭제 시 사용 횟수 감소, suffix 소진 시 카드에 `is-maxed`
6. 선택 없이 구매/장바구니 클릭 → 토스트 `옵션을 선택해 주세요` (capture 단계 가드,
   행이 있으면 카페24 기본 동작 그대로 진행)
7. 연타 방지: 담기 처리 중 `busy` 플래그로 버튼 잠금, 행 생성 확인(폴링) 후 해제

## 5. 디버깅

```js
PickOption.diagnose()  // ★ 연동 상태 진단 — 문제 생기면 이것부터 실행
PickOption.getState()  // { qty10: { label:'10개입', used: 1, max: 2 }, ... }
PickOption.rescan()    // 옵션값/목록 강제 재동기화
PickOption.open('qty30') // 특정 개입수 패널 열기
```

`diagnose()` 는 인식된 옵션값을 표로 출력하고, 각 값을 **어떤 방식으로 조작하는지**
(`버튼 click()` / `select + change`)와 실제 대상 요소를 함께 보여줍니다.

| 콘솔 메시지 | 원인 / 조치 |
| --- | --- |
| `[pick-option] #pickOptionRoot 컨테이너가 없습니다` | 스니펫의 마운트 div 누락 — 삽입 위치 확인 |
| `option_config.js 가 먼저 로드되어야 합니다` | JS 로드 순서 config → picker 확인 |
| `카페24 옵션 컨트롤을 찾지 못했습니다` | ① 상세페이지에 카페24 기본 옵션 영역이 실제로 있는지 (스킨 템플릿에서 모듈 블록이 누락되면 UI 는 떠도 담기가 안 됨) ② 옵션값이 `10개입_1` 형태로 등록됐는지 ③ `counts[].label` 이 suffix 앞부분과 일치하는지 |
| `"30개입" 의 선택 가능한 옵션값이 없습니다` | 해당 개입수만 옵션값 미등록/품절 — 관리자에서 `30개입_1` 등록·판매중 여부 확인 |
| `선택상품 행 추가를 감지하지 못했습니다` | `cafe24.productRows` 셀렉터, 옵션값(suffix) 등록 여부 확인 |

> ⚠️ 스킨 템플릿(`html/detail.html`)을 통째로 적용한 경우, **카페24 기본 옵션 영역·
> 선택상품 목록·구매 버튼 onclick 을 반드시 원본 스킨에서 옮겨와야 합니다.**
> 템플릿의 `★CAFE24` / `⛔ 필수 작업` 주석 위치를 비워 두면 위 경고가 발생하며
> 골라담기 UI 는 보이지만 담기·구매가 전혀 동작하지 않습니다.

## 6. 제한 사항

- 결제 금액·재고의 기준은 카페24 품목 설정이며, config 의 가격은 표시용입니다.
- 추가입력 옵션이 없으면 맛 구성은 주문 데이터에 남지 않고 화면 표시만 됩니다.
- Npay 등 외부 간편결제 버튼은 스킨에 따라 자체 스크립트로 동작하므로
  미선택 토스트 가드가 적용되지 않을 수 있습니다(카페24 기본 검증은 동작).
- 민감 정보(계정/API 키)는 이 패키지에 포함되지 않으며, 포함하지 마세요.
