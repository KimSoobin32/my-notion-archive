// ==========================================
// 1. 성능 최적화 유틸리티 (INP 지표 개선용)
// 메인 스레드가 UI 업데이트를 즉시 처리할 수 있도록 제어권을 양보합니다.
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

  getCuisine(props) {
    const prop = props['Cuisine Type'] || 
                 props['Cuisine'] || 
                 props['cuisine'] || 
                 props['종류'] || 
                 props['카테고리'] || 
                 props['음식종류'];

    if (!prop) return '기타';

    let rawValue = '';

    if (prop.type === 'select' && prop.select) {
      rawValue = prop.select.name;
    } else if (prop.type === 'multi_select' && prop.multi_select?.length > 0) {
      rawValue = prop.multi_select[0].name;
    } else {
      rawValue = this.getText(prop);
    }

    if (!rawValue) return '기타';

    const matched = CUISINE_TYPES.find(type => rawValue.trim() === type || rawValue.includes(type));
    return matched || '기타';
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
// (blocks.js에 함수가 없는 경우를 위한 자체 렌더링 대비)
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
// 5. 메인 애플리케이션 상태 및 필터/정렬
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

    if (rawNotionData.length === 0) {
      if (grid) grid.innerHTML = '<div class="loading">등록된 맛집 데이터가 없습니다.</div>';
      return;
    }

    renderFeaturedSection();
    applyFilterAndSort();

    setupCuisineFilterEvents();
    setupSortEvent();
    setupModalEvents();

  } catch (err) {
    console.error('데이터 로딩 오류:', err);
    if (grid) grid.innerHTML = '<div class="loading">데이터를 불러오지 못했습니다. 콘솔을 확인해 주세요.</div>';
  }
}

// 상단 추천 맛집 (Rating 5점) 섹션 렌더링 및 캐러셀 스크립트 연결
function renderFeaturedSection() {
  const container = document.getElementById('featured-container');
  const track = document.getElementById('featured-track');
  
  if (!container || !track) return;

  const featuredList = rawNotionData.filter(item => {
    const ratingVal = NotionParser.getRatingValue(item.properties['Rating'] || item.properties['평점'] || item.properties['별점']);
    return ratingVal >= 5;
  });

  if (featuredList.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  track.innerHTML = '';

  featuredList.forEach(item => {
    const card = createCardElement(item, item.originalIndex, true);
    track.appendChild(card);
  });

  setupFeaturedCarouselControls();
}

// 추천 캐러셀 버튼 클릭 및 마우스 드래그 스크롤 이벤트 연결
function setupFeaturedCarouselControls() {
  const slider = document.getElementById('featured-slider');
  const prevBtn = document.getElementById('featured-prev');
  const nextBtn = document.getElementById('featured-next');

  if (!slider) return;

  const scrollStep = 300;

  if (prevBtn) {
    prevBtn.onclick = () => {
      slider.scrollBy({ left: -scrollStep, behavior: 'smooth' });
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      slider.scrollBy({ left: scrollStep, behavior: 'smooth' });
    };
  }

  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;
  let isDragging = false;

  slider.onmousedown = (e) => {
    isDown = true;
    isDragging = false;
    slider.classList.add('grabbing');
    startX = e.pageX - slider.offsetLeft;
    scrollLeft = slider.scrollLeft;
  };

  slider.onmouseleave = () => {
    isDown = false;
    slider.classList.remove('grabbing');
  };

  slider.onmouseup = () => {
    isDown = false;
    slider.classList.remove('grabbing');
  };

  slider.onmousemove = (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - slider.offsetLeft;
    const walk = (x - startX) * 1.5;
    
    if (Math.abs(walk) > 5) {
      isDragging = true;
    }
    slider.scrollLeft = scrollLeft - walk;
  };

  slider.onclick = (e) => {
    if (isDragging) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
}

// 필터링과 정렬을 통합 실행하는 함수
function applyFilterAndSort() {
  let filtered = rawNotionData.filter(item => {
    if (currentCuisineFilter === 'ALL') return true;
    const cuisine = NotionParser.getCuisine(item.properties);
    return cuisine === currentCuisineFilter;
  });

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
      break;
  }

  renderCards(filtered);
}

// 카드 목록 렌더링
function renderCards(dataList) {
  const grid = document.getElementById('restaurant-grid');
  if (!grid) return;

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

// 카테고리 필터 버튼 이벤트 연결
function setupCuisineFilterEvents() {
  const filterBar = document.getElementById('cuisine-filter-bar');
  if (!filterBar) return;

  filterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.cuisine-btn');
    if (!btn) return;

    document.querySelectorAll('.cuisine-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentCuisineFilter = btn.dataset.cuisine;
    applyFilterAndSort();
  });
}

// 정렬 드롭다운 이벤트 연결
function setupSortEvent() {
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSortType = e.target.value;
      applyFilterAndSort();
    });
  }
}

// 카드 DOM 요소 생성
function createCardElement(item, originalIndex, isFeatured = false) {
  const props = item.properties || {};

  const icon = item.icon?.type === 'emoji' ? item.icon.emoji : '🍽️';
  const title = NotionParser.getTitle(props);
  const cuisine = NotionParser.getCuisine(props);
  const menu = NotionParser.getText(props['매뉴']) || NotionParser.getText(props['메뉴']);
  const city = NotionParser.getText(props['City']) || NotionParser.getText(props['도시']);
  const ratingProp = props['Rating'] || props['평점'] || props['별점'];
  const rating = NotionParser.getRating(ratingProp);
  const ratingVal = NotionParser.getRatingValue(ratingProp);
  const comment = NotionParser.getText(props['Comment']) || NotionParser.getText(props['코멘트']);
  const visitDate = NotionParser.getDate(props['방문일']);

  const isFiveStar = ratingVal >= 5;

  const card = document.createElement('div');
  card.className = `card ${isFiveStar || isFeatured ? 'featured-card' : ''}`;
  
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${title}, ${cuisine || '음식점'}, 평점 ${rating || '없음'}`);

  card.innerHTML = `
    ${isFiveStar ? '<div class="featured-badge">👑 MUST VISIT</div>' : ''}
    <div>
      <div class="card-header">
        <span class="icon" aria-hidden="true">${icon}</span>
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
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDetailModal(originalIndex);
    }
  });

  return card;
}

// 상세 모달 열기 (blocks.js 연동 기능 포함)
async function openDetailModal(index) {
  const item = rawNotionData.find(d => d.originalIndex === index);
  if (!item) return;

  const modalBody = document.getElementById('modal-body');
  if (!modalBody) {
    console.error('modal-body 엘리먼트를 찾을 수 없습니다.');
    return;
  }

  const props = item.properties || {};
  const icon = item.icon?.type === 'emoji' ? item.icon.emoji : '🍽️';
  const title = NotionParser.getTitle(props);
  const cuisine = NotionParser.getCuisine(props);
  const menu = NotionParser.getText(props['매뉴']) || NotionParser.getText(props['메뉴']);
  const city = NotionParser.getText(props['City']) || NotionParser.getText(props['도시']);
  const rating = NotionParser.getRating(props['Rating'] || props['평점'] || props['별점']);
  const visitDate = NotionParser.getDate(props['방문일']);
  const notionUrl = item.public_url || item.url;

  modalBody.innerHTML = `
    <div class="modal-title-group">
      <span class="icon" aria-hidden="true">${icon}</span>
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
    
  `;

  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('active');

  const closeBtn = document.getElementById('modal-close');
  if (closeBtn) closeBtn.focus();

  await yieldToMain();

  const contentArea = document.getElementById('modal-content-area');

  // blocks.js 에 별도 모달 렌더링 함수가 정의되어 있는 경우 이를 우선 호출
  if (typeof window.renderNotionBlocks === 'function') {
    try {
      await window.renderNotionBlocks(item.id, contentArea);
      return;
    } catch (err) {
      console.warn('blocks.js renderNotionBlocks 실행 중 오류 발생, 자체 API 파싱으로 대체합니다.', err);
    }
  }

  // 기본 노션 본문 블록 API 렌더링 처리
  try {
    const res = await fetch(`/api/blocks?pageId=${item.id}`);
    const blocks = await res.json();

    if (!Array.isArray(blocks) || blocks.length === 0) {
      if (contentArea) contentArea.innerHTML = '<p style="color:#6c7a96;">본문에 작성된 내용이 없습니다.</p>';
      return;
    }

    let htmlContent = '';
    for (let i = 0; i < blocks.length; i++) {
      htmlContent += parseBlockToHtml(blocks[i]);

      if (i > 0 && i % 10 === 0) {
        await yieldToMain();
      }
    }

    if (contentArea) {
      contentArea.innerHTML = htmlContent || '<p style="color:#6c7a96;">표시할 수 있는 본문 요소가 없습니다.</p>';
    }

  } catch (err) {
    console.error('본문 로딩 실패:', err);
    if (contentArea) contentArea.innerHTML = '<p style="color:#bf616a;">본문 글을 불러오지 못했습니다.</p>';
  }
}

// 모달 이벤트 핸들러
function setupModalEvents() {
  const overlay = document.getElementById('modal-overlay');
  const closeBtn = document.getElementById('modal-close');

  const closeModal = () => {
    if (overlay) overlay.classList.remove('active');
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay?.classList.contains('active')) {
      closeModal();
    }
  });
}

// 애플리케이션 시작
init();
