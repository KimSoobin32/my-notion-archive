import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.ntn_G8886361609aransf6bOgNDhx6RS40jGhBY6Z53hmeUguc });
const DATABASE_ID = process.env.1b4211ab1e09800e8c64d3d107c2c49a;

export default async function handler(req, res) {
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
    });
    res.status(200).json(response.results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
