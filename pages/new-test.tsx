// pages/new-test.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UploadTestMaterial from '@/components/UploadTestMaterial';
import { supabase } from '@/lib/supabaseClient';

const DRAFT_KEY = 'new_test_draft';

type Draft = {
  testName: string;
  materialUrl: string;
  duration: number;
  emailsText: string;
  createdTestId?: string;
};

type CandidateLink = {
  email: string;
  sessionId: string;
};

export default function NewTestPage() {
  const router = useRouter();

  // Draft state, persisted
  const [draft, setDraft] = useState<Draft>({
    testName: '',
    materialUrl: '',
    duration: 30,
    emailsText: '',
  });

  // After creation, store the returned candidates
  const [candidates, setCandidates] = useState<CandidateLink[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load draft on mount
  useEffect(() => {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (stored) {
      try {
        setDraft(JSON.parse(stored));
      } catch {}
    }
  }, []);

  // Persist draft (excluding candidates) on change
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  const handleSubmit = async () => {
    setError('');
    const { testName, materialUrl, duration, emailsText } = draft;

    // Validations
    if (!testName.trim()) return setError('Please enter a test name.');
    if (!materialUrl)         return setError('Please upload a file or paste a link.');
    const emails = emailsText
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));
    if (emails.length === 0)   return setError('Enter at least one valid email.');

    setLoading(true);

    // Get current user
    const {
      data: { session },
      error: sessErr,
    } = await supabase.auth.getSession();
    if (sessErr || !session) {
      setError('You must be signed in to create a test.');
      setLoading(false);
      return;
    }

    // 1. Insert test
    const { data: test, error: testErr } = await supabase
      .from('tests')
      .insert({
        creator_id:       session.user.id,
        name:             testName.trim(),
        material_url:     materialUrl,
        duration_minutes: duration,
        candidate_emails: emails,
      })
      .select('id')
      .single();

    if (testErr || !test) {
      setError(testErr?.message || 'Failed to create test.');
      setLoading(false);
      return;
    }

    // 2. Insert sessions and capture their IDs
    const { data: sessions, error: sessInsertErr } = await supabase
      .from('test_sessions')
      .insert(
        emails.map((email) => ({
          test_id:         test.id,
          candidate_email: email,
        }))
      )
      .select('id, candidate_email');

    if (sessInsertErr || !sessions) {
      setError(sessInsertErr?.message || 'Failed to create sessions.');
      setLoading(false);
      return;
    }

    // Build candidate links
    setCandidates(
      sessions.map((row) => ({
        email: row.candidate_email,
        sessionId: row.id,
      }))
    );

    // Mark draft as created (so we show success + links)
    setDraft((d) => ({ ...d, createdTestId: test.id }));
    setLoading(false);
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  const handleNewTest = () => {
    localStorage.removeItem(DRAFT_KEY);
    setDraft({ testName: '', materialUrl: '', duration: 30, emailsText: '' });
    setCandidates([]);
  };

  // --- Success view: show links + dashboard button ---
  if (draft.createdTestId) {
    return (
      <div className="max-w-lg mx-auto p-8 space-y-4">
        <h1 className="text-2xl font-bold">Test Created!</h1>
        <p>
          <strong>{draft.testName}</strong> has been saved.
        </p>

        <div>
          <h2 className="text-xl font-semibold mb-2">Candidate Links</h2>
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr>
                <th className="border px-2 py-1 text-left">Email</th>
                <th className="border px-2 py-1 text-left">Link</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map(({ email, sessionId }) => (
                <tr key={sessionId}>
                  <td className="border px-2 py-1">{email}</td>
                  <td className="border px-2 py-1 break-all">
                    <a
                      href={`/test/${sessionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      /test/{sessionId}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={handleGoToDashboard}
          className="w-full bg-blue-600 text-white py-2 rounded"
        >
          Go to Dashboard
        </button>
        <button
          onClick={handleNewTest}
          className="w-full bg-gray-200 text-black py-2 rounded"
        >
          Create Another Test
        </button>
      </div>
    );
  }

  // --- Form view: draft inputs + actions ---
  return (
    <div className="max-w-lg mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">New Test Setup</h1>

      {/* Test Name */}
      <div>
        <label className="block font-semibold mb-1">Test Name</label>
        <input
          type="text"
          value={draft.testName}
          onChange={(e) =>
            setDraft((d) => ({ ...d, testName: e.target.value }))
          }
          placeholder="e.g. UX Design Challenge"
          className="border px-3 py-2 rounded w-full"
        />
      </div>

      {/* Upload */}
      <div>
        <label className="block font-semibold mb-1">
          1. Upload Test Material
        </label>
        <UploadTestMaterial
          onUploadComplete={(url) =>
            setDraft((d) => ({ ...d, materialUrl: url }))
          }
        />
        {draft.materialUrl && (
          <p className="mt-2 text-sm">
            ✅ Uploaded:{' '}
            <a
              href={draft.materialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 break-all"
            >
              {draft.materialUrl}
            </a>
          </p>
        )}
      </div>

      {/* Time Limit */}
      <div>
        <label className="block font-semibold mb-1">
          2. Time Limit (minutes)
        </label>
        <input
          type="number"
          min={5}
          max={180}
          value={draft.duration}
          onChange={(e) =>
            setDraft((d) => ({ ...d, duration: +e.target.value }))
          }
          className="border px-3 py-2 rounded w-24"
        />
      </div>

      {/* Emails */}
      <div>
        <label className="block font-semibold mb-1">
          3. Candidate Emails
        </label>
        <textarea
          rows={3}
          value={draft.emailsText}
          onChange={(e) =>
            setDraft((d) => ({ ...d, emailsText: e.target.value }))
          }
          placeholder="alice@example.com, bob@example.com"
          className="border px-3 py-2 rounded w-full"
        />
      </div>

      {error && <p className="text-red-500">{error}</p>}

      {/* Actions */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-green-600 text-white py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Creating…' : 'Create Test'}
      </button>
      <button
        onClick={handleGoToDashboard}
        className="w-full bg-blue-600 text-white py-2 rounded"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
