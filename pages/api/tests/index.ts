// pages/api/tests/index.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient';

type TestInsertBody = {
  name: string;
  materialUrl: string;
  durationMinutes: number;
  candidateEmails: string[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Auth check
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = session.user.id;

  // 2. Parse & validate
  const { name, materialUrl, durationMinutes, candidateEmails } =
    req.body as TestInsertBody;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Test name is required.' });
  }
  if (!materialUrl || !candidateEmails?.length) {
    return res.status(400).json({ error: 'Missing parameters.' });
  }

  // 3. Insert into tests
  const { data: test, error: testError } = await supabase
    .from('tests')
    .insert({
      creator_id:       userId,
      name:             name.trim(),
      material_url:     materialUrl,
      duration_minutes: durationMinutes,
      candidate_emails: candidateEmails,
    })
    .select('id')
    .single();

  if (testError || !test) {
    return res
      .status(500)
      .json({ error: testError?.message || 'Test insert failed' });
  }
  const testId = test.id;

  // 4. Insert test_sessions as before
  const { error: sessErr } = await supabase
    .from('test_sessions')
    .insert(
      candidateEmails.map((email) => ({
        test_id:         testId,
        candidate_email: email,
      }))
    );

  if (sessErr) {
    return res
      .status(500)
      .json({ error: sessErr.message || 'Session insert failed' });
  }

  return res.status(200).json({ testId });
}
