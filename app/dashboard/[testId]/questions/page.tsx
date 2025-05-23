'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Question, QuestionType } from '@/app/types/schema';
import { supabase } from '@/lib/supabaseClient';

export default function QuestionsPage({
  params,
}: {
  params: { testId: string };
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState({
    question_text: '',
    type: 'multiple_choice' as QuestionType,
    options: ['', '', '', ''],
    correct_answer: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadQuestions();
  }, [params.testId]);

  async function loadQuestions() {
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*')
      .eq('test_id', params.testId)
      .order('order_number');

    if (error) {
      setError('Failed to load questions');
      console.error(error);
    } else {
      setQuestions(questions || []);
    }
    setLoading(false);
  }

  async function handleAddQuestion() {
    if (!newQuestion.question_text.trim()) {
      setError('Question text is required');
      return;
    }

    if (
      newQuestion.type === 'multiple_choice' &&
      (!newQuestion.options.some(opt => opt.trim()) || !newQuestion.correct_answer)
    ) {
      setError('Multiple choice questions require at least one option and a correct answer');
      return;
    }

    const { data, error } = await supabase
      .from('questions')
      .insert({
        test_id: params.testId,
        question_text: newQuestion.question_text,
        type: newQuestion.type,
        options: newQuestion.type === 'multiple_choice' ? newQuestion.options.filter(opt => opt.trim()) : null,
        correct_answer: newQuestion.type === 'multiple_choice' ? newQuestion.correct_answer : null,
        order_number: questions.length + 1,
      })
      .select()
      .single();

    if (error) {
      setError('Failed to add question');
      console.error(error);
    } else {
      setQuestions([...questions, data]);
      setNewQuestion({
        question_text: '',
        type: 'multiple_choice',
        options: ['', '', '', ''],
        correct_answer: '',
      });
      setError('');
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <h1 className="text-2xl font-bold">Manage Questions</h1>

      {/* New Question Form */}
      <div className="border rounded-lg p-6 space-y-4 bg-white">
        <h2 className="text-xl font-semibold">Add New Question</h2>
        
        <div>
          <label className="block text-sm font-medium mb-1">Question Type</label>
          <select
            value={newQuestion.type}
            onChange={(e) => setNewQuestion({
              ...newQuestion,
              type: e.target.value as QuestionType,
              options: e.target.value === 'multiple_choice' ? ['', '', '', ''] : [],
              correct_answer: '',
            })}
            className="w-full border rounded px-3 py-2"
          >
            <option value="multiple_choice">Multiple Choice</option>
            <option value="behavioral">Behavioral</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Question Text</label>
          <textarea
            value={newQuestion.question_text}
            onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
            className="w-full border rounded px-3 py-2 min-h-[100px]"
            placeholder="Enter your question here..."
          />
        </div>

        {newQuestion.type === 'multiple_choice' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Options</label>
              {newQuestion.options.map((option, index) => (
                <input
                  key={index}
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...newQuestion.options];
                    newOptions[index] = e.target.value;
                    setNewQuestion({ ...newQuestion, options: newOptions });
                  }}
                  className="w-full border rounded px-3 py-2 mb-2"
                  placeholder={`Option ${index + 1}`}
                />
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Correct Answer</label>
              <select
                value={newQuestion.correct_answer}
                onChange={(e) => setNewQuestion({ ...newQuestion, correct_answer: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Select correct answer</option>
                {newQuestion.options.map((option: string, index: number) => (
                  option && (
                    <option key={index} value={option}>
                      {option}
                    </option>
                  )
                ))}
              </select>
            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleAddQuestion}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          Add Question
        </button>
      </div>

      {/* Existing Questions List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Existing Questions</h2>
        {questions.map((question, index) => (
          <div key={question.id} className="border rounded-lg p-4 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-sm text-gray-500">Question {index + 1}</span>
                <p className="font-medium">{question.question_text}</p>
              </div>
              <span className="px-2 py-1 bg-gray-100 rounded text-sm">
                {question.type}
              </span>
            </div>
            
            {question.type === 'multiple_choice' && question.options && (
              <div className="mt-2 space-y-1">
                {question.options.map((option: string, optIndex: number) => (
                  <div 
                    key={optIndex}
                    className={`text-sm ${option === question.correct_answer ? 'text-green-600 font-medium' : 'text-gray-600'}`}
                  >
                    {option === question.correct_answer ? '✓ ' : ''}
                    {option}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}