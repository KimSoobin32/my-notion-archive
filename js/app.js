// 노션 데이터 안전 추출 유틸리티 함수 모듈
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

// 메인 실행 상태 관리
let rawNotionData = [];

async function init() {
  const grid = document.getElementById('restaurant-grid');

  try {
    const res = await fetch('/api/notion');
    const data = await res.json();
    rawNotionData = data;

    // 1. 콘솔에 전체 받아온 원본 데이터 출력
    console.log('=== 🚀 노션 API 원본 데이터 ===');
    console.log(rawNotionData);

    grid.innerHTML = '';

    if (!Array.isArray(data) || data.length === 0) {
      grid.innerHTML = '<div class="loading">등록된 맛집 데이터가 없습니다.</div>';
      return;
    }

    // 2. 카드 렌더링
    data.forEach((item, index) => {
      const card = createCardElement(item, index);
      grid.appendChild(card);
    });

    // 3. 모달 이벤트 등록
    setupModalEvents();

  } catch (err) {
    console.error('데이터 로딩 오류:', err);
    grid.innerHTML = '<div class="loading">데이터를 불러오지 못했습니다. F12 콘솔을 확인하세요.</div>';
  }
}

// 카드 DOM 요소 생성
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

  // 카드 클릭 시 해당 항목 index를 전달하여 모달 표시
  card.addEventListener('click', () => openDetailModal(index));

  return card;
}

// 상세 리뷰 모달 열기
function openDetailModal(index) {
  const item = rawNotionData[index];
  if (!item) return;

  const props = item.properties || {};
  const icon = item.icon?.type === 'emoji' ? item.icon.emoji : '🍽️';
  const title = NotionParser.getTitle(props);
  const menu = NotionParser.getText(props['매뉴']) || NotionParser.getText(props['메뉴']);
  const city = NotionParser.getText(props['City']) || NotionParser.getText(props['도시']);
  const rating = NotionParser.getRating(props['Rating']) || NotionParser.getRating(props['평점']);
  const comment = NotionParser.getText(props['Comment']) || NotionParser.getText(props['코멘트']);
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

    ${rating ? `<div class="rating" style="font-size:1.2rem; margin-top:8px;">⭐ ${rating}</div>` : ''}

    ${comment ? `
      <div class="modal-section">
        <div class="modal-section-title">Review Comment</div>
        <div class="modal-comment">${comment}</div>
      </div>
    ` : '<div class="modal-section"><p style="color:#6c7a96;">작성된 상세 리뷰가 없습니다.</p></div>'}

    ${visitDate ? `<div class="date" style="margin-top:16px; text-align:left;">🗓️ 방문일: ${visitDate}</div>` : ''}

    ${notionUrl ? `<a href="${notionUrl}" target="_blank" rel="noopener" class="modal-notion-link">🔗 노션에서 원본 보기 ↗</a>` : ''}
  `;

  document.getElementById('modal-overlay').classList.add('active');
}

// 모달 닫기 이벤트 핸들러
function setupModalEvents() {
  const overlay = document.getElementById('modal-overlay');
  const closeBtn = document.getElementById('modal-close');

  const closeModal = () => overlay.classList.remove('active');

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // ESC 키로 모달 닫기
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

// 앱 실행
init();
