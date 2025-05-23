import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

interface TestInsertBody {
  name: string;
  materialUrl: string;
  durationMinutes: number;
  candidateEmails: string[];
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  // 1. Auth check
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401 }
    );
  }

  // 2. Parse & validate
  const body: TestInsertBody = await request.json();
  const { name, materialUrl, durationMinutes, candidateEmails } = body;

  if (!name?.trim()) {
    return new NextResponse(
      JSON.stringify({ error: 'Test name is required.' }),
      { status: 400 }
    );
  }

  if (!materialUrl || !candidateEmails?.length) {
    return new NextResponse(
      JSON.stringify({ error: 'Missing parameters.' }),
      { status: 400 }
    );
  }

  // 3. Insert into tests
  const { data: test, error: testError } = await supabase
    .from('tests')
    .insert({
      creator_id: session.user.id,
      name: name.trim(),
      material_url: materialUrl,
      duration_minutes: durationMinutes,
      candidate_emails: candidateEmails,
    })
    .select('id')
    .single();

  if (testError || !test) {
    return new NextResponse(
      JSON.stringify({ error: testError?.message || 'Test insert failed' }),
      { status: 500 }
    );
  }

  // 4. Insert test_sessions
  const { error: sessErr } = await supabase
    .from('test_sessions')
    .insert(
      candidateEmails.map((email) => ({
        test_id: test.id,
        candidate_email: email,
      }))
    );

  if (sessErr) {
    return new NextResponse(
      JSON.stringify({ error: sessErr.message || 'Session insert failed' }),
      { status: 500 }
    );
  }

  return NextResponse.json({ testId: test.id });
}