import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.ntn_G8886361609aransf6bOgNDhx6RS40jGhBY6Z53hmeUguc });
const DATABASE_ID = process.env.1b4211ab1e09800e8c64d3d107c2c49a;

export default async function handler(req, res) {
  // 환경변수 누락 체크
  if (!process.env.NOTION_KEY || !process.env.NOTION_DATABASE_ID) {
    return res.status(500).json({ 
      error: 'Vercel 환경 변수(NOTION_KEY 또는 NOTION_DATABASE_ID)가 설정되지 않았습니다.' 
    });
  }

  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
    });
    res.status(200).json(response.results);
  } catch (error) {
    // 구체적인 노션 에러 메시지 반환
    console.error('Notion API Error:', error);
    res.status(500).json({ error: error.message, code: error.code });
  }
}
