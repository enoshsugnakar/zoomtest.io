import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return new NextResponse(
      JSON.stringify({ error: 'Email is required' }),
      { status: 400 }
    );
  }

  const supabase = createRouteHandlerClient({ cookies });

  // Record submitted_at = now() for matching sessionId + candidate_email
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('test_sessions')
    .update({ submitted_at: now })
    .eq('id', params.sessionId)
    .ilike('candidate_email', email.trim());

  if (error) {
    return new NextResponse(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }

  return NextResponse.json({ submittedAt: now });
}