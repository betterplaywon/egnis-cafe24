# Phase 2·3. detail.html · custom_detail.css 시안 재작성 (PC/모바일)

- 왜: 기존 detail.html 우측 패널이 카페24 기본 정보 모듈(스펙표·렌탈·정기배송)
  위주라 시안(뱃지·가격·쿠폰·평점·배송·골라담기·선택카드)과 갈라져 있었고,
  custom_detail.css 는 layout.html 소관인 헤더/GNB/프로모션바/플로팅 죽은 코드와
  실제 카페24 렌더와 무관한 `.pd-selected-item` 목업 스타일을 안고 있었다.
- 어떻게(동작 변경 포함 — 순수 이동 아님):
  - **detail.html**: 시안 우측 패널 마크업(`.pd-badges`/`.pd-title`/`.pd-price`/
    `.pd-coupon`/`.pd-rating`/`.pd-ship`/`.pd-social`/`.pd-freeship`/`.pd-total`/
    `.pd-actions`)을 `before_detail.html`(팀 시안 구현본)에서 가져오고, **실제 카페24
    보호 DOM**(`module=product_option/quantity/addoption` 숨김 테이블, `#totalProducts`
    다중 tbody + "상품이 추가되는 영역" 주석, `{$total.total_price_id}` 합계,
    `{$action_buy/basket/wishlist}` onclick)을 통합본에서 그대로 유지해 병합.
  - 탭은 사용자 요청대로 **정적 라벨**(`<span>`, data-target/스크롤/href 없음)로 렌더.
  - 상품명만 `{$name}` 치환변수, 나머지 시안 문구(요약·가격·평점·배송)는 스킨별
    치환변수 편차로 **정적 + ★CAFE24 교체 주석**(CONTEXT §7 #3).
  - 합계: 우리 표시용 `<strong data-pd-total-price>` 와 별개로 카페24 실제 합계
    블록(`{$total.total_cnt}` + `<em data-cafe24-total>`)을 **숨겨서 보존** — page.js 가
    카페24 계산값을 읽어 표시만 갱신(자기 출력을 되읽는 순환 제거).
  - 로드 순서를 **5파일**(`option_config → pick_util → cafe24_bridge → pick_option
    → page`)로 갱신. `snippet_detail_pc/mobile.html` 도 동일 갱신.
  - **custom_detail.css**: 헤더/GNB/프로모션바/플로팅 죽은 코드 삭제(layout.html 소관).
    `.pd-selected-item*` 목업 스타일을 **실제 `#totalProducts` <table> 카드화**로 교체 —
    `tbody > tr:has(p.product)` 를 그리드 카드로(이름/맛 구성/수량 스테퍼/가격/삭제X),
    thead·caption·colgroup 숨김, 카페24 템플릿/합계/옵션 서브행은 카드에서 제외.
  - 모바일: 2단 바텀시트 흐름(구매바 바로구매 → `#pdOptionSheet` 옵션 시트 →
    `.po-panel--sheet` 맛 시트)·미선택 토스트·구매바 3버튼 전환은 기존 구조가 시안과
    부합하여 셀렉터 정합만 조정.
- 영향 파일: `html/detail.html`, `css/custom_detail.css`,
  `html/snippet_detail_pc.html`, `html/snippet_detail_mobile.html`
- 확인: 보호 DOM/치환변수 grep 점검(모두 존재), HTML 태그 균형(main/section/aside/div/
  table 짝 일치), 죽은 코드 잔존 0, `/web/upload` CSS·JS 링크 0, 임시/디버그 흔적 0.
  ⚠️ 로컬 자동 테스트 없음(CONTEXT 결정) — 몰 마이그레이션 후 `PickOption.diagnose()` +
  PC(1440)/모바일(390) 수동 시나리오로 최종 확인 필요.
