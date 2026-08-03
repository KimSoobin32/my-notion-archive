import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_KEY });

export default async function handler(req, res) {
  // 프론트엔드에서 전달받은 pageId
  const { pageId } = req.query;

  if (!pageId) {
    return res.status(400).json({ error: 'pageId가 필요합니다.' });
  }

  try {
    // 노션 페이지 내부의 자식 블록(본문 내용) 목록 조회
    const response = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
    });
    
    res.status(200).json(response.results);
  } catch (error) {
    console.error('Notion Blocks API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
