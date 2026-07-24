const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('html/demo.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

// run inline mock script + our scripts manually
function run(code) { window.eval(code); }
// extract inline mock script from demo.html
const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];
run(inline);
run(fs.readFileSync('js/option_config.js', 'utf8'));
run(fs.readFileSync('js/pick_option.js', 'utf8'));
document.dispatchEvent(new window.Event('DOMContentLoaded'));

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; } else console.log('PASS:', msg); };

const root = document.getElementById('pickOptionRoot');
assert(root.querySelectorAll('.po-card').length === 4, '개입수 카드 4개 렌더링');
assert(window.PickOption && typeof window.PickOption.getState === 'function', 'PickOption API 존재');

// 1. 카드 클릭 → 패널 오픈, is-active
const card30 = root.querySelector('.po-card[data-key="qty30"] .po-card__btn');
card30.click();
assert(root.querySelector('.po-card[data-key="qty30"]').classList.contains('is-active'), '30개입 카드 is-active');
const panel = root.querySelector('.po-panel');
assert(!panel.hidden, '맛 선택 패널 열림');
assert(panel.querySelector('.po-panel__title').textContent === '30개입 맛 선택', '패널 타이틀');

// 2. 품절 맛 스테퍼 비활성
const soldRow = panel.querySelector('.po-flavor.is-soldout');
assert(soldRow && soldRow.querySelector('.po-stepper__btn--plus').disabled, '품절 맛 + 버튼 비활성');

// 3. 스테퍼로 30개 채우기 (10개입 단위 3회)
const plus = id => panel.querySelector(`.po-flavor[data-flavor="${id}"] .po-stepper__btn--plus`).click();
plus('tteok'); plus('hotyang'); plus('chipotle');
assert(panel.querySelector('.po-panel__counter').textContent === '(30/30개)', '총 수량 30/30');
const completeBtn = panel.querySelector('.po-panel__complete');
assert(!completeBtn.disabled, '선택완료 활성화');

// 초과 시도 → 툴팁
plus('honeysoy');
assert(!panel.querySelector('.po-panel__tooltip').hidden, '초과 시 툴팁 표시');
assert(panel.querySelector('.po-panel__counter').textContent === '(30/30개)', '초과 입력 차단');

// 4. 선택완료 → 카페24 행 생성 → 폴링 대기
completeBtn.click();
setTimeout(() => {
  const rows = document.querySelectorAll('#totalProducts .option_products tr');
  assert(rows.length === 1, '선택상품 행 1개 생성');
  assert(rows[0].textContent.includes('30개입') && !rows[0].querySelector('.option strong').textContent.includes('_1'), '행 표시에서 suffix 제거');
  assert(rows[0].textContent.includes('떡볶이맛(10개입)*1'), '맛 구성 문자열 표시');
  const st = window.PickOption.getState();
  assert(st.qty30.used === 1 && st.qty30.max === 2, 'getState: 30개입 used=1/max=2');
  assert(panel.hidden, '완료 후 패널 닫힘');

  // 5. 두 번째 담기 → maxed
  card30.click(); plus('tteok'); plus('tteok'); plus('galbi');
  panel.querySelector('.po-panel__complete').click();
  setTimeout(() => {
    assert(document.querySelectorAll('#totalProducts .option_products tr').length === 2, '두 번째 행 생성');
    const c30 = root.querySelector('.po-card[data-key="qty30"]');
    assert(c30.classList.contains('is-maxed'), '30개입 2회 후 is-maxed');
    // maxed 카드 클릭 → 토스트, 패널 안 열림
    card30.click();
    assert(panel.hidden, 'maxed 카드 클릭 시 패널 미오픈');
    assert(!document.querySelector('.po-toast').hidden, 'maxed 토스트 표시');

    // 6. 행 삭제 → MutationObserver rescan → maxed 해제
    document.querySelector('#totalProducts .option_products tr .del button').click();
    setTimeout(() => {
      const st2 = window.PickOption.getState();
      assert(st2.qty30.used === 1, '행 삭제 후 used=1 로 재동기화');
      assert(!c30.classList.contains('is-maxed'), 'is-maxed 해제');

      // 7. 구매 버튼 가드: 행이 있으므로 통과, 모두 삭제 후엔 토스트
      document.querySelectorAll('#totalProducts .del button').forEach(b => b.click());
      setTimeout(() => {
        document.querySelector('.btnBuy').click();
        assert(!document.querySelector('.po-toast').hidden && document.querySelector('.po-toast').textContent.includes('옵션을 선택해 주세요'), '미선택 구매 클릭 시 토스트');
        console.log('\nFinal state:', JSON.stringify(window.PickOption.getState()));
        console.log(process.exitCode ? 'SOME TESTS FAILED' : 'ALL TESTS PASSED');
      }, 50);
    }, 50);
  }, 400);
}, 400);
