# #C. diagnose "구매 폼 래퍼 ❌" — ✅ 원인 규명(진단 오탐)

- 증상: diagnose 2번 항목 ❌. 콘솔 확인 결과 `buyBtnFound:true` + `buyBtnInDetail:false`.
- 1차 원인(수정 `a293bb0`): 시안 리스타일로 원본 버튼 클래스(`btnSubmit`/`btnNormal.sizeL`)를
  제거해 `buyButtons` 가 버튼을 못 찾던 문제 → `buyButtons` 선두에
  `.pd-actions .pd-actions__buy, .pd-actions .pd-actions__cart` 추가로 **탐지는 복구**됨.
- 2차 원인(진짜 오탐): 버튼은 찾았지만 판정이 `closest('[module="product_detail"]')` 를 봤는데,
  **카페24가 `module="product_detail"` 속성을 처리하며 제거하고 `class="xans-product-detail"`
  로 바꾼다**(모든 `module=*` 이 `xans-product-*` 클래스로 치환됨). 그래서 속성으로는 못 찾음.
  버튼은 폼 안에 정상적으로 있음 = 기능 문제 아님.
- 조치(커밋 예정): `js/pick_option.js` 진단 판정을
  `closest('[module="product_detail"], .xans-product-detail')` 로 확장.
- 재검증: `pick_option.js` 업로드 후 diagnose 2번 ✅.
  ⚠️ 현재도 2번 ❌ 로 보이면 = `.xans-product-detail` 판정을 넣은 최신 `pick_option.js`
  (커밋 `5fd5e3e`)가 아직 업로드 안 된 것. CSS(✅)만 반영된 이전 버전이 도는 상태.
