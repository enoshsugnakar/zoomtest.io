// pages/api/test_sessions/[sessionId]/submit.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { sessionId, email } = req.query;
  if (req.method !== 'POST' || typeof sessionId !== 'string' || typeof email !== 'string') {
    return res.status(400).json({ error: 'Bad request' });
  }

  // Record submitted_at = now() for matching sessionId + candidate_email
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('test_sessions')
    .update({ submitted_at: now })
    .eq('id', sessionId)
    .ilike('candidate_email', email.trim());

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ submittedAt: now });
}
