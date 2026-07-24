/* ============================================================
 * test-textbutton.js — 카페24 "텍스트버튼형" 옵션 연동 테스트
 * QA 2 / 3 / 4 / 7 검증
 * 실행: node test/test-textbutton.js
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(__dirname, 'fixture_textbutton.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

const run = code => window.eval(code);
run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);          // 카페24 모킹 엔진
run(fs.readFileSync(path.join(ROOT, 'js/option_config.js'), 'utf8'));
run(fs.readFileSync(path.join(ROOT, 'js/pick_option.js'), 'utf8'));
document.dispatchEvent(new window.Event('DOMContentLoaded'));

let failed = 0;
const assert = (cond, msg) => {
  if (!cond) { console.error('  FAIL:', msg); failed++; }
  else console.log('  PASS:', msg);
};
const wait = ms => new Promise(r => setTimeout(r, ms));

const root = document.getElementById('pickOptionRoot');
const panel = () => root.querySelector('.po-panel');
const card = key => root.querySelector(`.po-card[data-key="${key}"]`);
const clickCard = key => card(key).querySelector('.po-card__btn').click();
const plus = id => panel().querySelector(`.po-flavor[data-flavor="${id}"] .po-stepper__btn--plus`).click();
const complete = () => panel().querySelector('.po-panel__complete').click();
const rows = () => document.querySelectorAll('#totalProducts .option_products tr');
const optionButtons = () => document.querySelectorAll('.ec-option-button');

/* 개입수 채우기 헬퍼 — 10개 단위 스테퍼를 n번 누른다 */
const fill = n => { for (let i = 0; i < n; i++) plus('tteok'); };

(async () => {
  console.log('\n[1] 옵션 컨트롤 탐지 (텍스트버튼형)');
  const diag = window.PickOption.diagnose();
  /* 기대값은 픽스처의 옵션 버튼 수에서 직접 구합니다 —
   * 옵션값을 늘려도 테스트가 따라오도록 (하드코딩 금지) */
  const expectedValues = document.querySelectorAll('.ec-option-button').length;
  assert(diag['인식된 옵션값 수'] === expectedValues,
    `옵션값 ${expectedValues}개 인식 (실제: ${diag['인식된 옵션값 수']})`);
  assert(diag['옵션 표시방식'].includes('텍스트버튼형'), `표시방식 = 텍스트버튼형 (실제: ${diag['옵션 표시방식']})`);
  assert(diag['선택상품 목록'] && diag['선택상품 목록'].nodeType === 1, '선택상품 목록 컨테이너 탐지됨');

  console.log('\n[2] QA2 — 담기 시 카페24 텍스트버튼 옵션 + 구매 흐름 갱신');
  clickCard('qty30');
  assert(card('qty30').classList.contains('is-active'), '30개입 카드 is-active (QA 7)');
  fill(3);
  assert(panel().querySelector('.po-panel__counter').textContent === '(30/30개)', '총 수량 30/30');
  complete();
  await wait(400);
  assert(rows().length === 1, `선택상품 행 1개 생성 (실제: ${rows().length})`);
  assert(rows()[0].querySelector('.option strong').textContent.trim() === '30개입',
    `행 표시에서 suffix 제거 (실제: "${rows()[0].querySelector('.option strong').textContent.trim()}")`);
  assert(rows()[0].dataset.pickValue === '30개입_1',
    `행에 원본 옵션값 보존 (실제: ${rows()[0].dataset.pickValue})`);
  assert(rows()[0].textContent.includes('떡볶이맛(10개입)*3'), '맛 구성 문자열 표시');
  assert(rows()[0].querySelector('.quantity_opt') && rows()[0].querySelector('.btnDel'),
    '카페24 수량 입력·삭제 DOM 유지 (QA 6)');
  assert(document.getElementById('product_option_id1').value === '*',
    '카페24가 옵션 선택을 초기화 (기본 흐름 그대로 실행됨)');
  assert(window.__cafe24Mock.alerts.length === 0, '카페24 중복 옵션 경고 없음');

  console.log('\n[3] QA3 — 반복 담기 / 다른 개입수 교차');
  clickCard('qty30'); fill(3); complete();
  await wait(400);
  assert(rows().length === 2, `30개입 2회차 행 생성 (실제: ${rows().length})`);
  clickCard('qty10'); fill(1); complete();
  await wait(400);
  assert(rows().length === 3, `10개입 교차 담기 (실제: ${rows().length})`);
  assert(window.__cafe24Mock.alerts.length === 0, '서로 다른 suffix 사용으로 중복 경고 없음');

  console.log('\n[4] QA4 — suffix 소진 시 제한');
  assert(card('qty30').classList.contains('is-maxed'), '30개입 2회 후 is-maxed');
  clickCard('qty30');
  assert(panel().hidden, 'maxed 카드 클릭 시 패널 미오픈');
  assert(!document.querySelector('.po-toast').hidden, 'maxed 안내 토스트 표시');
  const st = window.PickOption.getState();
  assert(st.qty30.used === 2 && st.qty30.max === 2, `getState 30개입 used=2/max=2 (실제: ${st.qty30.used}/${st.qty30.max})`);

  console.log('\n[5] QA4 — 행 삭제 시 자동 해제');
  [].find.call(rows(), r => r.textContent.includes('30개입')).querySelector('.btnDel').click();
  await wait(120);
  assert(window.PickOption.getState().qty30.used === 1, '행 삭제 후 used=1 재동기화');
  assert(!card('qty30').classList.contains('is-maxed'), 'is-maxed 자동 해제');

  console.log('\n[6] 연타 방지');
  clickCard('qty50'); fill(5);
  const btn = panel().querySelector('.po-panel__complete');
  const before = rows().length;
  btn.click(); btn.click(); btn.click();
  await wait(400);
  assert(rows().length === before + 1, `연타해도 1행만 생성 (실제 증가: ${rows().length - before})`);

  console.log('\n[7] QA6 — 미선택 구매 가드');
  [].forEach.call(document.querySelectorAll('#totalProducts .btnDel'), b => b.click());
  await wait(120);
  document.querySelector('.btnBuy').click();
  const toast = document.querySelector('.po-toast');
  assert(!toast.hidden && toast.textContent.includes('옵션을 선택해 주세요'), '행 0개일 때 구매 클릭 → 토스트');

  console.log(failed ? `\n❌ ${failed}건 실패` : '\n✅ 전체 통과');
  process.exitCode = failed ? 1 : 0;
})();
