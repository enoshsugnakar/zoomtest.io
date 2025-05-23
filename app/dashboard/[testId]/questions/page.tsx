'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type QuestionType = 'multiple_choice' | 'behavioral';

interface Question {
  id: string;
  test_id: string;
  question_text: string;
  options: string[] | null;
  correct_answer: string | null;
  order_number: number;
  type: QuestionType;
  created_at: string;
}

interface NewQuestion {
  question_text: string;
  type: QuestionType;
  options: string[];
  correct_answer: string;
}

export default function QuestionsPage({
  params
}: {
  params: { testId: string }
}) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [newQuestion, setNewQuestion] = useState<NewQuestion>({
    question_text: '',
    type: 'multiple_choice',
    options: ['', '', '', ''],
    correct_answer: '',
  });

  useEffect(() => {
    loadQuestions();
  }, []);

  async function loadQuestions() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login');
        return;
      }

      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('test_id', params.testId)
        .order('order_number');

      if (error) throw error;
      setQuestions(data || []);
    } catch (err: any) {
      console.error('Error loading questions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    try {
      if (!newQuestion.question_text.trim()) {
        throw new Error('Question text is required');
      }

      if (newQuestion.type === 'multiple_choice') {
        if (!newQuestion.options.every(opt => opt.trim())) {
          throw new Error('All options must be filled');
        }
        if (!newQuestion.correct_answer) {
          throw new Error('Select the correct answer');
        }
      }

      const { data, error } = await supabase
        .from('questions')
        .insert({
          test_id: params.testId,
          question_text: newQuestion.question_text.trim(),
          type: newQuestion.type,
          options: newQuestion.type === 'multiple_choice' ? newQuestion.options : null,
          correct_answer: newQuestion.type === 'multiple_choice' ? newQuestion.correct_answer : null,
          order_number: questions.length,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      setQuestions([...questions, data]);
      setNewQuestion({
        question_text: '',
        type: 'multiple_choice',
        options: ['', '', '', ''],
        correct_answer: '',
      });
    } catch (err: any) {
      console.error('Error adding question:', err);
      setError(err.message);
    }
  }

  async function handleFinalizeTest() {
    setIsFinalizing(true);
    setError('');

    try {
      if (questions.length === 0) {
        throw new Error('Add at least one question before finalizing');
      }

      const { error: updateError } = await supabase
        .from('tests')
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', params.testId);

      if (updateError) throw updateError;
      router.push(`/dashboard/${params.testId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsFinalizing(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push(`/dashboard/${params.testId}`)}
          className="text-blue-600 hover:underline"
        >
          ← Back to Test
        </button>
        <button
          onClick={handleFinalizeTest}
          disabled={isFinalizing || questions.length === 0}
          className={`px-4 py-2 rounded ${
            questions.length === 0
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isFinalizing ? 'Saving...' : 'Save and Create Test'}
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg p-4 border">
          <h1 className="text-2xl font-bold">Test Questions</h1>
          <p className="text-gray-600 mt-2">
            {questions.length} question{questions.length !== 1 ? 's' : ''} added
          </p>
        </div>

        {questions.map((q, index) => (
          <div key={q.id} className="bg-white rounded-lg p-6 border">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-medium">Question {index + 1}</h3>
              <span className="text-sm text-gray-500">
                {q.type === 'multiple_choice' ? 'Multiple Choice' : 'Behavioral'}
              </span>
            </div>
            <p className="text-lg mb-4">{q.question_text}</p>
            {q.type === 'multiple_choice' && q.options && (
              <div className="space-y-2 pl-4">
                {q.options.map((option, i) => (
                  <div 
                    key={i}
                    className={`p-2 rounded ${
                      option === q.correct_answer 
                        ? 'bg-green-50 border-green-200 border' 
                        : ''
                    }`}
                  >
                    <span className="inline-block w-6">{String.fromCharCode(65 + i)}.</span>
                    {option}
                    {option === q.correct_answer && (
                      <span className="ml-2 text-green-600 text-sm">(Correct)</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="bg-white rounded-lg p-6 border">
          <h2 className="text-xl font-semibold mb-4">Add New Question</h2>
          <form onSubmit={handleAddQuestion} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Question Type</label>
              <select
                value={newQuestion.type}
                onChange={(e) => setNewQuestion(prev => ({
                  ...prev,
                  type: e.target.value as QuestionType,
                  options: e.target.value === 'behavioral' ? [] : prev.options,
                  correct_answer: e.target.value === 'behavioral' ? '' : prev.correct_answer
                }))}
                className="w-full border rounded p-2"
              >
                <option value="multiple_choice">Multiple Choice</option>
                <option value="behavioral">Behavioral</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Question Text</label>
              <textarea
                value={newQuestion.question_text}
                onChange={(e) => setNewQuestion(prev => ({
                  ...prev,
                  question_text: e.target.value
                }))}
                className="w-full border rounded p-2 h-24"
                placeholder="Enter your question here"
              />
            </div>

            {newQuestion.type === 'multiple_choice' && (
              <div>
                <label className="block text-sm font-medium mb-2">Options</label>
                <div className="space-y-2">
                  {newQuestion.options.map((opt, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="correct"
                        checked={opt === newQuestion.correct_answer}
                        onChange={() => setNewQuestion(prev => ({
                          ...prev,
                          correct_answer: opt
                        }))}
                        className="mt-1"
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOptions = [...newQuestion.options];
                          newOptions[i] = e.target.value;
                          setNewQuestion(prev => ({
                            ...prev,
                            options: newOptions
                          }));
                        }}
                        className="flex-1 border rounded p-2"
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Add Question
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}