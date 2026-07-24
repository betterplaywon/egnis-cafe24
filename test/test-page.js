const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('html/preview.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.matchMedia = window.matchMedia || (q => ({ matches: false, media: q, addListener(){}, removeListener(){} }));

const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];
window.eval(inline);
window.eval(fs.readFileSync('js/option_config.js', 'utf8'));
window.eval(fs.readFileSync('js/pick_option.js', 'utf8'));
window.eval(fs.readFileSync('js/page.js', 'utf8'));
document.dispatchEvent(new window.Event('DOMContentLoaded'));

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; } else console.log('PASS:', msg); };

// 페이지 구조
assert(document.querySelector('.hd__logo') && document.querySelector('.gnb'), '헤더/GNB 렌더');
assert(document.querySelectorAll('.pd-tabs__tab').length === 4, '탭 4개');
assert(document.querySelector('.pd__right .po-card'), '우측 패널에 골라담기 카드 렌더');
assert(document.querySelector('.pd-selected').dataset.empty === 'true', '초기: 선택한 옵션 영역 숨김');

// 탭 전환
const tab2 = document.querySelectorAll('.pd-tabs__tab')[1];
tab2.click();
assert(tab2.classList.contains('is-active'), '탭 전환 is-active');

// 골라담기 30개입 담기
const root = document.getElementById('pickOptionRoot');
root.querySelector('.po-card[data-key="qty30"] .po-card__btn').click();
const panel = root.querySelector('.po-panel');
const plus = id => panel.querySelector(`.po-flavor[data-flavor="${id}"] .po-stepper__btn--plus`).click();
plus('tteok'); plus('hotyang'); plus('chipotle');
panel.querySelector('.po-panel__complete').click();

setTimeout(() => {
  const rows = document.querySelectorAll('#totalProducts .pd-selected-item');
  assert(rows.length === 1, '선택상품 카드 1개 생성');
  assert(rows[0].querySelector('.option').textContent.trim().startsWith('30개입') &&
         !rows[0].querySelector('.option').childNodes[0].nodeValue.includes('_'), '카드 타이틀 suffix 제거');
  assert(rows[0].textContent.includes('치폴레마요맛'), '맛 구성 표시');

  setTimeout(() => {
    assert(document.querySelector('.pd-selected').dataset.empty === 'false', '선택한 옵션 영역 표시 전환');
    assert(document.querySelector('[data-pd-total-sets]').textContent === '1', '총 1세트');
    assert(document.querySelector('[data-pd-total-price]').textContent === '70,500', '총 70,500원');
    const msg = document.querySelector('.pd-freeship__msg');
    assert(msg.classList.contains('is-done') && msg.textContent.includes('무료배송 혜택 적용'), '4만원 초과 → 무료배송 적용 메시지');
    assert(document.querySelector('.pd-freeship__fill').style.width === '100%', '진행바 100%');

    // 수량 증가 → 합계 갱신
    rows[0].querySelector('.po-stepper__btn[data-d="1"]').click();
    setTimeout(() => {
      assert(document.querySelector('[data-pd-total-price]').textContent === '141,000', '수량 2 → 141,000원');

      // 행 삭제 → 빈 상태 복귀
      rows[0].querySelector('.pd-selected-item__del').click();
      setTimeout(() => {
        assert(document.querySelector('[data-pd-total-sets]').textContent === '0', '삭제 후 0세트');
        assert(!document.querySelector('.pd-freeship__msg').classList.contains('is-done') &&
               document.querySelector('.pd-freeship__msg').textContent.includes('40,000원'), '삭제 후 40,000원 더 담으면 문구 복귀');
        assert(document.querySelector('.pd-selected').dataset.empty === 'true', '선택한 옵션 영역 재숨김');

        // 시트 API (데스크톱 matchMedia=false 이므로 open 은 no-op 이어야 함)
        window.PDSheet.open();
        assert(!document.getElementById('pdOptionSheet').classList.contains('is-open'), 'PC 에서 시트 미동작');
        console.log(process.exitCode ? 'SOME TESTS FAILED' : 'ALL PAGE TESTS PASSED');
      }, 50);
    }, 50);
  }, 50);
}, 400);
