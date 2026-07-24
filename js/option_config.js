/* ============================================================
 * option_config.js — 골라담기 UI 외부 설정 파일
 * ------------------------------------------------------------
 * 이 파일만 수정하면 문구/뱃지/가격표시/추가 가능 횟수/맛 목록을
 * 바꿀 수 있습니다. 로직(pick_option.js)은 수정하지 마세요.
 *
 * ★ 로드 순서: 반드시 option_config.js → pick_option.js
 * ============================================================ */
window.PICK_OPTION_CONFIG = {

  /* ----------------------------------------------------------
   * 1) 개입수 카드 (옵션 선택 영역)
   * ----------------------------------------------------------
   * key        : 내부 상태 키 (PickOption.getState() 의 키)
   * label      : 카드에 표시되는 이름. 카페24 옵션값의 "suffix 앞부분"과
   *              정확히 일치해야 합니다. (예: 옵션값 "30개입_1" → label "30개입")
   * count      : 총 개수 (맛 선택 합계 기준)
   * price      : 표시 가격 (원). 실제 결제 금액은 카페24 품목/추가금액이 기준이며
   *              여기 값은 "화면 표시용" 입니다. 관리자 설정과 반드시 일치시키세요.
   * discount   : 할인율 표시 텍스트
   * unitPrice  : "1개 : n원" 표시 텍스트
   * badge      : 카드 우측 뱃지 (없으면 null)
   *              { text: '...', type: 'primary' | 'danger' }
   * maxAdd     : 이 개입수를 선택상품 목록에 담을 수 있는 최대 횟수.
   *              카페24 관리자에 등록한 suffix 개수(_1, _2 ...)와 같아야 합니다.
   *              예) maxAdd 2 → 옵션값 "30개입_1", "30개입_2" 두 개 등록
   * ---------------------------------------------------------- */
  counts: [
    {
      key: 'qty10',
      label: '10개입',
      count: 10,
      price: 24700,
      discount: '25% 할인',
      unitPrice: '1개 : 2,470원',
      badge: null,
      maxAdd: 2
    },
    {
      key: 'qty30',
      label: '30개입',
      count: 30,
      price: 70500,
      discount: '29% 할인',
      unitPrice: '1개 : 2,350원',
      badge: { text: '가장 많이 사요', type: 'primary' },
      maxAdd: 2
    },
    {
      key: 'qty50',
      label: '50개입',
      count: 50,
      price: 111500,
      discount: '32% 할인',
      unitPrice: '1개 : 2,230원',
      badge: null,
      maxAdd: 2
    },
    {
      key: 'qty100',
      label: '100개입',
      count: 100,
      price: 196000,
      discount: '41% 할인',
      unitPrice: '1개 : 1,960원',
      badge: { text: '최대할인', type: 'danger' },
      maxAdd: 1
    }
  ],

  /* ----------------------------------------------------------
   * 2) 맛(플레이버) 목록 — "N개입 맛 선택" 패널
   * ----------------------------------------------------------
   * unitSize  : 맛 1단위당 개수. 스테퍼 1 = 10개입 1팩
   * name      : 표시명 (선택상품 요약 문자열에도 사용)
   * meta      : 부가 정보 표시 (kcal, 단백질)
   * img       : 썸네일 경로. 카페24 파일업로더(/web/upload/pickoption/...)에
   *             올린 뒤 경로를 맞춰 주세요. 없으면 회색 박스로 표시됩니다.
   * badge     : 이름 위 강조 문구 (예: '신제품 출시!'), 없으면 null
   * soldOut   : true 면 "품절" 처리되어 선택 불가(회색/비활성)
   * ---------------------------------------------------------- */
  unitSize: 10,
  flavors: [
    { id: 'tteok',    name: '떡볶이맛(10개입)',     meta: '130kcal, 단백질 18g', img: '/web/upload/pickoption/assets/flavor_tteok.png',    badge: '신제품 출시!', soldOut: false },
    { id: 'buttercurry', name: '버터치킨커리맛(10개입)', meta: '105kcal, 단백질 18g', img: '/web/upload/pickoption/assets/flavor_buttercurry.png', badge: null, soldOut: true },
    { id: 'hotyang',  name: '핫양념치킨맛 (10개입)',  meta: '125kcal, 단백질 19g', img: '/web/upload/pickoption/assets/flavor_hotyang.png',  badge: null, soldOut: false },
    { id: 'chipotle', name: '치폴레마요맛 (10개입)',  meta: '125kcal, 단백질 18g', img: '/web/upload/pickoption/assets/flavor_chipotle.png', badge: null, soldOut: false },
    { id: 'honeysoy', name: '허니소이맛 (10개입)',   meta: '125kcal, 단백질 18g', img: '/web/upload/pickoption/assets/flavor_honeysoy.png', badge: null, soldOut: false },
    { id: 'galbi',    name: '왕갈비맛 (10개입)',     meta: '125kcal, 단백질 18g', img: '/web/upload/pickoption/assets/flavor_galbi.png',    badge: null, soldOut: false }
    /* 맛을 추가하려면 위 형식 그대로 객체를 계속 추가하면 됩니다. (최대 18종) */
  ],

  /* ----------------------------------------------------------
   * 3) 문구 (토스트/툴팁/타이틀)
   * {n} {label} {count} {remain} {selected} 는 자동 치환됩니다.
   * ---------------------------------------------------------- */
  texts: {
    sectionTitle: '옵션 선택 (필수)',
    flavorTitle: '{label} 맛 선택',        // 예: "30개입 맛 선택"
    totalLabel: '총 수량',
    totalCounter: '({selected}/{count}개)',
    completeBtn: '선택완료',
    tooltipRemain: '현재 {selected}개 선택됨 · 옵션을 <em>{remain}개 더 선택</em>해 주세요',
    toastAdded: '선택한 상품이 추가되었습니다',
    toastNeedOption: '옵션을 선택해 주세요',
    toastMaxed: '{label}은(는) 최대 {max}회까지 담을 수 있어요',
    toastSoldOut: '{label}은(는) 현재 선택할 수 없어요',
    soldOutBadge: '품절'
  },

  /* ----------------------------------------------------------
   * 4) 카페24 연동 셀렉터 — 스킨에 따라 이 부분만 조정하면 됩니다.
   * 각 항목은 후보 셀렉터 배열이며, 페이지에 존재하는 첫 번째를 사용합니다.
   * ---------------------------------------------------------- */
  cafe24: {
    /* 개입수 옵션을 담고 있는 기본 <select>.
     * 텍스트버튼형 옵션도 내부적으로 select 를 갖고 있습니다. */
    optionSelect: [
      'select[option_select_element]',
      '.xans-product-option select.ProductOption0',
      '#product_option_id1'
    ],
    /* 옵션 선택 시 카페24가 행을 추가하는 "선택상품 목록" 컨테이너.
     * ★ 기본 스킨의 #totalProducts 는 <tbody> 가 여러 개이고 행은 "마지막"
     *   tbody 에 추가되므로, tbody 를 직접 지정하지 말고 #totalProducts 를
     *   통째로 컨테이너로 씁니다. (tbody 를 지정하면 첫 tbody 를 잡아 빗나감) */
    productRows: [
      '#totalProducts',
      '#totalProducts tbody.option_products',
      '#totalProducts .option_products',
      '.xans-product-total',
      '.total_products ul',
      '.option_box'
    ],
    /* 목록 내 개별 행 (위 컨테이너 기준 상대 셀렉터) */
    rowItem: 'tr, li',
    /* 행 안에서 옵션명이 표시되는 요소 (표시 정리용 · 없으면 행 전체 텍스트 사용)
     * 기본 스킨 행 구조: <p class="product">상품명<br><span>옵션</span></p> */
    rowOptionText: 'p.product, .option, .product-name, p[class*="name"]',
    /* 카페24 "추가입력(자유입력)" 칸에 맛 구성 문자열을 기록할지 여부.
     * 관리자 > 상품 옵션에 텍스트형 추가입력 옵션이 있어야 동작합니다.
     * 없어도 UI 는 정상 동작하며, 맛 구성은 행에 표시만 됩니다. */
    writeFlavorToExtraInput: true,
    extraInputSelector: 'textarea, input[type="text"]',
    /* 구매/장바구니 버튼 — 옵션 미선택 시 토스트를 띄우기 위한 감지용.
     * 카페24 기본 검증 로직은 그대로 두고, 앞단에서 토스트만 추가합니다.
     * ★ 기본 스킨은 바로구매 a.btnSubmit / 장바구니 a.btnNormal.sizeL 인데
     *   "관심상품등록"도 같은 a.btnNormal.sizeL 이라 아래 buyButtonsExclude 로
     *   걸러냅니다. */
    buyButtons: [
      '.xans-product-action a.btnSubmit, .xans-product-action a.btnNormal.sizeL',
      '.xans-product-action a[href*="Buy"], .xans-product-action .btnSubmit',
      '#actionButton a, #actionButton button',
      '.ec-product-button-buy, .btn_buy, .btnBuy'
    ],
    /* buyButtons 에 걸렸지만 구매 흐름이 아닌 버튼 (텍스트/onclick 부분일치) */
    buyButtonsExclude: ['관심상품', 'wishlist', '추천메일', 'recommend', '상품조르기'],
    /* 기본 옵션 UI(텍스트버튼/셀렉트) 숨김 처리 대상.
     * display:none 만 적용하며 DOM/이벤트는 삭제하지 않습니다. */
    hideDefaultOption: [
      '.xans-product-option .xans-product-fileoption ~ tr',
      '.xans-product-option table.xans-product-option tr.xans-record-'
    ]
  },

  /* ----------------------------------------------------------
   * 5) 모바일 동작
   * mode: 'sheet'  → 개입수 카드 클릭 시 맛 선택을 바텀시트 모달로 표시 (시안 기준)
   *       'inline' → PC 처럼 옵션 영역에 바로 노출
   * bottomOffset: 하단 고정 구매바 높이(px). 시트/패널이 구매 버튼과
   *               겹치지 않도록 padding 으로 확보합니다.
   * ---------------------------------------------------------- */
  mobile: {
    breakpoint: 768,
    mode: 'sheet',
    bottomOffset: 76
  },

  /* 디버그 로그 (콘솔 [pick-option] prefix) */
  debug: false
};
