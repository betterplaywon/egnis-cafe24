/* ============================================================
 * test-basicskin.js — 카페24 "기본 스킨" 렌더링 결과 기준 연동 테스트
 * 다중 tbody / p.product 행 구조 / option_box_del / 버튼 클래스 중복 대응 검증
 * 실행: node test/test-basicskin.js
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(__dirname, 'fixture_basicskin.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

const run = code => window.eval(code);
run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
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
/* 실제로 담긴 행 = 마지막 tbody 의 tr */
const bodies = () => document.querySelectorAll('#totalProducts tbody');
const rows = () => bodies()[bodies().length - 1].querySelectorAll('tr');
const fill = n => { for (let i = 0; i < n; i++) plus('tteok'); };

(async () => {
  console.log('\n[1] 탐지 — 다중 tbody / 텍스트버튼');
  const diag = window.PickOption.diagnose();
  assert(diag['인식된 옵션값 수'] === 7, `옵션값 7개 인식 (실제: ${diag['인식된 옵션값 수']})`);
  assert(diag['옵션 표시방식'].includes('텍스트버튼형'), '표시방식 = 텍스트버튼형');
  assert(diag['선택상품 목록'] && diag['선택상품 목록'].id === 'totalProducts',
    `#totalProducts 를 컨테이너로 잡음 (첫 tbody 오인 아님)`);
  assert(diag['현재 행 수'] === 0,
    `옵션 미선택 상태에서 행 0개 — 숨겨진 단일상품 tbody/헤더 미계수 (실제: ${diag['현재 행 수']})`);

  console.log('\n[2] QA2 — 담기 → 카페24 버튼 상태 + 행 생성');
  clickCard('qty30'); fill(3); complete();
  await wait(400);
  assert(rows().length === 1, `행 1개 생성 (실제: ${rows().length})`);
  const first = rows()[0];
  assert(first.dataset.pickValue === '30개입_1', `원본 옵션값 보존 (실제: ${first.dataset.pickValue})`);
  assert(first.querySelector('.product span').textContent.trim() === '30개입',
    `p.product > span 의 suffix 제거 (실제: "${first.querySelector('.product span').textContent.trim()}")`);
  assert(first.querySelector('.product').textContent.includes('한끼통살'), '상품명 텍스트 보존');
  assert(first.textContent.includes('떡볶이맛(10개입)*3'), '맛 구성 문자열 표시');
  assert(first.querySelector('.quantity_opt') && first.querySelector('.option_box_del'),
    '카페24 수량 input · 삭제 버튼 DOM 유지 (QA 6)');
  assert(document.querySelector('.xans-product-addoption textarea').value.includes('떡볶이맛'),
    '추가입력 옵션에 맛 구성 기록');

  console.log('\n[3] QA6 — 수량/합계는 카페24 로직 그대로');
  assert(document.querySelector('#totalPrice em').textContent === '70,500',
    `합계 70,500 (실제: ${document.querySelector('#totalPrice em').textContent})`);
  const qty = first.querySelector('.quantity_opt');
  qty.value = '2';
  qty.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert(document.querySelector('#totalPrice em').textContent === '141,000',
    `수량 2 → 141,000 (실제: ${document.querySelector('#totalPrice em').textContent})`);
  qty.value = '1';
  qty.dispatchEvent(new window.Event('input', { bubbles: true }));

  console.log('\n[4] QA3/QA4 — 교차 담기 · suffix 소진');
  clickCard('qty30'); fill(3); complete();
  await wait(400);
  clickCard('qty10'); fill(1); complete();
  await wait(400);
  assert(rows().length === 3, `30+30+10 = 3행 (실제: ${rows().length})`);
  assert(window.__cafe24Mock.alerts.length === 0, '카페24 중복 옵션 경고 없음');
  assert(card('qty30').classList.contains('is-maxed'), '30개입 소진 → is-maxed');
  const st = window.PickOption.getState();
  assert(st.qty30.used === 2 && st.qty10.used === 1,
    `getState 30=2 / 10=1 (실제: ${st.qty30.used} / ${st.qty10.used})`);

  console.log('\n[5] QA4 — option_box_del 삭제 → 자동 해제');
  [].find.call(rows(), r => r.dataset.pickValue === '30개입_2')
    .querySelector('.option_box_del').click();
  await wait(120);
  assert(window.PickOption.getState().qty30.used === 1, '삭제 후 used=1 재동기화');
  assert(!card('qty30').classList.contains('is-maxed'), 'is-maxed 해제');

  console.log('\n[6] QA6 — 구매 버튼 가드 (관심상품은 제외)');
  document.querySelector('a.btnNormal.sizeL[onclick*="wishlist"]').click();
  assert(window.__cafe24Mock.submits.includes('wishlist'),
    '관심상품등록은 가드 대상 아님 — 정상 실행');
  document.querySelector('a.btnSubmit').click();
  assert(window.__cafe24Mock.submits.includes('order'),
    '행이 있으면 바로구매는 카페24 기본 동작 그대로 실행');

  [].forEach.call(rows(), r => r.querySelector('.option_box_del').click());
  await wait(120);
  const before = window.__cafe24Mock.submits.length;
  document.querySelector('a.btnNormal.sizeL[onclick*="basket"]').click();
  assert(window.__cafe24Mock.submits.length === before,
    '행 0개면 장바구니 클릭 차단');
  const toast = document.querySelector('.po-toast');
  assert(!toast.hidden && toast.textContent.includes('옵션을 선택해 주세요'), '미선택 토스트 표시');

  console.log(failed ? `\n❌ ${failed}건 실패` : '\n✅ 전체 통과');
  process.exitCode = failed ? 1 : 0;
})();
