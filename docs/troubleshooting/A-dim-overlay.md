# #A. 화면을 덮는 dim / 클릭 불가 (담기 안 됨) — ✅ 원인 확정·해결(내 코드 아님, 환경 문제)

- 증상: 상세 좌측에 빗금 무늬가 덮이고 카드·옵션 클릭이 막혀 담기가 안 됨.
- **최종 원인(확정): 상세페이지를 관리자 "상품관리"에서 바로 열어 생긴 미리보기 세션.**
  - CFA 스크립트 URL 의 `uref=.../disp/admin/shop1/product/ProductManage...` = **관리자 경유 접속**.
  - poxo 분석/히트맵 앱(`assets.poxo.com/jet/jet.js`, `optimizer.poxo.com/ca2/analytics.js`)이
    상세 폼 전체를 **`#atl-ghost` 로 복제**(→ `.xans-product-detail` 2개, `#pickOptionRoot`·옵션
    select·구매버튼·`{$total.total_id}` ID 가 2벌) + `z-index:501` 오버레이로 상품 영역을 덮음.
  - 이때 관측된 `DIV.disable`(1344×1270, 빗금)·`detailCount:2` 는 전부 이 미리보기 세션의 부산물.
- **해결: 시크릿 창 · 로그아웃 · 스토어프론트 URL 직접 접속**(QA_CHECKLIST 정식 조건).
  `https://egnisgo.cafe24.com/product/detail.html?product_no=11` 직접 입력 시:
  `detailCount:1`, `#atl-ghost` 없음, 중앙 클릭요소 정상(`SECTION.pd__left`), **담기 정상 동작 확인**.
- 코드 수정 불필요. detail.html·pick_option.js 정상. `.pd-cafe24-option` 의 `clip` 숨김도 무관.
- 판정 콘솔:
  ```js
  ({ detailCount: document.querySelectorAll('.xans-product-detail').length,
     ghost: !!document.getElementById('atl-ghost'),
     fromAdmin: /disp\/admin/.test(document.referrer) })
  // 관리자 경유면 detailCount:2 + ghost:true + fromAdmin:true → 시크릿 창으로 재접속
  ```
- ⚠️ 교훈: 몰 기능 검증은 **반드시 시크릿 창 스토어프론트 직접 접속**으로 한다.
  관리자 미리보기/앱 오버레이가 상세 DOM 을 오염시켜 "우리 코드 버그"로 오인하게 만든다.
