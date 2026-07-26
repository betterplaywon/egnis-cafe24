# #F. 선택한 옵션 카드 표시 정리 (구분자 "-" · 추가금액 텍스트 · 수량 스테퍼) — ✅ 수정 완료

관리자 데이터 정상화([#E-2](E-price-calculation.md)) 후 남은 **표시(UI) 정리** 3건. 결제·수량 로직은 그대로 두고
카페24가 렌더한 텍스트/컨트롤의 겉모습만 손봄.

- 증상:
  1. 상품명 아래 `-` 구분자 텍스트가 그대로 노출.
  2. 30개입 이상 옵션에 `(+45,800원)` 같은 추가금액 텍스트가 붙어 노출
     (10개입은 추가금액 0 이라 안 붙음).
  3. 수량 +/- 컨트롤이 카페24 기본 화살표 이미지라 시안과 다름.
- 조치:
  - `js/cafe24_bridge.js` `tagRow`: 행 텍스트 노드를 정리 — 옵션값 suffix 제거에
    더해 `(+금액원)` 표시 제거 + `-` 구분자(빈/대시 전용 텍스트 노드) 제거.
    표시 텍스트만 바꾸며 결제는 행 hidden input(`item_code[]`)이 담당(안전).
  - 수량 스테퍼: 카페24 native `.quantity`(input + up/down 링크)를 **맛 선택
    스테퍼(`.po-stepper`)와 동일한 `[− 1 +]` 가로 배치**로 보이게 한다. DOM·이벤트는
    그대로라 카페24 수량 증감 로직은 유지. **✅ 최종 해결·몰 검증됨.**
    - **진짜 근본원인(확정)**: 스킨(`before_detail.css` 대조)이 화살표를 절대배치로
      세로 스택시킨다 — `#totalProducts tbody td .quantity .up{position:absolute;left:28px;top:0}`,
      `.down{...top:12px}`. **절대배치 요소는 flex `order` 를 무시**하므로 가로 배치가 안 먹었다.
    - **해결에 이른 3단계(각 단계가 다음 원인을 드러냄)**:
      1. CSS 조상 셀렉터(`.pd-selected #totalProducts .quantity`)+`!important` → 매칭 불안정.
         → `js/cafe24_bridge.js` `tagQuantity()` 가 행 생성 시 `.quantity` 에 우리 클래스
         `.po-qty`/`.po-qty__input`/`.po-qty__btn--up|--down` 을 **직접 부여**(텍스트 정리
         `tagRow` 와 같은 경로라 신뢰). CSS 는 그 클래스만 스타일.
      2. 그래도 안 됨 → 콘솔로 확인하니 몰이 **옛 JS 서빙**([#G](G-js-cache.md)). `<script src>` 를 `@js`
         지시자로 전환해 CDN 캐시 자동 무효화. 이후 최신 JS 로드 확인.
      3. 최신 JS·CSS 로드됐는데도 세로 스택 → 정리(cleanup) 중 `before_detail.css` 에서
         스킨의 `position:absolute` 발견. 내 `.po-qty__btn` 이 `position:relative` 를
         **`!important` 없이** 줘서 스킨(명시도 1,2,2)에 짐.
    - **최종 수정**: `css/custom_detail.css` `.po-qty__btn` 을 `position: static !important`
      로 바꿔 절대배치(+`left`/`top`)를 무력화 → 버튼이 flex 흐름에 복귀해 `order` 로
      `[− 1 +]` 정렬. **몰에서 `[− 1 +]` 정상 표시 검증 완료.**
- 재검증(완료): 재업로드 후 **새 담기** 기준으로 카드에 `-`·`(+금액)` 이 없고
  `[− 1 +]` 스테퍼로 표시됨. 콘솔 `getComputedStyle(.po-qty a).position === 'static'`,
  `order` 가 `-1`(down)/`1`(up) 확인.
