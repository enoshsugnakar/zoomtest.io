'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function NewTestPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [testName, setTestName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(30);
  const [emails, setEmails] = useState('');

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      router.push('/auth/login');
      return;
    }
    setUserId(session.user.id);
  }

  const handleFileUpload = async (file: File) => {
    const timestamp = new Date().getTime();
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}.${fileExt}`;
    const filePath = `test-materials/${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from('test-materials')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('test-materials')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check if user is authenticated
      if (!userId) {
        throw new Error('Please sign in to create a test');
      }

      // Validate inputs
      if (!testName.trim()) {
        throw new Error('Test name is required');
      }

      if (!file) {
        throw new Error('Please upload a test material file');
      }

      const emailList = emails
        .split(/[\s,;]+/)
        .map(e => e.trim())
        .filter(e => e.includes('@'));

      if (emailList.length === 0) {
        throw new Error('Add at least one valid email');
      }

      // Upload file first
      const materialUrl = await handleFileUpload(file);

      // Create test with creator_id
      const { data: test, error: testError } = await supabase
        .from('tests')
        .insert({
          name: testName.trim(),
          material_url: materialUrl,
          duration_minutes: duration,
          candidate_emails: emailList,
          creator_id: userId,
          status: 'draft'
        })
        .select('id')
        .single();

      if (testError) throw testError;

      if (!test?.id) {
        throw new Error('Failed to create test');
      }

      // Create test sessions
      const { error: sessionsError } = await supabase
        .from('test_sessions')
        .insert(
          emailList.map(email => ({
            test_id: test.id,
            candidate_email: email,
          }))
        );

      if (sessionsError) throw sessionsError;

      // Navigate to configure page
      router.push(`/dashboard/${test.id}/configure`);
    } catch (err: any) {
      console.error('Error creating test:', err);
      setError(err.message || 'Failed to create test');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-blue-600 hover:underline"
        >
          ← Back to Dashboard
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-6">Create New Test</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block font-medium mb-1">Test Name</label>
          <input
            type="text"
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            className="w-full border rounded p-2"
            placeholder="e.g., UX Design Challenge"
            required
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Upload Test Material</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full border rounded p-2"
            accept=".pdf,.doc,.docx"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Supported formats: PDF, DOC, DOCX
          </p>
        </div>

        <div>
          <label className="block font-medium mb-1">Duration (minutes)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
            min="1"
            className="w-full border rounded p-2"
            required
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Candidate Emails</label>
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            className="w-full border rounded p-2 h-32"
            placeholder="Enter emails separated by commas or new lines"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Enter one email per line or separate with commas
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className={`
              px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center
            `}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Test...
              </>
            ) : (
              'Create Test'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}