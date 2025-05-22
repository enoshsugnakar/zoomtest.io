// pages/api/test_sessions/[sessionId].ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Resp = {
  materialUrl: string;
  durationMinutes: number;
} | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  const { sessionId, email } = req.query;
  if (
    req.method !== 'GET' ||
    typeof sessionId !== 'string' ||
    typeof email !== 'string'
  ) {
    return res.status(400).json({ error: 'Bad request' });
  }

  // 1. Validate sessionId + candidate_email
  const { data: sess, error: fetchErr } = await supabaseAdmin
    .from('test_sessions')
    .select(`
      candidate_email,
      tests:tests(material_url, duration_minutes)
    `)
    .eq('id', sessionId)
    .ilike('candidate_email', email.trim())
    .single();

  if (fetchErr || !sess) {
    return res
      .status(404)
      .json({ error: 'Session not found or unauthorized' });
  }

  // 2. Unwrap the joined tests (array or object)
  const rawTests = (sess as any).tests;
  const testObj = Array.isArray(rawTests) ? rawTests[0] : rawTests;
  if (!testObj?.material_url || !testObj?.duration_minutes) {
    return res.status(500).json({ error: 'Related test not found' });
  }

  const { material_url, duration_minutes } = testObj;

  // 3. If this is a Supabase-stored file URL, generate a signed URL
  let signedUrl = material_url;
  const bucketUrlPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/test-materials/`;

  if (material_url.startsWith(bucketUrlPrefix)) {
    const filePath = material_url.substring(bucketUrlPrefix.length);
    const { data, error: signErr } = await supabaseAdmin
      .storage
      .from('test-materials')
      .createSignedUrl(filePath, duration_minutes * 60);

    if (signErr || !data.signedUrl) {
      console.error('Error generating signed URL:', signErr);
      return res.status(500).json({ error: 'Could not generate signed URL' });
    }
    signedUrl = data.signedUrl;
  }

  // 4. Return signed URL and duration
  return res.status(200).json({
    materialUrl: signedUrl,
    durationMinutes: duration_minutes,
  });
}
