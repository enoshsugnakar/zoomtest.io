// pages/dashboard/[testId].tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';      // ← pages router import
import { supabase } from '@/lib/supabaseClient';

type SessionRow = {
  id: string;
  candidate_email: string;
  started_at: string | null;
  submitted_at: string | null;
};

export default function TestDetailPage() {
  const router = useRouter();
  const { testId } = router.query as { testId?: string };

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!testId) return;
    (async () => {
      // Redirect if not signed in
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login');
        return;
      }

      // Fetch test_sessions for this test
      const { data, error } = await supabase
        .from('test_sessions')
        .select('id, candidate_email, started_at, submitted_at')
        .eq('test_id', testId)
        .order('candidate_email');

      if (error) {
        console.error(error);
      } else if (data) {
        setSessions(data);
      }
      setLoading(false);
    })();
  }, [testId, router]);

  if (loading) return <p className="p-8">Loading…</p>;
  if (!testId) return <p className="p-8">Test not found.</p>;

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-4">
      <button
        onClick={() => router.push('/dashboard')}
        className="text-blue-600 underline"
      >
        ← Back to Dashboard
      </button>
      <h1 className="text-2xl font-bold">Test Details</h1>
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="border px-4 py-2">Candidate</th>
            <th className="border px-4 py-2">Started At</th>
            <th className="border px-4 py-2">Submitted At</th>
            <th className="border px-4 py-2">Time Taken</th>
            <th className="border px-4 py-2">Link</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const started = s.started_at ? new Date(s.started_at) : null;
            const submitted = s.submitted_at
              ? new Date(s.submitted_at)
              : null;
            const timeTaken =
              started && submitted
                ? `${Math.round(
                    (submitted.getTime() - started.getTime()) / 1000
                  )}s`
                : '—';
            return (
              <tr key={s.id}>
                <td className="border px-4 py-2">{s.candidate_email}</td>
                <td className="border px-4 py-2">
                  {started ? started.toLocaleString() : '—'}
                </td>
                <td className="border px-4 py-2">
                  {submitted ? submitted.toLocaleString() : '—'}
                </td>
                <td className="border px-4 py-2">{timeTaken}</td>
                <td className="border px-4 py-2">
                  {s.submitted_at ? (
                    <span className="text-gray-500">Disabled</span>
                  ) : (
                    <a
                      href={`/test/${s.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      /test/{s.id}
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
