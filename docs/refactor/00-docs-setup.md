# 0. 문서 체계 개설

- 왜: 리팩토링과 재구현이 여러 단계에 걸치는데 무엇을 왜 바꿨는지 남는 곳이 없었다.
  이전 작업에서 "어디서 문제가 발생했는지 파악할 수 없다"는 상황이 반복됐다.
- 어떻게: 작업 컨텍스트(CONTEXT.md)와 구조 변경 기록(REFACTOR.md)을 분리해 개설.
  CONTEXT.md 는 현재 상태·결정·진행 상황을, REFACTOR.md 는 단계별 변경 내역을 담는다.
- 영향 파일: `CONTEXT.md`(신규), `REFACTOR.md`(신규)
- 확인: 문서 작업이므로 코드 동작 변화 없음.

## 착수 시점 기준선

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
