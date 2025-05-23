import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('filePath');

  if (!filePath) {
    return new NextResponse(
      JSON.stringify({ error: 'filePath is required' }),
      { status: 400 }
    );
  }

  const supabase = createRouteHandlerClient({ cookies });

  const { data, error } = await supabase
    .storage
    .from('test-materials')
    .download(filePath);

  if (error || !data) {
    return new NextResponse(
      JSON.stringify({ error: 'File not found' }),
      { status: 404 }
    );
  }

  // Stream the file back
  const buffer = await data.arrayBuffer();
  return new NextResponse(Buffer.from(buffer), {
    headers: { 'Content-Type': 'application/pdf' },
  });
}