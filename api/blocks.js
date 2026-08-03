import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_KEY });

// 하위 자식 블록까지 모두 재귀적으로 불러오는 함수
async function fetchAllBlocks(blockId) {
  let allBlocks = [];
  let cursor;

  while (true) {
    const { results, next_cursor, has_more } = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of results) {
      // 만약 토글, 콜아웃 등 하위 자식 블록이 더 있는 구조라면 내부 블록도 재귀 호출
      if (block.has_children) {
        block.children = await fetchAllBlocks(block.id);
      }
      allBlocks.push(block);
    }

    if (!has_more) break;
    cursor = next_cursor;
  }

  return allBlocks;
}

export default async function handler(req, res) {
  const { pageId } = req.query;

  if (!pageId) {
    return res.status(400).json({ error: 'pageId가 필요합니다.' });
  }

  try {
    const blocks = await fetchAllBlocks(pageId);
    res.status(200).json(blocks);
  } catch (error) {
    console.error('Notion Blocks API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
