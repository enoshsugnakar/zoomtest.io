// pages/api/material.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { filePath } = req.query;
  if (typeof filePath !== 'string') {
    return res.status(400).json({ error: 'filePath is required' });
  }

  // Download from the private bucket
  const { data, error } = await supabaseAdmin
    .storage
    .from('test-materials')
    .download(filePath);

  if (error || !data) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Stream the file back
  res.setHeader('Content-Type', 'application/pdf');
  const buffer = await data.arrayBuffer();
  res.send(Buffer.from(buffer));
}
