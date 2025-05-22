// pages/test/[sessionId].tsx

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';

const STORAGE_KEY = (sessionId: string) => `test_${sessionId}_session`;

type SessionAPIResponse = {
  materialUrl: string;
  durationMinutes: number;
};

export default function CandidateTestPage() {
  const router = useRouter();
  const { sessionId } = router.query as { sessionId?: string };

  // Guard against missing sessionId
  if (!sessionId) {
    return <p className="p-4">Invalid link.</p>;
  }

  // Phases: enterEmail → inProgress → submitted
  const [phase, setPhase] = useState<'enterEmail' | 'inProgress' | 'submitted'>('enterEmail');
  const [email, setEmail] = useState('');
  const [materialUrl, setMaterialUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [error, setError] = useState('');
  const timerRef = useRef<number | null>(null);

  // Resume from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY(sessionId));
    if (!raw) return;
    try {
      const { email, expiresAt, submittedAt } = JSON.parse(raw) as {
        email: string;
        expiresAt: number;
        submittedAt?: string;
      };
      setEmail(email);
      if (submittedAt) {
        setPhase('submitted');
      } else if (Date.now() < expiresAt) {
        setPhase('inProgress');
        setTimeLeftMs(expiresAt - Date.now());
        // Fetch material + duration
        fetch(`/api/test_sessions/${sessionId}?email=${encodeURIComponent(email)}`)
          .then((r) => r.json())
          .then((json: SessionAPIResponse | { error: string }) => {
            if ('error' in json) setError(json.error);
            else {
              setMaterialUrl(json.materialUrl);
              setDuration(json.durationMinutes);
            }
          })
          .catch((e) => setError(e.message));
      }
    } catch {
      // ignore
    }
  }, [sessionId]);

  // Timer ticking
  useEffect(() => {
    if (phase !== 'inProgress') return;
    if (timeLeftMs <= 0) {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      handleSubmit();
      return;
    }
    timerRef.current = window.setInterval(() => {
      setTimeLeftMs((t) => {
        const next = t - 1000;
        if (next <= 0 && timerRef.current !== null) {
          window.clearInterval(timerRef.current);
        }
        return Math.max(0, next);
      });
    }, 1000);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [phase, timeLeftMs]);

  // Start test handler
  const handleStart = async () => {
    setError('');
    if (!email.includes('@')) {
      setError('Enter a valid email.');
      return;
    }
    const res = await fetch(
      `/api/test_sessions/${sessionId}?email=${encodeURIComponent(email.trim().toLowerCase())}`
    );
    const json = (await res.json()) as SessionAPIResponse | { error: string };
    if ('error' in json) {
      setError(json.error);
      return;
    }
    setMaterialUrl(json.materialUrl);
    setDuration(json.durationMinutes);

    const expiresAt = Date.now() + json.durationMinutes * 60_000;
    setTimeLeftMs(expiresAt - Date.now());
    setPhase('inProgress');

    localStorage.setItem(
      STORAGE_KEY(sessionId),
      JSON.stringify({ email: email.trim().toLowerCase(), expiresAt })
    );
  };

  // Manual submit handler
  const handleSubmit = async () => {
    const res = await fetch(
      `/api/test_sessions/${sessionId}/submit?email=${encodeURIComponent(email)}`,
      { method: 'POST' }
    );
    const body = (await res.json()) as { submittedAt?: string; error?: string };
    if (body.error) {
      setError(body.error);
      return;
    }
    setPhase('submitted');
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    localStorage.setItem(
      STORAGE_KEY(sessionId),
      JSON.stringify({ email, expiresAt: Date.now(), submittedAt: body.submittedAt })
    );
  };

  // Auto‑submit when time’s up
  const handleAutoSubmit = () => {
    handleSubmit();
  };

  // Render phases
  if (phase === 'enterEmail') {
    return (
      <div className="p-8 max-w-md mx-auto">
        <h2 className="text-xl font-bold mb-4">Enter your email to begin</h2>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border px-3 py-2 rounded mb-2"
        />
        {error && <p className="text-red-500 mb-2">{error}</p>}
        <button
          onClick={handleStart}
          className="w-full bg-blue-600 text-white py-2 rounded"
        >
          Start Test
        </button>
      </div>
    );
  }

  if (phase === 'inProgress') {
    const mins = Math.floor(timeLeftMs / 60000);
    const secs = String(Math.floor((timeLeftMs % 60000) / 1000)).padStart(2, '0');
    const pdfUrl = `${materialUrl}#toolbar=0&navpanes=0&scrollbar=0`;

    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="text-right font-mono text-lg">
          Time left: {mins}:{secs}
        </div>
        <div className="relative border p-4">
          {materialUrl.match(/\.(pdf)$/i) ? (
            <>
              <embed
                src={pdfUrl}
                type="application/pdf"
                width="100%"
                height="600px"
              />
              {/* Transparent overlay to block right-click & print */}
              <div
                className="absolute inset-0"
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  if (
                    (e.ctrlKey && (e.key === 'p' || e.key === 's')) ||
                    e.key === 'Print'
                  ) {
                    e.preventDefault();
                  }
                }}
                tabIndex={0}
              />
            </>
          ) : (
            <iframe src={materialUrl} width="100%" height="600px" allowFullScreen />
          )}
        </div>
        <button
          onClick={handleSubmit}
          className="w-full bg-green-600 text-white py-2 rounded"
        >
          Submit Test
        </button>
        {error && <p className="text-red-500">{error}</p>}
      </div>
    );
  }

  // phase === 'submitted'
  return (
    <div className="p-8 max-w-md mx-auto text-center">
      <h2 className="text-xl font-bold mb-4">Test Submitted</h2>
      <p>Thank you! Your submission was recorded.</p>
    </div>
  );
}
