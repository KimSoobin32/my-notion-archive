// 블록 하나 및 하위 자식 블록(children)까지 HTML로 변환하는 함수
function parseBlockToHtml(block) {
  const type = block.type;
  const value = block[type];

  if (!value) return '';

  const getRichText = (richTextArr) => {
    if (!richTextArr) return '';
    return richTextArr.map(t => t.plain_text).join('');
  };

  // 하위 자식 블록이 있다면 같이 HTML 변환
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
      return `<li style="margin-left:20px; color:#d8dee9;">${getRichText(value.rich_text)}</li>${childrenHtml}`;
      
    case 'numbered_list_item':
      return `<li style="margin-left:20px; color:#d8dee9;">${getRichText(value.rich_text)}</li>${childrenHtml}`;
      
    // 📝 토글(Toggle) 내부에 본문이 들어있는 경우
    case 'toggle':
      return `
        <details style="margin: 8px 0; background: #242933; border-radius: 8px; padding: 10px 14px;">
          <summary style="cursor: pointer; font-weight: bold; color: #88c0d0;">${getRichText(value.rich_text)}</summary>
          <div style="margin-top: 10px; padding-left: 10px;">${childrenHtml}</div>
        </details>
      `;

    // 💡 콜아웃(Callout) 내부에 본문이 들어있는 경우
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
