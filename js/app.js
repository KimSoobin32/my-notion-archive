// ==========================================
// 1. 성능 최적화 유틸리티 (INP 지표 개선용)
// ==========================================
const yieldToMain = () => {
  return new Promise((resolve) => {
    if ('scheduler' in window && 'yield' in window.scheduler) {
      window.scheduler.yield().then(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
};

// ==========================================
// 2. 카테고리 옵션 표준화 목록
// ==========================================
const CUISINE_TYPES = [
  '한식', '중식', '일식', '양식', '분식', '고깃집',
  '빵', '카페', '디저트', '햄버거', '마라탕', '샤브샤브',
  '멕시칸', '베트남', '덮밥', '샐러드', '호프', '기타'
];

// ==========================================
// 3. 노션 표 속성(Page Property) 파서
// ==========================================
const NotionParser = {
  getTitle(props) {
    for (const key in props) {
      if (props[key].type === 'title' && props[key].title?.length > 0) {
        return props[key].title[0].plain_text;
      }
    }
    return '이름 없음';
  },

  getText(prop) {
    if (!prop) return '';
    if (prop.type === 'rich_text' && prop.rich_text?.length > 0) {
      return prop.rich_text.map(t => t.plain_text).join('');
    }
    if (prop.type === 'select' && prop.select) {
      return prop.select.name;
    }
    if (prop.type === 'multi_select' && prop.multi_select) {
      return prop.multi_select.map(s => s.name).join(', ');
    }
    return '';
  },

  // Cuisine Type 추출 및 표준화 (치킨 -> 호프/기타 등 매핑)
  getCuisine(props) {
    const rawCuisine = this.getText(props['Cuisine']) || 
                       this.getText(props['cuisine']) || 
                       this.getText(props['종류']) || 
                       this.getText(props['카테고리']) || 
                       this.getText(props['음식종류']);

    if (!rawCuisine) return '기타';

    // 지정된 규격 범주에 맞는 지 체크
    const found = CUISINE_TYPES.find(type => rawCuisine.includes(type));
    if (found) return found;

    // 예외 매핑 예시 (치킨 -> 호프 또는 한식으로 자동 매핑 원할 시 조정 가능)
    if (rawCuisine.includes('치킨')) return '호프';

    return '기타';
  },

  getRating(prop) {
    if (!prop) return '';
    if (prop.type === 'number' && typeof prop.number === 'number') {
      return '⭐'.repeat(prop.number);
    }
    if (prop.type === 'select' && prop.select) return prop.select.name;
    return this.getText(prop);
  },

  getRatingValue(prop) {
    if (!prop) return 0;

    if (prop.type === 'number' && typeof prop.number === 'number') {
      return prop.number;
    }

    const rawStr = prop.type === 'select' && prop.select ? prop.select.name : this.getText(prop);
    if (!rawStr) return 0;

    const starMatches = rawStr.match(/[\u2B50\u2605]/g);
    if (starMatches) {
      return starMatches.length;
    }

    const numMatch = rawStr.match(/\d+(\.\d+)?/);
    if (numMatch) {
      return parseFloat(numMatch[0]);
    }

    return 0;
  },

  getDate(prop) {
    if (!prop || !prop.date) return '';
    return prop.date.start || '';
  }
};

// ==========================================
// 4. 노션 본문 블록(Block) HTML 변환 파서
// ==========================================
function parseBlockToHtml(block) {
  const type = block.type;
  const value = block[type];

  if (!value) return '';

  const getRichText = (richTextArr) => {
    if (!richTextArr) return '';
    return richTextArr.map(t => t.plain_text).join('');
  };

  let childrenHtml = '';
  if (block.children && block.children.length > 0) {
    childrenHtml = block.children.map(child => parseBlockToHtml(child)).join('');
  }

  switch (type) {
    case 'paragraph':
      return `<p style="margin-bottom:8px; line-height:1.6; color:#d8dee9;">${getRichText(value.rich_text)}</p>${childrenHtml}`;
      
    case 'heading_1':
      return `<h3 style="font-size:1.4rem; margin:16px 0 8px; color:#fff;">${getRichText(value.rich_text)}</h3>${childrenHtml}`;
      
    case 'heading_2':
      return `<h4 style="font-size:1.2rem; margin:14px 0 6px; color:#eceff4;">${getRichText(value.rich_text)}</h4>${childrenHtml}`;
      
    case 'heading_3':
      return `<h5 style="font-size:1rem; margin:12px 0 4px; color:#e5e9f0;">${getRichText(value.rich_text)}</h5>${childrenHtml}`;
      
    case 'bulleted_list_item':
      return `<li style="margin-left:20px; color:#d8dee9; line-height:1.6;">${getRichText(value.rich_text)}</li>${childrenHtml}`;
      
    case 'numbered_list_item':
      return `<li style="margin-left:20px; color:#d8dee9; line-height:1.6;">${getRichText(value.rich_text)}</li>${childrenHtml}`;
      
    case 'toggle':
      return `
        <details style="margin: 8px 0; background: #242933; border-radius: 8px; padding: 10px 14px;">
          <summary style="cursor: pointer; font-weight: bold; color: #88c0d0;">${getRichText(value.rich_text)}</summary>
          <div style="margin-top: 10px; padding-left: 10px;">${childrenHtml}</div>
        </details>
      `;

    case 'callout':
      const emoji = value.icon?.type === 'emoji' ? value.icon.emoji : '💡';
      return `
        <div style="background: #232831; border-left: 4px solid #88c0d0; padding: 12px 16px; border-radius: 6px; margin: 12px 0;">
          <div style="font-weight: bold; margin-bottom: 6px;">${emoji} ${getRichText(value.rich_text)}</div>
          <div>${childrenHtml}</div>
        </div>
      `;

    case 'image':
      const src = value.type === 'external' ? value.external.url : value.file.url;
      return `<img src="${src}" alt="노션 이미지" style="max-width:100%; border-radius:8px; margin:12px 0;" />${childrenHtml}`;
      
    case 'divider':
      return `<hr style="border:none; border-top:1px solid #2e3440; margin:16px 0;" />`;
      
    default:
      return childrenHtml;
  }
}

// ==========================================
// 5. 메인 애플리케이션 상태
// ==========================================
let rawNotionData = [];
let currentCuisineFilter = 'ALL';
let currentSortType = 'latest';

async function init() {
  const grid = document.getElementById('restaurant-grid');

  try {
    const res = await fetch('/api/notion');
    const data = await res.json();

    rawNotionData = (Array.isArray(data) ? data : []).map((item, index) => ({
      ...item,
      originalIndex: index
    }));

    console.log('=== 🚀 노션 API 원본 데이터 ===', rawNotionData);

    if (rawNotionData.length === 0) {
      grid.innerHTML = '<div class="loading">등록된 맛집 데이터가 없습니다.</div>';
      return;
    }

    // 초기 카드 렌더링 (전체 필터 + 최신순)
    applyFilterAndSort();

    setupCuisineFilterEvents();
    setupSortEvent();
    setupModalEvents();

  } catch (err) {
    console.error('데이터 로딩 오류:', err);
    grid.innerHTML = '<div class="loading">데이터를 불러오지 못했습니다. F12 콘솔을 확인해 주세요.</div>';
  }
}

// 필터와 정렬을 함께 적용하는 핵심 함수
function applyFilterAndSort() {
  // 1. Cuisine 필터링
  let filtered = rawNotionData.filter(item => {
    if (currentCuisineFilter === 'ALL') return true;
    const cuisine = NotionParser.getCuisine(item.properties);
    return cuisine === currentCuisineFilter;
  });

  // 2. 정렬 적용
  switch (currentSortType) {
    case 'oldest':
      filtered.sort((a, b) => {
        const dateA = NotionParser.getDate(a.properties['방문일']);
        const dateB = NotionParser.getDate(b.properties['방문일']);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateA) - new Date(dateB);
      });
      break;

    case 'rating-desc':
      filtered.sort((a, b) => {
        const ratingA = NotionParser.getRatingValue(a.properties['Rating'] || a.properties['평점'] || a.properties['별점']);
        const ratingB = NotionParser.getRatingValue(b.properties['Rating'] || b.properties['평점'] || b.properties['별점']);
        return ratingB - ratingA;
      });
      break;

    case 'rating-asc':
      filtered.sort((a, b) => {
        const ratingA = NotionParser.getRatingValue(a.properties['Rating'] || a.properties['평점'] || a.properties['별점']);
        const ratingB = NotionParser.getRatingValue(b.properties['Rating'] || b.properties['평점'] || b.properties['별점']);
        return ratingA - ratingB;
      });
      break;

    case 'latest':
    default:
      filtered.sort((a, b) => {
        const dateA = NotionParser.getDate(a.properties['방문일']);
        const dateB = NotionParser.getDate(b.properties['방문일']);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateB) - new Date(dateA);
      });
      break;  }

  renderCards(filtered);
}

// 카드 목록 렌더링
function renderCards(dataList) {
  const grid = document.getElementById('restaurant-grid');
  grid.innerHTML = '';

  if (dataList.length === 0) {
    grid.innerHTML = '<div class="loading" style="grid-column: 1/-1;">해당 카테고리의 맛집이 없습니다.</div>';
    return;
  }

  dataList.forEach((item) => {
    const card = createCardElement(item, item.originalIndex);
    grid.appendChild(card);
  });
}

// 카테고리 필터 버튼 이벤트 설정
function setupCuisineFilterEvents() {
  const filterBar = document.getElementById('cuisine-filter-bar');
  if (!filterBar) return;

  filterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.cuisine-btn');
    if (!btn) return;

    // Active 클래스 갱신
    document.querySelectorAll('.cuisine-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // 선택된 카테고리 적용 후 필터링
    currentCuisineFilter = btn.dataset.cuisine;
    applyFilterAndSort();
  });
}

// 정렬 드롭다운 이벤트
function setupSortEvent() {
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSortType = e.target.value;
      applyFilterAndSort();
    });
  }
}

// 카드 DOM 생성
function createCardElement(item, originalIndex) {
  const props = item.properties || {};

  const icon = item.icon?.type === 'emoji' ? item.icon.emoji : '🍽️';
  const title = NotionParser.getTitle(props);
  const cuisine = NotionParser.getCuisine(props);
  const menu = NotionParser.getText(props['매뉴']) || NotionParser.getText(props['메뉴']);
  const city = NotionParser.getText(props['City']) || NotionParser.getText(props['도시']);
  const rating = NotionParser.getRating(props['Rating'] || props['평점'] || props['별점']);
  const comment = NotionParser.getText(props['Comment']) || NotionParser.getText(props['코멘트']);
  const visitDate = NotionParser.getDate(props['방문일']);

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div>
      <div class="card-header">
        <span class="icon">${icon}</span>
        <span class="title">${title}</span>
      </div>

      <div class="tags">
        ${cuisine ? `<span class="tag cuisine">🍱 ${cuisine}</span>` : ''}
        ${city ? `<span class="tag city">📍 ${city}</span>` : ''}
        ${menu ? `<span class="tag">🍴 ${menu}</span>` : ''}
      </div>

      ${rating ? `<div class="rating">${rating.includes('⭐') ? rating : '⭐ ' + rating}</div>` : ''}
      ${comment ? `<div class="preview-comment">${comment}</div>` : ''}
    </div>

    ${visitDate ? `<div class="date">방문일: ${visitDate}</div>` : ''}
  `;

  card.addEventListener('click', () => openDetailModal(originalIndex));
  return card;
}

// 상세 모달 열기
async function openDetailModal(index) {
  const item = rawNotionData.find(d => d.originalIndex === index);
  if (!item) return;

  const props = item.properties || {};
  const icon = item.icon?.type === 'emoji' ? item.icon.emoji : '🍽️';
  const title = NotionParser.getTitle(props);
  const cuisine = NotionParser.getCuisine(props);
  const menu = NotionParser.getText(props['매뉴']) || NotionParser.getText(props['메뉴']);
  const city = NotionParser.getText(props['City']) || NotionParser.getText(props['도시']);
  const rating = NotionParser.getRating(props['Rating'] || props['평점'] || props['별점']);
  const visitDate = NotionParser.getDate(props['방문일']);
  const notionUrl = item.public_url || item.url;

  const modalBody = document.getElementById('modal-body');

  modalBody.innerHTML = `
    <div class="modal-title-group">
      <span class="icon">${icon}</span>
      <h2 class="modal-title">${title}</h2>
    </div>

    <div class="tags">
      ${cuisine ? `<span class="tag cuisine">🍱 ${cuisine}</span>` : ''}
      ${city ? `<span class="tag city">📍 ${city}</span>` : ''}
      ${menu ? `<span class="tag">🍴 ${menu}</span>` : ''}
    </div>

    ${rating ? `<div class="rating" style="font-size:1.2rem; margin-top:8px;">${rating.includes('⭐') ? rating : '⭐ ' + rating}</div>` : ''}

    <div class="modal-section">
      <div class="modal-section-title">상세 리뷰 본문</div>
      <div id="modal-content-area" class="modal-comment">
        <p style="color:#9ca3af;">노션 본문 글을 불러오는 중...</p>
      </div>
    </div>

    ${visitDate ? `<div class="date" style="margin-top:16px; text-align:left;">🗓️ 방문일: ${visitDate}</div>` : ''}
    ${notionUrl ? `<a href="${notionUrl}" target="_blank" rel="noopener" class="modal-notion-link">🔗 노션에서 원본 보기 ↗</a>` : ''}
  `;

  document.getElementById('modal-overlay').classList.add('active');

  await yieldToMain();

  try {
    const res = await fetch(`/api/blocks?pageId=${item.id}`);
    const blocks = await res.json();

    const contentArea = document.getElementById('modal-content-area');

    if (!Array.isArray(blocks) || blocks.length === 0) {
      contentArea.innerHTML = '<p style="color:#6c7a96;">본문에 작성된 내용이 없습니다.</p>';
      return;
    }

    let htmlContent = '';
    for (let i = 0; i < blocks.length; i++) {
      htmlContent += parseBlockToHtml(blocks[i]);

      if (i > 0 && i % 10 === 0) {
        await yieldToMain();
      }
    }

    contentArea.innerHTML = htmlContent || '<p style="color:#6c7a96;">표시할 수 있는 본문 요소가 없습니다.</p>';

  } catch (err) {
    console.error('본문 로딩 실패:', err);
    document.getElementById('modal-content-area').innerHTML = '<p style="color:#bf616a;">본문 글을 불러오지 못했습니다.</p>';
  }
}

// 모달 이벤트 핸들러
function setupModalEvents() {
  const overlay = document.getElementById('modal-overlay');
  const closeBtn = document.getElementById('modal-close');

  const closeModal = () => overlay.classList.remove('active');

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

// 앱 시작
init();
