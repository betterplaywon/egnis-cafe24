# #B. diagnose "CSS 로드 ❌" (오탐) + 선택완료 버튼 배경 사라짐 — ✅ 수정 완료

- 증상: diagnose 1번 항목 ❌. `.po__head` 배경 = `rgba(0,0,0,0)`.
- 원인: `.po button { background:none }`(명시도 0,1,1)이 `.po__head` /
  `.po-panel__complete`(0,1,0)를 **명시도로 이겨** 배경을 지움. 진단이 하필 그 배경을 봐서 오탐.
  → 부수효과로 **선택완료 버튼 배경(검정)도 투명해지는 실제 시각 버그**였음.
- 조치(커밋 `cdf4ff9`):
  - `css/pick_option.css`: `.po .po__head`, `.po .po-panel__complete` 로 명시도 상향.
  - `js/pick_option.js`: 진단 CSS 판정을 배경 대신 `.po-card__btn` 의 `display:flex` 로 변경.
- 재검증: 3파일 업로드 후 diagnose 1번이 ✅ + 선택완료 버튼이 검정으로 보이면 완료.
