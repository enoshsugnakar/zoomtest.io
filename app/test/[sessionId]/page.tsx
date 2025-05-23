'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Question, CandidateResponse } from '@/app/types/schema';

interface TestSession {
  id: string;
  test_id: string;
  candidate_email: string;
  started_at: string | null;
  submitted_at: string | null;
}

interface Test {
  id: string;
  name: string;
  material_url: string;
  duration_minutes: number;
}

export default function TestPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const router = useRouter();
  const [session, setSession] = useState<TestSession | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTestSession();
  }, [params.sessionId]);

  useEffect(() => {
    if (session?.started_at && test?.duration_minutes) {
      const startTime = new Date(session.started_at).getTime();
      const endTime = startTime + test.duration_minutes * 60 * 1000;
      const now = new Date().getTime();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      
      setTimeLeft(remaining);

      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null || prev <= 0) {
            clearInterval(timer);
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [session?.started_at, test?.duration_minutes]);

  async function loadTestSession() {
    const { data: sessionData, error: sessionError } = await supabase
      .from('test_sessions')
      .select('*, test:tests(*)')
      .eq('id', params.sessionId)
      .single();

    if (sessionError) {
      setError('Failed to load test session');
      console.error(sessionError);
      return;
    }

    setSession(sessionData);
    setTest(sessionData.test);

    // Load questions
    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('test_id', sessionData.test.id)
      .order('order_number');

    if (questionsError) {
      setError('Failed to load questions');
      console.error(questionsError);
      return;
    }

    setQuestions(questionsData || []);
    setLoading(false);

    // Start the test if not started
    if (!sessionData.started_at) {
      const { error: startError } = await supabase
        .from('test_sessions')
        .update({ started_at: new Date().toISOString() })
        .eq('id', params.sessionId);

      if (startError) {
        console.error('Failed to start test:', startError);
      }
    }
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);

    // Create responses
    const responsePromises = Object.entries(responses).map(([questionId, response]) => 
      supabase
        .from('candidate_responses')
        .insert({
          test_session_id: params.sessionId,
          question_id: questionId,
          response
        })
    );

    // Update session status
    const sessionPromise = supabase
      .from('test_sessions')
      .update({ submitted_at: new Date().toISOString() })
      .eq('id', params.sessionId);

    try {
      await Promise.all([...responsePromises, sessionPromise]);
      router.push(`/test/${params.sessionId}/complete`);
    } catch (error) {
      console.error('Failed to submit test:', error);
      setError('Failed to submit test. Please try again.');
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!test || !session) return <div className="p-8">Test not found</div>;

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">{test.name}</h1>
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                Question {currentQuestionIndex + 1} of {questions.length}
              </div>
              {timeLeft !== null && (
                <div className="text-sm font-mono">
                  Time left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Test Material */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-lg font-medium mb-4">Test Material</h2>
                <iframe
                  src={test.material_url}
                  className="w-full h-[600px] border-0"
                  title="Test Material"
                />
              </div>
            </div>
          </div>

          {/* Question Panel */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium mb-4">
                {currentQuestion.question_text}
              </h3>

              {currentQuestion.type === 'multiple_choice' ? (
                <div className="space-y-2">
                  {currentQuestion.options?.map((option, index) => (
                    <label
                      key={index}
                      className="flex items-start p-3 border rounded hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value={option}
                        checked={responses[currentQuestion.id] === option}
                        onChange={(e) =>
                          setResponses({
                            ...responses,
                            [currentQuestion.id]: e.target.value,
                          })
                        }
                        className="mt-1"
                      />
                      <span className="ml-3">{option}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  value={responses[currentQuestion.id] || ''}
                  onChange={(e) =>
                    setResponses({
                      ...responses,
                      [currentQuestion.id]: e.target.value,
                    })
                  }
                  className="w-full h-32 p-3 border rounded"
                  placeholder="Enter your answer..."
                />
              )}

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setCurrentQuestionIndex((i) => i - 1)}
                  disabled={currentQuestionIndex === 0}
                  className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                {currentQuestionIndex === questions.length - 1 ? (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Test'}
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentQuestionIndex((i) => i + 1)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>

            {/* Question Navigation */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium mb-3">Question Navigation</h3>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`p-2 text-sm rounded ${
                      index === currentQuestionIndex
                        ? 'bg-blue-600 text-white'
                        : responses[questions[index].id]
                        ? 'bg-green-100'
                        : 'bg-gray-100'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}