# 1-6. PickOption.diagnose() 자가진단 강화 (이 프로젝트의 검증 수단)

- 왜: 로컬 테스트를 두지 않기로 했으므로, 몰 상세페이지에서 상태를 한 번에 판정할
  수단이 필요하다. 특히 직전 미해결 이슈(`main contents 클릭 불가`)의 회귀를 감지해야 한다.
- 어떻게: `diagnose()` 가 옵션값/컨트롤 표 외에 **6개 점검을 ✅/❌ + 조치 문구**로 출력.
  1. 스크립트 로드(util·bridge) 2. CSS 로드(`.po__head` 배경색 마커) 3. 구매 폼 래퍼
  (`[module=product_detail]` 안에 구매버튼) 4. 옵션 컨트롤 탐지(mode≠none) 5. 선택상품
  목록 컨테이너 6. **본문 클릭 가능** — `document.elementFromPoint(화면 중앙)` 이
  `.po-overlay`/`.pd-sheet-dim` 이면 ❌(닫힌 딤이 본문을 덮음). 반환값은
  `{ health, info, optionValues }` 로 확장.
- 영향 파일: `js/pick_option.js`
- 확인: jsdom 양성 7종(6항목 전부 ✅) + 음성 3종(옵션·구매버튼 없을 때 ❌ + 조치 문구)
  통과. node --check 통과.
