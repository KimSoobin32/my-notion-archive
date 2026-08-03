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
// 2. 노션 표 속성(Page Property) 파서
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

  getRating(prop) {
    if (!prop) return '';
    if (prop.type === 'number' && typeof prop.number === 'number') {
      return '⭐'.repeat(prop.number);
    }
    if (prop.type === 'select' && prop.select) return prop.select.name;
    return this.getText(prop);
  },

  // 별점 이모지("⭐⭐⭐") 및 숫자를 수치(0~5)로 정확히 파싱하는 정렬용 로직
  getRatingValue(prop) {
    if (!prop) return 0;

    // 1. 노션 타입이 숫자형일 때
    if (prop.type === 'number' && typeof prop.number === 'number') {
      return prop.number;
    }

    // 2. Select 또는 Rich Text 문자열에서 별점 읽기
    const rawStr = prop.type === 'select' && prop.select ? prop.select.name : this.getText(prop);
    if (!rawStr) return 0;

    // 이모지 ⭐ (U+2B50) 및 ★ (U+2605) 세기
    const starMatches = rawStr.match(/[\u2B50\u2605]/g);
    if (starMatches) {
      return starMatches.length;
    }

    // "3점", "3" 같이 숫자로 전달되었을 경우
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
// 3. 노션 본문 블록(Block) HTML 변환 파서
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
// 4. 메인 애플리케이션 상태 및 정렬 로직
// ==========================================
let rawNotionData = [];

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

    // 기본 정렬: 최신 방문순 적용
    sortData('latest');

    setupSortEvent();
    setupModalEvents();

  } catch (err) {
    console.error('데이터 로딩 오류:', err);
    grid.innerHTML = '<div class="loading">데이터를 불러오지 못했습니다. F12 콘솔을 확인해 주세요.</div>';
  }
}

// 카드 목록 렌더링 함수
function renderCards(dataList) {
  const grid = document.getElementById('restaurant-grid');
  grid.innerHTML = '';

  dataList.forEach((item) => {
    const card = createCardElement(item, item.originalIndex);
    grid.appendChild(card);
  });
}

// 정렬 알고리즘
function sortData(sortType) {
  const sorted = [...rawNotionData];

  switch (sortType) {
    case 'oldest':
      // 오래된 방문순
      sorted.sort((a, b) => {
        const dateA = NotionParser.getDate(a.properties['방문일']);
        const dateB = NotionParser.getDate(b.properties['방문일']);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateA) - new Date(dateB);
      });
      break;

    case 'rating-desc':
      // 별점 높은 순
      sorted.sort((a, b) => {
        const ratingA = NotionParser.getRatingValue(a.properties['Rating'] || a.properties['평점'] || a.properties['별점']);
        const ratingB = NotionParser.getRatingValue(b.properties['Rating'] || b.properties['평점'] || b.properties['별점']);
        return ratingB - ratingA;
      });
      break;

    case 'rating-asc':
      // 별점 낮은 순
      sorted.sort((a, b) => {
        const ratingA = NotionParser.getRatingValue(a.properties['Rating'] || a.properties['평점'] || a.properties['별점']);
        const ratingB = NotionParser.getRatingValue(b.properties['Rating'] || b.properties['평점'] || b.properties['별점']);
        return ratingA - ratingB;
      });
      break;

    case 'latest':
    default:
      // 최신 방문순 (방문일 없으면 맨 뒤로)
      sorted.sort((a, b) => {
        const dateA = NotionParser.getDate(a.properties['방문일']);
        const dateB = NotionParser.getDate(b.properties['방문일']);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateB) - new Date(dateA);
      });
      break;
  }

  renderCards(sorted);
}

// 정렬 드롭다운 이벤트
function setupSortEvent() {
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      sortData(e.target.value);
    });
  }
}

// 카드 DOM 생성
function createCardElement(item, originalIndex) {
  const props = item.properties || {};

  const icon = item.icon?.type === 'emoji' ? item.icon.emoji : '🍽️';
  const title = NotionParser.getTitle(props);
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
