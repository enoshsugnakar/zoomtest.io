// pages/dashboard.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

type Test = {
  id: string;
  name: string;
  created_at: string;
  candidate_emails: string[];
};

export default function DashboardPage() {
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login');
        return;
      }
      const { data, error } = await supabase
        .from('tests')
        .select('id, name, created_at, candidate_emails')
        .eq('creator_id', session.user.id)
        .order('created_at', { ascending: false });
      if (data) setTests(data);
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <p className="p-8">Loading…</p>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Tests</h1>
        <button
          onClick={() => router.push('/new-test')}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          + Create New Test
        </button>
      </div>
      {tests.length === 0 ? (
        <p>
          No tests yet.{' '}
          <Link href="/new-test" className="text-blue-600 underline">
            Create one
          </Link>
        </p>
      ) : (
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr>
              <th className="border px-4 py-2 text-left">Name</th>
              <th className="border px-4 py-2 text-left">Created At</th>
              <th className="border px-4 py-2 text-left">Invitees</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => (
              <tr key={t.id}>
                <td className="border px-4 py-2">
                  <Link
                    href={`/dashboard/${t.id}`}
                    className="text-blue-600 underline cursor-pointer"
                  >
                    {t.name}
                  </Link>
                </td>
                <td className="border px-4 py-2">
                  {new Date(t.created_at).toLocaleString()}
                </td>
                <td className="border px-4 py-2">
                  {t.candidate_emails.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}