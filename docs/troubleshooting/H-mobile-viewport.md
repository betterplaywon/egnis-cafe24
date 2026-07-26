# #H. 모바일 UI 가 개발자도구(device toolbar)에서만 축소돼 보임 — viewport 메타 부재 — ✅ 해결(detail.html 상단 배치)

## 증상

- **브라우저 창을 767px 미만으로 좁히면** 모바일 UI 정상.
- 그러나 **개발자도구 device toolbar(모바일 에뮬)** 로는 PC 레이아웃이 통째로
  작게 축소돼 보임(둘이 다름).
- 과제 구현 조건: "반응형은 PC 브라우저 개발자도구의 모바일 뷰로 확인해도 됩니다.
  화면 폭이 좁아져도 텍스트와 버튼이 깨지지 않아야 합니다." → **device toolbar 가
  평가 기준**이므로 이 축소는 반드시 잡아야 함(선택 아님).

## 원인 (콘솔로 단계적으로 확정)

1. **viewport 메타 부재 확인.**
   `document.querySelector('meta[name=viewport]')?.content` → **`undefined`**.
   메타가 없으면 모바일 브라우저는 가상 뷰포트를 **기본 ~980px** 로 가정해 PC
   레이아웃을 그린 뒤 화면 폭에 맞춰 축소한다(→ "PC 가 작게"). 브라우저 창
   리사이즈는 이 가상 뷰포트를 안 쓰고 **실제 창 폭**을 쓰므로 미디어쿼리가 정상
   발동한다. 이 하나로 "리사이즈 정상 / device toolbar 축소" 두 증상이 전부 설명된다.

2. **layout.html 에 메타를 넣었으나 반영 안 됨.**
   테스트몰 스킨 편집창에서 `/layout/basic/layout.html` 의 `<head>` 에
   `<meta name="viewport" ...>` 를 추가·저장했는데도 콘솔은 계속 `undefined`.

3. **원인 = 이 상품상세에 layout 이 적용되지 않음.**
   실제 렌더된 `<head>`(스토어프론트, 시크릿 창) 를 열어보니:
   - detail.html 자신의 **주석·`<style>`(`.pd-cafe24-option`)** 이 `<head>` 안에 들어가 있음.
   - 반면 편집한 layout 의 head 표식(**`X-UA-Compatible`·`Cache-Control`·`Expires`·
     `Pragma`·`viewport`**)은 **하나도 없음**.
   - 화면에도 **몰 헤더/GNB/로고가 없고** 브레드크럼부터 시작.
   - → detail.html 이 **layout 에 감싸이지 않고 단독 렌더링**되고 있어, layout.html
     의 head 를 고쳐도 이 페이지엔 도달하지 않는다. (편집창에서 상품상세를 열어도
     레이아웃이 안 뜨던 것과 동일한 사실.)

   ※ 진단 과정의 오탐 주의: 스토어프론트는 head 주석을 제거하고 CSS 를
   `optimizer.php` 로 번들한다. 그래서 `head.innerHTML.match(/common\.css/)` 나
   `/layout/` 경로 필터는 **false negative** 가 난다. 근거는 반드시 **실제 meta/DOM
   목록**(`[...document.querySelectorAll('meta')].map(m=>m.outerHTML)`)으로 본다.

## 조치 (해결)

**viewport 메타를 layout.html 이 아니라 `detail.html` 최상단에 둔다.**

카페24는 모듈(detail.html) 상단의 `<meta>`·`<style>`·`<link>` 를 `<head>` 로
끌어올린다(hoisting). 실제로 detail.html 의 `<style>` 이 head 에 올라가 있으므로,
같은 위치의 `<meta>` 도 head 에 실린다.

```html
<!-- detail.html 최상단 -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<!--
 [카페24 스킨] 상품 상세 detail.html — ...
```

- 적용 파일(저장소): [html/detail.html](../../html/detail.html) 최상단.
- 몰 반영: 테스트몰 스킨 편집창 `상품상세(detail.html)` 최상단에 동일하게 추가 후 저장.

## 결과 (검증)

- 시크릿 창 스토어프론트에서 콘솔:
  `document.querySelector('meta[name=viewport]')?.content`
  → **`"width=device-width, initial-scale=1.0"`** (정상).
- device toolbar 에서 PC 축소 사라지고 **모바일 브레이크포인트(≤767px) 정상 발동**.
  텍스트·버튼 깨짐 없음 → 구현 조건 충족.
- 반응형 CSS(`@media (max-width:767px)` 등)는 원래 정상 로드돼 있었다. **메타 한 줄
  문제**였음이 확정됨.

## 함께 처리한 모바일 레이아웃 (코드)

- `custom_detail.css`: 모바일에서 `.pd-tabs`·`.pd-content` 숨김 → 정보 패널(`.pd__right`)이
  이미지 직후로 상승. 구매바 버튼 사이즈 조정(높이 52px/모서리 12px).
- "오늘 N명"(`.pd-social`)은 옵션 시트(`transform` 되는 `#pdOptionSheet`) 안에 있어 CSS 만으로
  밖으로 빼낼 수 없다 → 정보 패널에 **복제본(`.pd-social--m`)** 추가 + 브레이크포인트별 표시
  전환(PC 는 복제본 `display:none` → 원본 그대로, **PC 레이아웃 불변**).
- 바로구매 클릭→시트 열림, 시트 열림 시 3버튼 전환은 기존 구현(page.js `data-open-sheet`
  + `.pd-buybar--sheet`)으로 이미 동작. device toolbar 에서 안 보였던 건 위 메타 부재 탓.

## 남는 이슈 (범위 밖)

- 이 상품상세에 layout 이 적용되지 않아 **몰 헤더·GNB·푸터가 없다.** 과제 범위(골라담기
  옵션 UI · 반응형)와 무관하고 구현 조건에도 포함되지 않으므로 이번엔 다루지 않는다.
  실제 몰 헤더까지 붙이려면 **상품상세 화면에 layout 지정**을 바로잡는 별개 작업이 필요하다.
