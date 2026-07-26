# 리팩토링 기록

상세페이지 재구현 과정의 구조 변경을 단계별로 누적 기록합니다.
작업 배경과 진행 상황은 [CONTEXT.md](../CONTEXT.md) 를 참고하세요.

항목별 상세는 각 파일로 분리합니다. 새 단계를 추가하면 아래 목록과 파일을 함께 갱신합니다.

## 목록

| 단계 | 내용 | 파일 |
| --- | --- | --- |
| 0 | 문서 체계 개설 (+ 착수 시점 기준선) | [00-docs-setup.md](00-docs-setup.md) |
| 1-1 | 공용 헬퍼를 pick_util.js 로 추출 (순수 이동) | [01-1-pick-util.md](01-1-pick-util.md) |
| 1-2/1-3 | 카페24 연동 로직을 cafe24_bridge.js 로 분리 (순수 이동) | [01-2-3-cafe24-bridge.md](01-2-3-cafe24-bridge.md) |
| 1-4 | page.js 합계 표시가 브릿지 행 판별 규칙을 공유 | [01-4-page-rows-rule.md](01-4-page-rows-rule.md) |
| 1-5 | 구조 정리 — 이벤트 위임 · 함수 분리 · 설정 이동 (동작 변경) | [01-5-structure-cleanup.md](01-5-structure-cleanup.md) |
| 1-6 | PickOption.diagnose() 자가진단 강화 | [01-6-diagnose.md](01-6-diagnose.md) |
| — | Phase 1 요약 | [phase1-summary.md](phase1-summary.md) |
| 2·3 | detail.html · custom_detail.css 시안 재작성 (PC/모바일) | [phase2-3-detail-css.md](phase2-3-detail-css.md) |

## 기록 형식

```markdown
## N. <무엇을 바꿨는가>
- 왜: <해결한 문제 / 위반하던 원칙>
- 어떻게: <이동·분리·추출한 대상>
- 영향 파일: <경로 목록>
- 확인: <diagnose() 결과 / 몰에서 확인한 항목>
```

## 원칙

- **순수 이동**(코드 위치만 변경)과 **동작 변경**을 같은 항목·같은 커밋에 섞지 않는다.
- 자동 테스트가 없으므로 `git diff` 리뷰가 유일한 안전망이다. 이동 단계에서 diff 에
  이동 외 변경이 보이면 되돌린다.
- 확인 결과는 실패도 그대로 적는다.
