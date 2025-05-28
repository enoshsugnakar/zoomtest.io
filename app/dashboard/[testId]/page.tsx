'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface Test {
  id: string;
  name: string;
  created_at: string;
  duration_minutes: number;
  candidate_emails: string[];
  material_type: string | null;
  material_url: string | null;
  allow_uploads: boolean;
  upload_limit_mb: number | null;
  status: string;
}

interface TestSession {
  id: string;
  candidate_email: string;
  access_token: string | null;
  status: string | null;
  started_at: string | null;
  submitted_at: string | null;
  time_taken_seconds?: number | null;
}

interface Question {
  id: string;
  question_text: string;
  type: string;
  order_number: number;
}

export default function TestDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [test, setTest] = useState<Test | null>(null);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.testId) {
      Promise.all([
        loadTest(params.testId as string),
        loadSessions(params.testId as string),
        loadQuestions(params.testId as string),
      ]).then(() => setLoading(false));
    }
    // eslint-disable-next-line
  }, [params.testId]);

  async function loadTest(testId: string) {
    const { data, error } = await supabase
      .from('tests')
      .select('id, name, created_at, duration_minutes, candidate_emails, material_type, material_url, allow_uploads, upload_limit_mb, status')
      .eq('id', testId)
      .single();
    if (!error) setTest(data);
  }

  async function loadSessions(testId: string) {
    const { data, error } = await supabase
      .from('test_sessions')
      .select('id, candidate_email, access_token, status, started_at, submitted_at, time_taken_seconds')
      .eq('test_id', testId);
    if (!error && data) setSessions(data);
  }

  async function loadQuestions(testId: string) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, question_text, type, order_number')
      .eq('test_id', testId)
      .order('order_number', { ascending: true });
    if (!error && data) setQuestions(data);
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (!test) return <div className="p-8 text-red-500">Test not found.</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <button
        className="mb-4 text-blue-600 hover:underline"
        onClick={() => router.push('/dashboard')}
      >
        ← Back to Dashboard
      </button>
      <h1 className="text-2xl font-bold mb-2">{test.name}</h1>
      <div className="text-gray-500 mb-2">
        Created {new Date(test.created_at).toLocaleString()}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div>
          <div className="font-semibold">Duration:</div>
          <div>{test.duration_minutes} minutes</div>
        </div>
        <div>
          <div className="font-semibold">Material Type:</div>
          <div>{test.material_type || 'N/A'}</div>
        </div>
        <div>
          <div className="font-semibold">Questions:</div>
          <div>{questions.length}</div>
        </div>
        <div>
          <div className="font-semibold">Allow Candidate Uploads:</div>
          <div>{test.allow_uploads ? 'Yes' : 'No'}</div>
          {test.allow_uploads && (
            <div className="text-sm">
              Upload Limit: {test.upload_limit_mb ? `${test.upload_limit_mb} MB` : 'N/A'}
            </div>
          )}
        </div>
        <div>
          <div className="font-semibold">Status:</div>
          <div>{test.status}</div>
        </div>
        {(test.material_type === 'file' && test.material_url) && (
          <div className="md:col-span-2">
            <span className="font-semibold">Uploaded File:</span>
            <a
              href={test.material_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline ml-2"
            >
              View/Download
            </a>
          </div>
        )}
        {(test.material_type === 'link' && test.material_url) && (
          <div className="md:col-span-2">
            <span className="font-semibold">Material Link:</span>
            <a
              href={test.material_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline ml-2"
            >
              {test.material_url}
            </a>
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold mb-2">Candidates</h2>
      <div className="space-y-3 mb-8">
        {sessions.length === 0 && (
          <div className="text-gray-500">No candidates yet.</div>
        )}
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between border rounded px-4 py-2 bg-white"
          >
            <div>
              <div className="font-medium">{session.candidate_email}</div>
              <div className="text-xs text-gray-400 break-all mb-1">
                Test Link:{' '}
                <span className="font-mono">{`https://zoomtest-io.vercel.app/test/${session.access_token}`}</span>
              </div>
              <div className="text-xs">
                <span
                  className={
                    session.status === 'completed'
                      ? 'text-green-600'
                      : session.status === 'started'
                      ? 'text-yellow-600'
                      : 'text-gray-500'
                  }
                >
                  Status: {session.status ? session.status.charAt(0).toUpperCase() + session.status.slice(1) : 'Not started'}
                </span>
                {session.submitted_at && (
                  <>
                    <br />
                    <span>Submitted: {new Date(session.submitted_at).toLocaleString()}</span>
                    <br />
                    <span>
                      Time Taken:{" "}
                      {session.time_taken_seconds !== undefined && session.time_taken_seconds !== null
                        ? `${Math.floor(session.time_taken_seconds / 60)}m ${session.time_taken_seconds % 60}s`
                        : "N/A"}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              disabled
              title="Email sending not yet implemented"
            >
              Send Now
            </button>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-2">Questions</h2>
      <ul className="list-decimal list-inside space-y-2">
        {questions.map((q) => (
          <li key={q.id}>
            <span className="font-medium">{q.type.replace('_', ' ').toUpperCase()}:</span>{' '}
            {q.question_text}
          </li>
        ))}
      </ul>
    </div>
  );
}