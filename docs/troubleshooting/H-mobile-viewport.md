# #H. 모바일 UI 가 개발자도구(device toolbar)에서만 축소돼 보임 — viewport 메타 부재(layout.html) — ✅ 원인 확정

- 증상: **브라우저 창을 767px 미만으로 좁히면** 모바일 UI 정상, 그러나 **개발자도구
  device toolbar(모바일 에뮬)** 로는 PC 레이아웃이 통째로 작게 축소돼 보임(둘이 다름).
- **원인 확정(콘솔 1줄)**: `document.querySelector('meta[name=viewport]')?.content` → **`undefined`**.
  뷰포트 메타 태그 **자체가 없음**. 메타가 없으면 모바일 브라우저는 가상 뷰포트를
  **기본 ~980px** 로 가정해 PC 레이아웃을 그린 뒤 화면 폭에 맞춰 축소한다(→ "PC 가 작게").
  브라우저 창 리사이즈는 이 가상 뷰포트를 안 쓰고 **실제 창 폭**을 쓰므로 미디어쿼리가
  정상 발동한다. 이 하나로 "리사이즈 정상 / device toolbar 축소" 두 증상이 전부 설명된다.
- **조치(몰)**: `layout.html` 의 `<head>` 에 `<meta name="viewport" content="width=device-width, initial-scale=1.0">` 추가.
  - `layout.html` 은 **저장소 밖·몰 전용**이며 상단부(헤더·GNB)는 이번 범위 밖(열린 이슈 §7-2)이라,
    스토어프론트 스킨 편집창에서 직접 추가해야 한다.
  - 판정: 몰 첫 페이지가 실제 폰에서 `/m/…` 로 바뀌면 **PC/모바일 분리 스킨**(실사용 무관·무해),
    URL 그대로 폭만 반응하면 **반응형 단일 스킨**(메타 추가 필수·실사용자에게 바로 영향).
- **함께 처리한 모바일 레이아웃(코드 — 이번 커밋)**:
  - `custom_detail.css`: 모바일에서 `.pd-tabs`·`.pd-content` 숨김 → 정보 패널(`.pd__right`)이
    이미지 직후로 상승. 구매바 버튼 사이즈 조정(높이 52px/모서리 12px).
  - "오늘 N명"(`.pd-social`)은 옵션 시트(`transform` 되는 `#pdOptionSheet`) 안에 있어 CSS 만으로
    밖으로 빼낼 수 없다 → 정보 패널에 **복제본(`.pd-social--m`)** 추가 + 브레이크포인트별 표시
    전환(PC 는 복제본 `display:none` → 원본 그대로, **PC 레이아웃 불변**).
  - 요구 3·4(바로구매 클릭→시트 열림, 시트 열림 시 3버튼 전환)는 기존 구현(page.js `data-open-sheet`
    + `.pd-buybar--sheet`)으로 이미 동작. device toolbar 에서 안 보였던 건 위 메타 부재 탓.
