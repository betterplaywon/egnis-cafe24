# #G. JS 수정이 몰에 반영 안 됨 — CDN 이 plain `<script src>` URL 캐싱 — ✅ 원인 확정·조치

- 증상: `js/cafe24_bridge.js` 를 최신으로 업로드했는데도 새 코드(`tagQuantity` 의
  `.po-qty` 태깅)가 몰에서 동작 안 함. 스테퍼가 계속 카페24 기본 세로 화살표로 표시.
- **원인 확정(콘솔 판정)**: 스토어프론트 경로를 직접 fetch 해보니
  - `fetch('/js/module/product/cafe24_bridge.js', {cache:'no-store'})` → `tagQuantity: false` (옛 파일)
  - `fetch(같은URL + '?v=' + Date.now(), {cache:'no-store'})` → `tagQuantity: true` (새 파일)
  - → **오리진 파일은 최신인데, 쿼리 없는 URL 을 카페24 CDN 이 캐싱**해 옛 파일을 서빙.
    `no-store` 도 CDN 자체 TTL 앞에서는 무력(클라이언트 헤더 무시). 쿼리를 붙이면 새 캐시 키라 오리진 적중.
- 왜 CSS 는 괜찮았나: CSS 는 `@css` 지시자라 카페24가 스킨 버전 캐시 파라미터를 자동으로
  붙여 매번 새 URL. JS 는 plain `<script src>` 라 파라미터가 없어 CDN 캐시가 안 풀림.
- 조치: `html/detail.html`·`snippet_detail_pc.html`·`snippet_detail_mobile.html` 의 JS 5개를
  plain `<script src>` → **`@js` 지시자**로 전환(`@css` 와 동일). 카페24가 스킨 버전 캐시
  파라미터를 자동 부여하므로 **수동 버전 갱신 없이** JS 재업로드 시 캐시가 자동 무효화된다.
  `@js` 는 위치 그대로 `<script>` 로 치환돼 로드 순서도 보존. 템플릿은 서버 렌더라 저장 즉시 반영.
  (수동 `?v=` 방식도 검토했으나 매번 값 갱신이 필요해 실수 소지 → `@js` 로 자동화.)
- ⚠️ 교훈: "몰에 최신 업로드했다" 는 **서버가 그 URL 로 실제 서빙하는 내용**으로 검증한다.
  `fetch(url, {no-store})` vs `fetch(url+'?v='+Date.now())` 비교로 오리진/CDN 캐시를 가른다.
