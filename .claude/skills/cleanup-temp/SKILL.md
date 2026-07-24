---
name: cleanup-temp
description: 작업 중 만든 테스트·검증·디버깅용 로직, 임시 모듈/파일, 임시 주석을 찾아 전부 삭제한다. 기능 구현이나 디버깅을 끝낸 뒤, 커밋·제출 직전에 사용. "임시 코드 정리", "디버그 로그 제거", "제출 전 정리" 요청에 사용.
---

# 임시 산출물 정리

작업 완료 전 마지막 단계입니다. 검증용으로 만든 것은 **전부 삭제**하고,
정식 테스트와 설명 주석은 **유지**합니다.

## 1. 변경 범위 확인

```bash
git status --short
git diff
```

추적되지 않는 새 파일과 diff에 섞인 임시 코드를 여기서 잡습니다.

## 2. 임시 파일 찾기

```bash
git status --short --untracked-files=all
ls _*.js test/_*.js *.bak *.old 2>/dev/null
```

삭제 대상: `_repro.js`, `_dbg.js`, `_bal.js`, `_old.js`, `test/_*.js`,
`*.bak` / `*.old` / `*-copy.*`, 확인용으로 만든 임시 미리보기 HTML.

**유지**: `test/test.js`, `test/test-textbutton.js`, `test/test-basicskin.js`,
`test/test-page.js`, `test/fixture_*.html` — 정식 자동 테스트입니다.

## 3. 디버그 코드 찾기

```bash
grep -rn "console\.\(log\|warn\|error\)\|debugger\|window\.__" js/ html/ css/
grep -rn "TODO\|FIXME\|임시\|확인용\|나중에\|테스트용" js/ html/ css/
```

삭제 대상:

- 디버깅용 `console.*` / `debugger`
- 임시 전역 노출(`window.__debug*`), 테스트용 hook
- 주석 처리된 이전 구현, 사용되지 않게 된 함수·변수
- 하드코딩한 임시 값(더미 가격, 고정 개수, 임시 셀렉터)
- `// 임시`, `// 확인용`, `// 여기까지 확인함`, 작업 로그성 주석

**유지**:

- `config.debug` 로 감싼 `[pick-option]` prefix 로그 — 정식 기능입니다.
- [js/option_config.js](../../../js/option_config.js) 의 설정 설명 주석 —
  다른 작업자를 위한 문서입니다.
- 스킨 템플릿의 `<!-- ★CAFE24 ... -->` 주석, 카페24가 참조하는 주석
  (예: "상품이 추가되는 영역") — 삭제하면 기능이 깨집니다.
- "왜 이렇게 했는지"를 설명하는 주석

## 4. 민감 정보 확인

```bash
grep -rni "password\|api[_-]\?key\|secret\|token\|mall[_-]\?id" js/ html/ css/ test/ *.md
```

계정 정보·API 키·토큰·실제 몰 ID가 있으면 제거하고 `YOUR_MALL_ID` 같은
플레이스홀더로 바꿉니다.

## 5. 정리 후 검증

```bash
node test/test.js
node test/test-textbutton.js
node test/test-basicskin.js
node test/test-page.js
```

4개 모두 통과해야 완료입니다. 정리 과정에서 필요한 코드를 지웠다면 여기서 드러납니다.
실패하면 결과를 그대로 보고합니다.

## 6. 보고

삭제한 항목을 목록으로 알립니다. 판단이 애매해 남긴 것이 있으면 그 이유와 함께
명시합니다.
