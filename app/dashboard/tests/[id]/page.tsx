'use client';

import { useState, useEffect, useRef } from 'react';
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
  order_number: number;
}

interface Test {
  id: string;
  name: string;
  duration_minutes: number;
  material_url: string | null;
  material_file_url: string | null;
  status: string;
  created_at: string;
  candidate_emails: string[];
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

function QuestionEditor({
  question,
  index,
  moveQuestion,
  onChange,
  onDelete,
  editable,
}: {
  question: Question;
  index: number;
  moveQuestion: (dragIndex: number, hoverIndex: number) => void;
  onChange: (q: Question) => void;
  onDelete: () => void;
  editable: boolean;
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
    canDrag: editable,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  drag(drop(ref));

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
      style={{ cursor: editable ? 'move' : 'default' }}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold">Q{index + 1}</span>
        {editable && (
          <button
            type="button"
            className="text-red-600"
            onClick={onDelete}
          >
            Delete
          </button>
        )}
      </div>
      <input
        className="w-full border rounded px-2 py-1 mb-2"
        value={question.question_text}
        onChange={e => editable && setValue('question_text', e.target.value)}
        placeholder="Enter question text"
        required
        disabled={!editable}
      />
      <select
        className="border px-2 py-1 rounded w-48 mb-2"
        value={question.type}
        onChange={e => {
          if (!editable) return;
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
        disabled={!editable}
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
                onChange={e => editable && handleOptionChange(optIdx, e.target.value)}
                placeholder={`Option ${optIdx + 1}`}
                required
                disabled={!editable}
              />
              <input
                type="radio"
                name={`correct-${question.id}`}
                checked={question.correct_answer === optIdx}
                onChange={() => editable && handleCorrectChange(optIdx)}
                aria-label="Select as correct answer"
                disabled={!editable}
              />
              <span className="text-xs">Correct</span>
              {editable && question.options.length > 2 && (
                <button
                  type="button"
                  className="text-red-500"
                  onClick={() => handleRemoveOption(optIdx)}
                  aria-label="Remove option"
                  disabled={!editable}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {editable && (
            <button
              type="button"
              className="mt-1 px-2 py-1 bg-gray-200 rounded"
              onClick={handleAddOption}
            >
              Add Option
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function TestDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [test, setTest] = useState<Test | null>(null);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editTest, setEditTest] = useState<Test | null>(null);
  const [editQuestions, setEditQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch test, sessions, questions
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError('');
      try {
        // Fetch test details
        const { data: testData, error: testError } = await supabase
          .from('tests')
          .select('*')
          .eq('id', params.id)
          .maybeSingle();

        if (testError) throw testError;
        if (!testData) throw new Error('Test not found');
        if (typeof testData.candidate_emails === 'string') {
          try {
            testData.candidate_emails = JSON.parse(testData.candidate_emails);
          } catch {
            testData.candidate_emails = [];
          }
        }
        setTest(testData);
        setEditTest(testData);

        // Fetch sessions
        const { data: sessionData, error: sessionError } = await supabase
          .from('test_sessions')
          .select('*')
          .eq('test_id', params.id)
          .order('id', { ascending: true });
        if (sessionError) throw sessionError;
        setSessions(sessionData || []);

        // Fetch questions
        const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('test_id', params.id)
          .order('order_number', { ascending: true });
        if (questionsError) throw questionsError;
        setQuestions(questionsData.map((q: any) => ({
          ...q,
          correct_answer: q.type === 'multiple_choice' && q.correct_answer
            ? q.options.findIndex((opt: string) => opt === q.correct_answer)
            : null
        })) || []);
        setEditQuestions(questionsData.map((q: any) => ({
          ...q,
          correct_answer: q.type === 'multiple_choice' && q.correct_answer
            ? q.options.findIndex((opt: string) => opt === q.correct_answer)
            : null
        })) || []);
      } catch (err: any) {
        setError(err.message || 'Error loading test');
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
    // eslint-disable-next-line
  }, [params.id]);

  // Status change and create sessions if activating
  async function handleStatusChange(newStatus: string) {
    if (!test) return;
    setStatusSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const { error: testError } = await supabase
        .from('tests')
        .update({ status: newStatus })
        .eq('id', test.id);
      if (testError) throw testError;
      setTest({ ...test, status: newStatus });
      setEditTest(editTest ? { ...editTest, status: newStatus } : null);
      setSuccessMsg('Test status updated!');
      setTimeout(() => setSuccessMsg(''), 2000);

      // When activating, create missing sessions for candidates
      if (newStatus === 'active') {
        for (const email of test.candidate_emails) {
          const { data: existingSession } = await supabase
            .from('test_sessions')
            .select('id')
            .eq('test_id', test.id)
            .eq('candidate_email', email)
            .maybeSingle();
          if (!existingSession) {
            const access_token = uuidv4();
            await supabase.from('test_sessions').insert({
              test_id: test.id,
              candidate_email: email,
              access_token,
              status: 'not_started'
            });
          }
        }
        // Refetch sessions after creation
        const { data: sessionData } = await supabase
          .from('test_sessions')
          .select('*')
          .eq('test_id', test.id)
          .order('id', { ascending: true });
        setSessions(sessionData || []);
      }
      if (newStatus === 'inactive') setEditMode(false);
    } catch (err: any) {
      setError('Could not update test status');
    } finally {
      setStatusSaving(false);
    }
  }

  const isEditable = !!(test && (test.status === 'draft' || test.status === 'active'));

  function handleEditChange<K extends keyof Test>(key: K, value: Test[K]) {
    if (!editTest) return;
    setEditTest({ ...editTest, [key]: value });
  }

  // File upload
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

      setEditTest(prev => prev ? ({
        ...prev,
        material_file_url: urlData.publicUrl,
        material_url: '', // Clear link if uploading file
      }) : null);
      setUploadedFile(file);
    } catch (err: any) {
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Question handlers
  const moveQuestion = (dragIndex: number, hoverIndex: number) => {
    setEditQuestions(qs => {
      const next = [...qs];
      const [removed] = next.splice(dragIndex, 1);
      next.splice(hoverIndex, 0, removed);
      return next.map((q, idx) => ({ ...q, order_number: idx }));
    });
  };
  const updateQuestion = (idx: number, q: Question) => {
    setEditQuestions(prev => {
      const qs = [...prev];
      qs[idx] = q;
      return qs;
    });
  };
  const addQuestion = () => {
    setEditQuestions(prev => [
      ...prev,
      {
        id: uuidv4(),
        question_text: '',
        type: 'multiple_choice',
        options: ['', ''],
        correct_answer: null,
        order_number: prev.length,
      },
    ]);
  };
  const removeQuestion = (idx: number) => {
    setEditQuestions(prev =>
      prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order_number: i }))
    );
  };

  // Save
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editTest) return;
    setSaving(true);
    setSuccessMsg('');
    setError('');
    try {
      // Validate
      if (!editTest.name.trim()) throw new Error('Test name is required');
      if (!editTest.material_url && !editTest.material_file_url)
        throw new Error('Please provide a material link or upload a file');
      if (editQuestions.length === 0) throw new Error('Add at least one question');
      for (const q of editQuestions) {
        if (!q.question_text.trim())
          throw new Error('All questions must have text');
        if (q.type === 'multiple_choice') {
          if (!q.options || q.options.length < 2)
            throw new Error('MCQ must have at least 2 options');
          if (q.options.some(opt => !opt.trim()))
            throw new Error('All MCQ options must have text');
          if (
            q.correct_answer == null ||
            q.correct_answer < 0 ||
            q.correct_answer >= q.options.length
          )
            throw new Error('Select a correct answer for each MCQ');
        }
      }
      // Save test
      const { error: testError } = await supabase
        .from('tests')
        .update({
          name: editTest.name,
          duration_minutes: editTest.duration_minutes,
          material_url: editTest.material_url,
          material_file_url: editTest.material_file_url,
          status: editTest.status,
        })
        .eq('id', editTest.id);
      if (testError) throw testError;

      // Save questions: upsert (update if id, insert if new), delete removed
      const existingIds = new Set(questions.map(q => q.id));
      for (const q of editQuestions) {
        if (existingIds.has(q.id)) {
          await supabase.from('questions').update({
            question_text: q.question_text,
            type: q.type,
            options: q.type === 'multiple_choice' ? q.options : [],
            correct_answer: q.type === 'multiple_choice' && q.correct_answer != null
              ? q.options[q.correct_answer]
              : null,
            order_number: q.order_number,
          }).eq('id', q.id);
        } else {
          await supabase.from('questions').insert({
            test_id: editTest.id,
            question_text: q.question_text,
            type: q.type,
            options: q.type === 'multiple_choice' ? q.options : [],
            correct_answer: q.type === 'multiple_choice' && q.correct_answer != null
              ? q.options[q.correct_answer]
              : null,
            order_number: q.order_number,
          });
        }
      }
      for (const q of questions) {
        if (!editQuestions.find(eq => eq.id === q.id)) {
          await supabase.from('questions').delete().eq('id', q.id);
        }
      }
      setTest(editTest);
      setQuestions([...editQuestions]);
      setEditMode(false);
      setSuccessMsg('Test and questions updated!');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err: any) {
      setError(err.message || 'Error updating test');
    } finally {
      setSaving(false);
    }
  }

  function formatTimeTaken(seconds?: number | null) {
    if (!seconds || seconds <= 0) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }

  function getTestLinkForCandidate(session: TestSession | undefined) {
    if (session && session.access_token)
      return `${typeof window !== "undefined" ? window.location.origin : ""}/test/${session.access_token}`;
    return '';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading test details...</div>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="bg-red-50 text-red-600 p-4 rounded">
          {error || 'Test not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <main className="max-w-4xl mx-auto space-y-8">
        {/* Test Overview + Edit */}
        <section className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-start mb-6">
            <h1 className="text-2xl font-bold">
              {editMode ? (
                <input
                  className="border px-2 py-1 rounded w-72"
                  value={editTest?.name || ''}
                  onChange={e => handleEditChange('name', e.target.value)}
                  required
                  disabled={!isEditable}
                />
              ) : (
                test.name
              )}
            </h1>
            <span className="flex flex-col items-end">
              <select
                value={test.status}
                onChange={e => handleStatusChange(e.target.value)}
                className="border rounded px-2 py-1 font-semibold"
                disabled={statusSaving}
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
              <span className={`text-xs mt-1 ${
                test.status === 'active' ? 'text-green-800'
                  : test.status === 'inactive' ? 'text-red-800'
                  : 'text-gray-600'
              }`}>
                {statusSaving ? "Saving..." : "Current: " + test.status}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-gray-600">Duration</p>
              {editMode ? (
                <input
                  type="number"
                  className="border px-2 py-1 rounded w-32"
                  value={editTest?.duration_minutes || ''}
                  onChange={e => handleEditChange('duration_minutes', Number(e.target.value))}
                  required
                  min={1}
                  disabled={!isEditable}
                />
              ) : (
                <p className="font-medium">{test.duration_minutes} minutes</p>
              )}
            </div>
            <div>
              <p className="text-gray-600">Created</p>
              <p className="font-medium">{new Date(test.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-gray-600">Test Material</p>
              {editMode ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editTest?.material_url || ''}
                    onChange={e => setEditTest(prev => prev ? ({
                      ...prev,
                      material_url: e.target.value,
                      material_file_url: '', // Clear file if editing link
                    }) : null)}
                    className="w-full border rounded p-2"
                    placeholder="Material link (https://...)"
                    disabled={!isEditable}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                      className="border rounded p-2"
                      accept=".pdf,.doc,.docx,.ppt,.pptx"
                      disabled={!isEditable}
                    />
                    {uploading && <span className="text-blue-600">Uploading...</span>}
                  </div>
                  {uploadedFile && (
                    <p className="text-sm text-green-600 mt-1">
                      Uploaded: {uploadedFile.name}
                    </p>
                  )}
                  {(editTest?.material_file_url || editTest?.material_url) && (
                    <div className="text-xs mt-1">
                      {editTest?.material_file_url
                        ? <span className="text-blue-800">File uploaded</span>
                        : <span className="text-blue-800">Link provided</span>
                      }
                    </div>
                  )}
                </div>
              ) : (
                test.material_file_url ? (
                  <a
                    href={test.material_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Download Material File
                  </a>
                ) : test.material_url ? (
                  <a
                    href={test.material_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {test.material_url}
                  </a>
                ) : (
                  <span className="text-gray-400">N/A</span>
                )
              )}
            </div>
            <div>
              <p className="text-gray-600">Candidates</p>
              <p className="font-medium">{test.candidate_emails.length}</p>
            </div>
          </div>
          {successMsg && (
            <div className="text-green-700 mb-2">{successMsg}</div>
          )}
          {editMode ? (
            <form onSubmit={handleSave}>
              <div className="mt-8 mb-4">
                <h2 className="text-lg font-semibold mb-2">Questions</h2>
                <DndProvider backend={HTML5Backend}>
                  <div className="space-y-6">
                    {editQuestions.map((q, i) => (
                      <QuestionEditor
                        key={q.id}
                        question={q}
                        index={i}
                        moveQuestion={moveQuestion}
                        onChange={q2 => updateQuestion(i, q2)}
                        onDelete={() => removeQuestion(i)}
                        editable={isEditable}
                      />
                    ))}
                    <button
                      type="button"
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={addQuestion}
                      disabled={!isEditable}
                    >
                      Add Question
                    </button>
                  </div>
                </DndProvider>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  onClick={() => {
                    setEditTest(test);
                    setEditQuestions(questions);
                    setEditMode(false);
                    setUploadedFile(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            test.status !== 'inactive' && (
              <button
                onClick={() => isEditable && setEditMode(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mt-4"
                disabled={!isEditable}
                title={isEditable ? '' : 'Only editable when test is draft or active'}
              >
                Edit Test Details
              </button>
            )
          )}
          {error && (
            <div className="text-red-600 mt-2">{error}</div>
          )}
        </section>

        {/* Candidate List */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-6">Candidates</h2>
          <div className="space-y-4">
            {test.candidate_emails.length === 0 && (
              <div className="text-gray-500">No candidates added to this test.</div>
            )}
            {test.candidate_emails.map((candidate, idx) => {
              const session = sessions.find(s => s.candidate_email === candidate);
              const testLink = getTestLinkForCandidate(session);
              const showSessionActions = session && test.status === 'active';
              return (
                <div key={candidate} className="flex items-center justify-between p-4 border rounded">
                  <div>
                    <p className="font-medium">{candidate}</p>
                    {session ? (
                      <p className="text-sm text-gray-600">
                        Status: {session.status || "Not started"}
                        {session.started_at && ` • Started: ${new Date(session.started_at).toLocaleString()}`}
                        {session.submitted_at && (
                          <>
                            <br />Submitted: {new Date(session.submitted_at).toLocaleString()}
                            <br />Time Taken: {formatTimeTaken(session.time_taken_seconds)}
                          </>
                        )}
                        <br />
                        {showSessionActions && session.access_token && (
                          <span className="text-xs text-gray-400 break-all">
                            Test Link: <span className="font-mono">{testLink}</span>
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        No session created for this candidate yet.<br />
                        {test.status === 'active' && <span className="text-xs text-red-600">Session will be created on activation or check your session creation logic.</span>}
                      </p>
                    )}
                  </div>
                  {showSessionActions && session.access_token && (
                    <div className="flex flex-col gap-2">
                      <a
                        href={testLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-center"
                      >
                        Preview Link
                      </a>
                      <button
                        type="button"
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 opacity-60 cursor-not-allowed"
                        title="Email sending not yet implemented"
                        disabled
                      >
                        Send Test Link
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Questions Section */}
        {!editMode && (
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-6">Questions</h2>
            {questions.length === 0 && (
              <div className="text-gray-500">No questions found for this test.</div>
            )}
            <ol className="space-y-4 list-decimal list-inside">
              {questions.map((q, idx) => (
                <li key={q.id} className="border rounded p-4 bg-gray-50">
                  <div>
                    <span className="font-semibold">
                      {q.type === 'multiple_choice' ? 'Multiple Choice' : 'Text Answer'}
                    </span>
                  </div>
                  <div className="mb-2">{q.question_text}</div>
                  {q.type === 'multiple_choice' && (
                    <div className="ml-2">
                      <ul className="list-disc list-inside">
                        {q.options.map((opt, oidx) => (
                          <li
                            key={oidx}
                            className={q.correct_answer !== null && q.correct_answer === oidx ? "text-green-700 font-semibold" : ""}
                          >
                            {opt}
                            {q.correct_answer !== null && q.correct_answer === oidx && (
                              <span className="ml-2 text-xs text-green-700 font-bold">(Correct Answer)</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}