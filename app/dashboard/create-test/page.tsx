'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { v4 as uuidv4 } from 'uuid';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

type QuestionType = 'multiple_choice' | 'text_answer';

interface Question {
  id: string;
  question_text: string;
  type: QuestionType;
  options: string[];
  correct_answer: number | null; // index in options
  order: number;
}

interface TestData {
  name: string;
  duration_minutes: number;
  material_url: string; // Online link, admin can set
  material_file_url: string; // Uploaded file link, admin can set
  allow_file_upload: boolean;
  file_upload_limit_mb: number;
  candidate_emails: string;
  questions: Question[];
}

function QuestionEditor({
  question,
  index,
  moveQuestion,
  onChange,
  onDelete,
}: {
  question: Question;
  index: number;
  moveQuestion: (dragIndex: number, hoverIndex: number) => void;
  onChange: (q: Question) => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [, drop] = useDrop({
    accept: 'QUESTION',
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      moveQuestion(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });
  const [{ isDragging }, drag] = useDrag({
    type: 'QUESTION',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  drag(drop(ref));

  // Handlers
  const setValue = <K extends keyof Question>(key: K, value: Question[K]) =>
    onChange({ ...question, [key]: value });

  const handleOptionChange = (optIdx: number, value: string) => {
    const next = [...question.options];
    next[optIdx] = value;
    setValue('options', next);
  };

  const handleAddOption = () => {
    setValue('options', [...question.options, '']);
  };

  const handleRemoveOption = (optIdx: number) => {
    const next = [...question.options];
    next.splice(optIdx, 1);
    let nextCorrect = question.correct_answer;
    if (question.correct_answer !== null) {
      // If correct removed, or out of range, reset
      if (optIdx === question.correct_answer || next.length <= question.correct_answer) {
        nextCorrect = null;
      } else if (optIdx < question.correct_answer!) {
        nextCorrect = question.correct_answer! - 1;
      }
    }
    onChange({ ...question, options: next, correct_answer: nextCorrect });
  };

  const handleCorrectChange = (idx: number) => {
    setValue('correct_answer', idx);
  };

  return (
    <div
      ref={ref}
      className={`border rounded p-4 bg-gray-50 mb-4 shadow-sm relative ${isDragging ? 'opacity-60' : ''}`}
      style={{ cursor: 'move' }}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold">Q{index + 1}</span>
        <button
          type="button"
          className="text-red-600"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
      <input
        className="w-full border rounded px-2 py-1 mb-2"
        value={question.question_text}
        onChange={e => setValue('question_text', e.target.value)}
        placeholder="Enter question text"
        required
      />
      <select
        className="border px-2 py-1 rounded w-48 mb-2"
        value={question.type}
        onChange={e => {
          if (e.target.value === 'multiple_choice') {
            onChange({
              ...question,
              type: 'multiple_choice',
              options: question.options.length >= 2 ? question.options : ['', ''],
              correct_answer: null,
            });
          } else {
            onChange({
              ...question,
              type: 'text_answer',
              options: [],
              correct_answer: null,
            });
          }
        }}
      >
        <option value="multiple_choice">Multiple Choice</option>
        <option value="text_answer">Text Answer</option>
      </select>
      {question.type === 'multiple_choice' && (
        <div>
          <label className="block font-medium mb-1">Options</label>
          {question.options.map((opt, optIdx) => (
            <div key={optIdx} className="flex items-center gap-2 mb-1">
              <input
                className="border rounded px-2 py-1 flex-1"
                value={opt}
                onChange={e => handleOptionChange(optIdx, e.target.value)}
                placeholder={`Option ${optIdx + 1}`}
                required
              />
              <input
                type="radio"
                name={`correct-${question.id}`}
                checked={question.correct_answer === optIdx}
                onChange={() => handleCorrectChange(optIdx)}
                aria-label="Select as correct answer"
              />
              <span className="text-xs">Correct</span>
              {question.options.length > 2 && (
                <button
                  type="button"
                  className="text-red-500"
                  onClick={() => handleRemoveOption(optIdx)}
                  aria-label="Remove option"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="mt-1 px-2 py-1 bg-gray-200 rounded"
            onClick={handleAddOption}
          >
            Add Option
          </button>
        </div>
      )}
    </div>
  );
}

export default function CreateTestPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [testData, setTestData] = useState<TestData>({
    name: '',
    duration_minutes: 30,
    material_url: '',
    material_file_url: '',
    allow_file_upload: false,
    file_upload_limit_mb: 10,
    candidate_emails: '',
    questions: [],
  });

  // ---- Question logic ----
  const moveQuestion = (dragIndex: number, hoverIndex: number) => {
    setTestData(prev => {
      const questions = [...prev.questions];
      const [removed] = questions.splice(dragIndex, 1);
      questions.splice(hoverIndex, 0, removed);
      return {
        ...prev,
        questions: questions.map((q, idx) => ({ ...q, order: idx })),
      };
    });
  };

  const updateQuestion = (idx: number, q: Question) => {
    setTestData(prev => {
      const questions = [...prev.questions];
      questions[idx] = q;
      return { ...prev, questions };
    });
  };

  const addQuestion = () => {
    setTestData(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          id: uuidv4(),
          question_text: '',
          type: 'multiple_choice',
          options: ['', ''],
          correct_answer: null,
          order: prev.questions.length,
        },
      ],
    }));
  };

  const removeQuestion = (idx: number) => {
    setTestData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order: i })),
    }));
  };

  // ---- File upload ----
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `test-materials/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('test-materials')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('test-materials')
        .getPublicUrl(filePath);

      setTestData(prev => ({
        ...prev,
        material_file_url: urlData.publicUrl,
        material_url: '', // clear material_url if uploading file
      }));
      setUploadedFile(file);
    } catch (err: any) {
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // ---- Submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!testData.name.trim()) throw new Error('Test name is required');
      if (!testData.material_url && !testData.material_file_url) throw new Error('Please provide a material link or upload a file');
      if (testData.questions.length === 0) throw new Error('Add at least one question');

      // Validate MCQ options
      for (const q of testData.questions) {
        if (!q.question_text.trim()) throw new Error('All questions must have text');
        if (q.type === 'multiple_choice') {
          if (!q.options || q.options.length < 2) throw new Error('MCQ must have at least 2 options');
          if (q.options.some(opt => !opt.trim())) throw new Error('All MCQ options must have text');
          if (q.correct_answer == null || q.correct_answer < 0 || q.correct_answer >= q.options.length) throw new Error('Select a correct answer for each MCQ');
        }
      }

      // Validate candidate emails
      const emailList = testData.candidate_emails
        .split(/[\s,;]+/)
        .map(e => e.trim())
        .filter(e => e.includes('@'));
      if (emailList.length === 0) throw new Error('Add at least one valid candidate email');

      // Get session for creator_id
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in to create a test');

      // Create test (always draft)
      const { data: test, error: testError } = await supabase
        .from('tests')
        .insert({
          name: testData.name.trim(),
          duration_minutes: testData.duration_minutes,
          material_url: testData.material_url,
          material_file_url: testData.material_file_url,
          creator_id: session.user.id,
          status: 'draft',
          candidate_emails: emailList,
        })
        .select()
        .single();

      if (testError || !test) throw testError || new Error('Could not create test');

      // Create test config
      await supabase
        .from('test_configs')
        .insert({
          test_id: test.id,
          allow_file_upload: testData.allow_file_upload,
          file_upload_limit_mb: testData.file_upload_limit_mb,
        });

      // Create questions
      await supabase
        .from('questions')
        .insert(
          testData.questions.map((q, idx) => ({
            test_id: test.id,
            question_text: q.question_text,
            type: q.type,
            options: q.type === 'multiple_choice' ? q.options : [],
            correct_answer: q.type === 'multiple_choice' ? q.options[q.correct_answer!] : null,
            order_number: idx,
          }))
        );

      router.push(`/dashboard/tests/${test.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <main className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Test Details Section */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-6">Test Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-1">Test Name</label>
                <input
                  type="text"
                  value={testData.name}
                  onChange={e => setTestData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border rounded p-2"
                  required
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  value={testData.duration_minutes}
                  onChange={e => setTestData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) }))}
                  min="1"
                  className="w-full border rounded p-2"
                  required
                />
              </div>
            </div>
          </section>
          {/* Test Material Section */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-6">Test Material</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-4">
                <div className="flex-1">
                  <label className="block font-medium mb-1">Material Link</label>
                  <input
                    type="text"
                    value={testData.material_url}
                    onChange={e =>
                      setTestData(prev => ({
                        ...prev,
                        material_url: e.target.value,
                        material_file_url: '', // Clear file if link is being set
                      }))
                    }
                    className="w-full border rounded p-2"
                    placeholder="https://docs.google.com/..."
                  />
                </div>
                <div className="text-center">
                  <span className="block font-medium mb-1">OR</span>
                </div>
                <div className="flex-1">
                  <label className="block font-medium mb-1">Upload File</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                      className="border rounded p-2"
                      accept=".pdf,.doc,.docx,.ppt,.pptx"
                    />
                    {uploading && <span className="text-blue-600">Uploading...</span>}
                  </div>
                  {uploadedFile && (
                    <p className="text-sm text-green-600 mt-1">
                      Uploaded: {uploadedFile.name}
                    </p>
                  )}
                </div>
              </div>
              {(testData.material_file_url || testData.material_url) && (
                <div className="text-sm mt-2">
                  <span className="font-semibold">Material Provided: </span>
                  {testData.material_file_url ? (
                    <span className="text-blue-800">File uploaded</span>
                  ) : (
                    <span className="text-blue-800">Link provided</span>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={testData.allow_file_upload}
                    onChange={e => setTestData(prev => ({ ...prev, allow_file_upload: e.target.checked }))}
                  />
                  <span>Allow candidates to upload files</span>
                </label>
                {testData.allow_file_upload && (
                  <div>
                    <label className="block font-medium mb-1">File Upload Limit (MB)</label>
                    <input
                      type="number"
                      value={testData.file_upload_limit_mb}
                      onChange={e => setTestData(prev => ({ ...prev, file_upload_limit_mb: parseInt(e.target.value) }))}
                      min="1"
                      className="w-32 border rounded p-2"
                    />
                  </div>
                )}
              </div>
            </div>
          </section>
          {/* Questions Section */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-6">Questions</h2>
            <DndProvider backend={HTML5Backend}>
              <div className="space-y-6">
                {testData.questions.map((question, index) => (
                  <QuestionEditor
                    key={question.id}
                    question={question}
                    index={index}
                    moveQuestion={moveQuestion}
                    onChange={q => updateQuestion(index, q)}
                    onDelete={() => removeQuestion(index)}
                  />
                ))}
                <button
                  type="button"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={addQuestion}
                >
                  Add Question
                </button>
              </div>
            </DndProvider>
          </section>
          {/* Candidates Section */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-6">Candidates</h2>
            <div>
              <label className="block font-medium mb-1">Candidate Emails</label>
              <textarea
                value={testData.candidate_emails}
                onChange={e => setTestData(prev => ({ ...prev, candidate_emails: e.target.value }))}
                className="w-full border rounded p-2 h-32"
                placeholder="Enter email addresses (separated by commas or new lines)"
                required
              />
            </div>
          </section>
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded">
              {error}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Creating Test...' : 'Create Test'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}