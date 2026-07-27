# 정적 리소스 경로 규칙 (필수)

**CSS·JS 는 스토어프론트 경로만 사용합니다. 파일업로더 경로는 사용하지 않습니다.**

파일업로더는 스킨과 다른 도메인(`ecimg.cafe24img.com`)으로 서빙되어
상품 상세페이지에서 CSS·JS 가 로드되지 않습니다. 실제로 이 경로를 쓴 동안
스타일과 스크립트가 전부 404 였고 UI 가 깨졌습니다.

| 종류 | 사용할 경로 | 로드 방식 |
| --- | --- | --- |
| CSS | `/css/module/product/*.css` | `@css` 지시자 |
| JS | `/js/module/product/*.js` | `@js` 지시자 |
| 이미지 | `/web/upload/pick_option/...` | 파일업로더 (예외 — 이미지만) |

```
❌ <link rel="stylesheet" href="/web/upload/...">
❌ <script src="/web/upload/...">
✅ <!--@css(/css/module/product/pick_option.css)-->
✅ <!--@js(/js/module/product/pick_option.js)-->
```

이 두 경로 외의 폴더를 임의로 만들지 않습니다
(`/css/pick_option/`, `/js/pick_option/` 같은 경로는 존재하지 않습니다).

## `@css` / `@js` 지시자를 쓰는 이유

카페24가 스킨 버전에 맞는 캐시 파라미터를 자동으로 붙여 주므로 수정 후 반영이 확실합니다.
plain `<script src>` 는 파라미터가 없어 카페24 CDN 이 옛 파일을 계속 서빙합니다
(실제로 이 때문에 JS 수정이 반영되지 않은 적 있음 — [troubleshooting/G-js-cache.md](troubleshooting/G-js-cache.md)).
수동 `?v=` 버전 파라미터는 매번 갱신해야 해 실수하기 쉬우므로 쓰지 않습니다.

`@js` 는 위치 그대로 `<script>` 로 치환되어 로드 순서가 보존됩니다.
스니펫을 포함해 아래 5개를 모두, 이 순서로 로드합니다 (`page.js` 누락 주의).

```
option_config.js → pick_util.js → cafe24_bridge.js → pick_option.js → page.js
```

## 스킨 원본 CSS 를 덮어쓰지 않습니다

⚠️ `/css/module/product/detail.css` 는 **스킨 원본 파일**입니다.
이 저장소의 `css/custom_detail.css` 는 이름 그대로
`/css/module/product/custom_detail.css` 에 업로드해 원본을 덮어쓰지 않도록 합니다.

원본 `detail.css` 를 우리 CSS 로 덮어쓰면 카페24 기본 모듈
(`product_image`, `product_detaildesign`, `product_action`, `ec-base-*` 등)의
스타일이 통째로 사라져 상세페이지가 깨집니다. 실제로 이 문제가 발생했고,
스킨 원본 복원 + 파일명 분리로 해결했습니다
([troubleshooting/B-css-load.md](troubleshooting/B-css-load.md)).

## 주의 — 지시자 예시를 HTML 주석 안에 넣지 않습니다

설명 주석 안에 지시자 예시를 문자 그대로 넣으면, HTML 주석은 중첩되지 않아
주석이 끊기고 카페24가 실제 지시자로 처리할 수 있습니다.
스킨 템플릿(`html/*.html`)에서는 예시를 주석으로 남기지 마세요.
