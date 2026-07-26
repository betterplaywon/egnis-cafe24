# Phase 1 요약

`js/pick_option.js` 890줄 단일 IIFE → 4파일 분리:
- `pick_util.js`(~90줄) 공용 헬퍼 · `cafe24_bridge.js`(~430줄) 카페24 연동 ·
  `pick_option.js`(~650줄) 상태+렌더링 · `page.js` 표시 동기화(브릿지 행 규칙 공유).
- 전역 노출은 여전히 `window.PickOption` 1개(`utils`/`bridge`/공개 메서드).
- 로드 순서 5단계 고정. 동작 불변(순수 이동) + 구조 정리 + 진단 강화.
- 검증: 각 단계 jsdom 스모크 + node --check. 이후 몰에서 diagnose() 로 최종 확인.
