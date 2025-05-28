'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface Test {
  id: string;
  name: string;
  duration_minutes: number;
  material_type: string | null;
  material_url: string | null;
  allow_uploads: boolean;
  upload_limit_mb: number | null;
}

interface TestSession {
  id: string;
  candidate_email: string;
  status: string | null;
  test_id: string;
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

export default function CandidateTestPage() {
  const { access_token } = useParams();
  const supabase = createClientComponentClient();

  const [test, setTest] = useState<Test | null>(null);
  const [session, setSession] = useState<TestSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<{ [qId: string]: string }>({});
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [emailValidated, setEmailValidated] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);

  // Disable right-click on material pane
  useEffect(() => {
    const preventContext = (e: MouseEvent) => {
      const container = document.getElementById('material-pane');
      if (container && container.contains(e.target as Node)) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', preventContext);
    return () => document.removeEventListener('contextmenu', preventContext);
  }, []);

  // Timer logic
  useEffect(() => {
    if (emailValidated && test && startTime) {
      setTimeLeft(test.duration_minutes * 60);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current!);
    }
  }, [emailValidated, test, startTime]);

  // Load session and test
  useEffect(() => {
    if (access_token) {
      (async () => {
        const { data: sessionData } = await supabase
          .from('test_sessions')
          .select('id, candidate_email, status, test_id, started_at, submitted_at, time_taken_seconds')
          .eq('access_token', access_token)
          .single();
        if (sessionData) {
          setSession(sessionData);
          if (sessionData.submitted_at) {
            setSubmitted(true);
            setLoading(false);
            return;
          }
          const { data: testData } = await supabase
            .from('tests')
            .select('id, name, duration_minutes, material_type, material_url, allow_uploads, upload_limit_mb')
            .eq('id', sessionData.test_id)
            .single();
          setTest(testData);
          const { data: questionsData } = await supabase
            .from('questions')
            .select('id, question_text, type, order_number')
            .eq('test_id', sessionData.test_id)
            .order('order_number', { ascending: true });
          setQuestions(questionsData || []);
        }
        setLoading(false);
      })();
    }
  }, [access_token, supabase]);

  function handleAnswerChange(qid: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  async function handleEmailValidate(e: React.FormEvent) {
    e.preventDefault();
    if (session && email.trim().toLowerCase() === session.candidate_email.trim().toLowerCase()) {
      setEmailValidated(true);
      if (!session.started_at) {
        const now = new Date();
        setStartTime(now);
        await supabase.from('test_sessions').update({ started_at: now.toISOString(), status: 'started' }).eq('id', session.id);
      } else {
        setStartTime(new Date(session.started_at));
      }
    } else {
      alert('Email does not match the assigned email for this test.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearInterval(timerRef.current!);
    await submitTest();
  }

  async function handleAutoSubmit() {
    if (!submitted) {
      await submitTest();
    }
  }

  async function submitTest() {
    setLoading(true);
    for (const q of questions) {
      await supabase
        .from('candidate_responses')
        .upsert({
          session_id: session?.id,
          question_id: q.id,
          response: answers[q.id] || '',
        });
    }
    let upload_url = null;
    if (test?.allow_uploads && file) {
      const { data } = await supabase.storage
        .from('candidate_uploads')
        .upload(`${session?.id}/${file.name}`, file, { upsert: true });
      upload_url = data?.path || null;
    }
    const submitTime = new Date();
    const started = startTime || (session?.started_at ? new Date(session.started_at) : submitTime);
    const elapsedSeconds = Math.floor((submitTime.getTime() - started.getTime()) / 1000);

    await supabase.from('test_sessions').update({
      status: 'completed',
      submitted_at: submitTime.toISOString(),
      time_taken_seconds: elapsedSeconds,
      upload_url: upload_url,
    }).eq('id', session?.id);

    setSubmitted(true);
    setLoading(false);
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  if (loading) return <div className="p-8">Loading test...</div>;
  if (submitted)
    return (
      <div className="p-8 text-green-600 font-bold">
        Thank you! Your test has been submitted.
      </div>
    );
  if (!session || !test)
    return (
      <div className="p-8 text-red-500">Invalid or expired test link.</div>
    );

  if (!emailValidated)
    return (
      <div className="max-w-md mx-auto mt-24 p-6 border rounded shadow bg-white">
        <h2 className="text-xl font-bold mb-4">Email Verification</h2>
        <form onSubmit={handleEmailValidate} className="space-y-4">
          <div>
            <label className="block font-medium mb-1">Enter your email to begin:</label>
            <input
              type="email"
              className="w-full border rounded p-2"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
          >
            Validate Email & Start Test
          </button>
        </form>
      </div>
    );

  return (
    <div className="flex h-screen">
      {/* LEFT: Material (70%) */}
      <div
        id="material-pane"
        className="w-[70%] relative flex flex-col items-center justify-center bg-gray-100 h-full border-r"
        style={{ userSelect: 'none', MozUserSelect: 'none', WebkitUserSelect: 'none' }}
        onContextMenu={e => e.preventDefault()}
      >
        <div className="w-full px-8 py-6">
          <h2 className="text-xl font-semibold mb-2">{test.name}</h2>
          <div className="mb-2">
            <span className="font-medium">Time Left: </span>
            <span className="text-lg text-red-600">{formatTime(timeLeft)}</span>
          </div>
        </div>
        <div className="flex-1 w-full flex items-center justify-center">
          {test.material_type === 'file' && test.material_url && (
            <iframe
              src={`${test.material_url}#toolbar=0&navpanes=0`}
              title="Test Material"
              className="w-[90%] h-[80%] border rounded shadow"
              sandbox="allow-scripts"
              style={{ pointerEvents: 'auto' }}
            />
          )}
          {test.material_type === 'link' && test.material_url && (
            <iframe
              src={test.material_url}
              title="Test Material"
              className="w-[90%] h-[80%] border rounded shadow"
              sandbox="allow-scripts"
              style={{ pointerEvents: 'auto' }}
            />
          )}
        </div>
        <div
          className="absolute inset-0 pointer-events-none select-none"
          style={{
            background:
              'repeating-linear-gradient(135deg, rgba(200,200,200,0.1) 0 30px, transparent 30px 60px)'
          }}
        />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-500 bg-white/60 px-2 py-1 rounded shadow">
          Downloading, copying, and screenshots are not permitted.
        </div>
      </div>
      {/* RIGHT: Questions & Upload (30%) */}
      <div className="w-[30%] h-full flex flex-col p-8 bg-white overflow-y-auto">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="mb-4 text-right">
            <span className="inline-block bg-gray-900 text-white px-3 py-1 rounded">
              {session.candidate_email}
            </span>
          </div>
          <div className="flex-1 space-y-6">
            {questions.map((q) => (
              <div key={q.id}>
                <label className="block font-medium mb-1">{q.order_number}. {q.question_text}</label>
                <textarea
                  className="w-full rounded border p-2"
                  rows={3}
                  value={answers[q.id] || ''}
                  onChange={e => handleAnswerChange(q.id, e.target.value)}
                  required
                />
              </div>
            ))}
            {test.allow_uploads && (
              <div>
                <label className="block font-medium mb-1">Upload your work (optional)</label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="block"
                />
                {test.upload_limit_mb && file && file.size > test.upload_limit_mb * 1024 * 1024 && (
                  <div className="text-red-500 text-sm">File exceeds upload limit of {test.upload_limit_mb} MB.</div>
                )}
              </div>
            )}
          </div>
          <button
            type="submit"
            className="mt-8 bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
            disabled={loading || timeLeft <= 0}
          >
            Submit Test
          </button>
        </form>
      </div>
    </div>
  );
}