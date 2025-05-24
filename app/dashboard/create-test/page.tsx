'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';
import QuestionItems from '@/components/QuestionItems';

interface Question {
  id: string;
  question_text: string;
  type: 'multiple_choice' | 'text_answer';
  options?: string[];
  correct_answer?: string;
  order: number;
}

interface TestData {
  name: string;
  duration_minutes: number;
  material_url: string;
  allow_file_upload: boolean;
  file_upload_limit_mb: number;
  candidate_emails: string;
  questions: Question[];
}

export default function CreateTestPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testLinks, setTestLinks] = useState<{[key: string]: string}>({});
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [testData, setTestData] = useState<TestData>({
    name: '',
    duration_minutes: 30,
    material_url: '',
    allow_file_upload: false,
    file_upload_limit_mb: 10,
    candidate_emails: '',
    questions: []
  });

  const handleTestDataChange = (field: keyof TestData, value: any) => {
    setTestData(prev => ({
      ...prev,
      [field]: value
    }));
  };

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
        material_url: urlData.publicUrl
      }));
      setUploadedFile(file);
    } catch (err: any) {
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleQuestionUpdate = (questionId: string, field: string, value: any) => {
    setTestData(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === questionId ? { ...q, [field]: value } : q
      )
    }));
  };

  const handleQuestionAdd = () => {
    const newQuestion: Question = {
      id: uuidv4(),
      question_text: '',
      type: 'multiple_choice',
      options: ['', '', '', ''],
      correct_answer: '',
      order: testData.questions.length
    };

    setTestData(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));
  };

  const moveQuestion = (dragIndex: number, hoverIndex: number) => {
    setTestData(prev => {
      const newQuestions = [...prev.questions];
      const [removed] = newQuestions.splice(dragIndex, 1);
      newQuestions.splice(hoverIndex, 0, removed);
      return {
        ...prev,
        questions: newQuestions.map((q, index) => ({ ...q, order: index }))
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate inputs
      if (!testData.name.trim()) throw new Error('Test name is required');
      if (!testData.material_url) throw new Error('Please provide test material (upload file or add link)');
      if (testData.questions.length === 0) throw new Error('Add at least one question');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in to create a test');

      // Process candidate emails
      const emailList = testData.candidate_emails
        .split(/[\s,;]+/)
        .map(e => e.trim())
        .filter(e => e.includes('@'));

      if (emailList.length === 0) throw new Error('Add at least one valid candidate email');

      // Create test
      const { data: test, error: testError } = await supabase
        .from('tests')
        .insert({
          name: testData.name.trim(),
          duration_minutes: testData.duration_minutes,
          material_url: testData.material_url,
          creator_id: session.user.id,
          status: 'active',
          candidate_emails: emailList
        })
        .select()
        .single();

      if (testError) throw testError;

      // Create test config
      await supabase
        .from('test_configs')
        .insert({
          test_id: test.id,
          allow_file_upload: testData.allow_file_upload,
          file_upload_limit_mb: testData.file_upload_limit_mb
        });

      // Create questions
      const { error: questionsError } = await supabase
        .from('questions')
        .insert(
          testData.questions.map(q => ({
            test_id: test.id,
            question_text: q.question_text,
            type: q.type,
            options: q.options,
            correct_answer: q.correct_answer,
            order_number: q.order
          }))
        );

      if (questionsError) throw questionsError;

      // Generate and store test links
      const links: {[key: string]: string} = {};
      emailList.forEach(email => {
        const uniqueId = uuidv4();
        links[email] = `${window.location.origin}/test/${test.id}/${uniqueId}`;
      });
      setTestLinks(links);

      // Create test sessions
      const testSessions = Object.entries(links).map(([email, link]) => ({
        test_id: test.id,
        candidate_email: email,
        access_token: link.split('/').pop() as string
      }));

      await supabase
        .from('test_sessions')
        .insert(testSessions);

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
                  onChange={(e) => handleTestDataChange('name', e.target.value)}
                  className="w-full border rounded p-2"
                  placeholder="e.g., UX Design Challenge"
                  required
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  value={testData.duration_minutes}
                  onChange={(e) => handleTestDataChange('duration_minutes', parseInt(e.target.value))}
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
                    onChange={(e) => handleTestDataChange('material_url', e.target.value)}
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
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
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
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={testData.allow_file_upload}
                    onChange={(e) => handleTestDataChange('allow_file_upload', e.target.checked)}
                  />
                  <span>Allow candidates to upload files</span>
                </label>
                {testData.allow_file_upload && (
                  <div>
                    <label className="block font-medium mb-1">File Upload Limit (MB)</label>
                    <input
                      type="number"
                      value={testData.file_upload_limit_mb}
                      onChange={(e) => handleTestDataChange('file_upload_limit_mb', parseInt(e.target.value))}
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
              <div className="space-y-4">
                {testData.questions.map((question, index) => (
                  <QuestionItems
                    key={question.id}
                    question={question}
                    index={index}
                    onUpdate={handleQuestionUpdate}
                    onMove={moveQuestion}
                  />
                ))}
              </div>
            </DndProvider>
            <button
              type="button"
              onClick={handleQuestionAdd}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add Question
            </button>
          </section>

          {/* Candidates Section */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-6">Candidates</h2>
            <div>
              <label className="block font-medium mb-1">Candidate Emails</label>
              <textarea
                value={testData.candidate_emails}
                onChange={(e) => handleTestDataChange('candidate_emails', e.target.value)}
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