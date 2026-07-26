# 1-4. page.js 합계 표시가 브릿지 행 판별 규칙을 공유

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
