// 노션 데이터 안전 추출 유틸리티
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
    if (prop.type === 'number' && prop.number) return '★'.repeat(prop.number);
    if (prop.type === 'select' && prop.select) return prop.select.name;
    return this.getText(prop);
  },

  getDate(prop) {
    if (!prop || !prop.date) return '';
    return prop.date.start || '';
  }
};

// 노션 블록(본문 요소)을 HTML 태그로 변환해주는 파서
function parseBlockToHtml(block) {
  const type = block.type;
  const value = block[type];

  if (!value) return '';

  // 텍스트 조각들을 합치는 함수
  const getRichText = (richTextArr) => {
    if (!richTextArr) return '';
    return richTextArr.map(t => t.plain_text).join('');
  };

  switch (type) {
    case 'paragraph':
      return `<p style="margin-bottom:8px; line-height:1.6; color:#d8dee9;">${getRichText(value.rich_text)}</p>`;
    case 'heading_1':
      return `<h3 style="font-size:1.4rem; margin:16px 0 8px; color:#fff;">${getRichText(value.rich_text)}</h3>`;
    case 'heading_2':
      return `<h4 style="font-size:1.2rem; margin:14px 0 6px; color:#eceff4;">${getRichText(value.rich_text)}</h4>`;
    case 'heading_3':
      return `<h5 style="font-size:1rem; margin:12px 0 4px; color:#e5e9f0;">${getRichText(value.rich_text)}</h5>`;
    case 'bulleted_list_item':
      return `<li style="margin-left:20px; color:#d8dee9;">${getRichText(value.rich_text)}</li>`;
    case 'numbered_list_item':
      return `<li style="margin-left:20px; color:#d8dee9;">${getRichText(value.rich_text)}</li>`;
    case 'image':
      const src = value.type === 'external' ? value.external.url : value.file.url;
      return `<img src="${src}" alt="노션 이미지" style="max-width:100%; border-radius:8px; margin:12px 0;" />`;
    case 'divider':
      return `<hr style="border:none; border-top:1px solid #2e3440; margin:16px 0;" />`;
    default:
      return '';
  }
}

let rawNotionData = [];

async function init() {
  const grid = document.getElementById('restaurant-grid');

  try {
    const res = await fetch('/api/notion');
    const data = await res.json();
    rawNotionData = data;

    console.log('=== 🚀 노션 API 원본 데이터 ===', rawNotionData);

    grid.innerHTML = '';

    if (!Array.isArray(data) || data.length === 0) {
      grid.innerHTML = '<div class="loading">등록된 맛집 데이터가 없습니다.</div>';
      return;
    }

    data.forEach((item, index) => {
      const card = createCardElement(item, index);
      grid.appendChild(card);
    });

    setupModalEvents();

  } catch (err) {
    console.error('데이터 로딩 오류:', err);
    grid.innerHTML = '<div class="loading">데이터를 불러오지 못했습니다.</div>';
  }
}

function createCardElement(item, index) {
  const props = item.properties || {};

  const icon = item.icon?.type === 'emoji' ? item.icon.emoji : '🍽️';
  const title = NotionParser.getTitle(props);
  const menu = NotionParser.getText(props['매뉴']) || NotionParser.getText(props['메뉴']);
  const city = NotionParser.getText(props['City']) || NotionParser.getText(props['도시']);
  const rating = NotionParser.getRating(props['Rating']) || NotionParser.getRating(props['평점']);
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

      ${rating ? `<div class="rating">⭐ ${rating}</div>` : ''}
      ${comment ? `<div class="preview-comment">${comment}</div>` : ''}
    </div>

    ${visitDate ? `<div class="date">방문일: ${visitDate}</div>` : ''}
  `;

  card.addEventListener('click', () => openDetailModal(index));
  return card;
}

// 상세 모달 열기 + 본문 블록 가져오기
async function openDetailModal(index) {
  const item = rawNotionData[index];
  if (!item) return;

  const props = item.properties || {};
  const icon = item.icon?.type === 'emoji' ? item.icon.emoji : '🍽️';
  const title = NotionParser.getTitle(props);
  const menu = NotionParser.getText(props['매뉴']) || NotionParser.getText(props['메뉴']);
  const city = NotionParser.getText(props['City']) || NotionParser.getText(props['도시']);
  const rating = NotionParser.getRating(props['Rating']) || NotionParser.getRating(props['평점']);
  const visitDate = NotionParser.getDate(props['방문일']);
  const notionUrl = item.public_url || item.url;

  const modalBody = document.getElementById('modal-body');
  
  // 먼저 기본 데이터 렌더링 & 본문 로딩 표시
  modalBody.innerHTML = `
    <div class="modal-title-group">
      <span class="icon">${icon}</span>
      <h2 class="modal-title">${title}</h2>
    </div>

    <div class="tags">
      ${city ? `<span class="tag city">📍 ${city}</span>` : ''}
      ${menu ? `<span class="tag">🍴 ${menu}</span>` : ''}
    </div>

    ${rating ? `<div class="rating" style="font-size:1.2rem; margin-top:8px;">⭐ ${rating}</div>` : ''}

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

  // 백엔드 api/blocks.js 호출하여 본문 데이터 가져오기
  try {
    const res = await fetch(`/api/blocks?pageId=${item.id}`);
    const blocks = await res.json();
    
    console.log(`=== 📄 [${title}] 노션 본문 블록 데이터 ===`, blocks);

    const contentArea = document.getElementById('modal-content-area');
    
    if (!Array.isArray(blocks) || blocks.length === 0) {
      contentArea.innerHTML = '<p style="color:#6c7a96;">본문에 작성된 내용이 없습니다.</p>';
      return;
    }

    // 가져온 블록 데이터들을 HTML로 하나씩 변환
    const htmlContent = blocks.map(block => parseBlockToHtml(block)).join('');
    contentArea.innerHTML = htmlContent || '<p style="color:#6c7a96;">표시할 수 있는 본문 요소가 없습니다.</p>';

  } catch (err) {
    console.error('본문 로딩 실패:', err);
    document.getElementById('modal-content-area').innerHTML = '<p style="color:#bf616a;">본문 글을 불러오지 못했습니다.</p>';
  }
}

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

init();
