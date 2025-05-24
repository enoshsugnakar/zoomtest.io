'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

interface Test {
  id: string;
  name: string;
  duration_minutes: number;
  material_url: string;
  status: string;
  created_at: string;
  candidate_emails: string[];
}

interface TestConfig {
  allow_file_upload: boolean;
  file_upload_limit_mb: number;
}

interface TestSession {
  candidate_email: string;
  access_token: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

export default function TestDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [test, setTest] = useState<Test | null>(null);
  const [testConfig, setTestConfig] = useState<TestConfig | null>(null);
  const [testSessions, setTestSessions] = useState<TestSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTestDetails = async () => {
      try {
        // Fetch test details
        const { data: testData, error: testError } = await supabase
          .from('tests')
          .select('*')
          .eq('id', params.id)
          .single();

        if (testError) throw testError;
        setTest(testData);

        // Fetch test config
        const { data: configData, error: configError } = await supabase
          .from('test_configs')
          .select('*')
          .eq('test_id', params.id)
          .single();

        if (configError) throw configError;
        setTestConfig(configData);

        // Fetch test sessions
        const { data: sessionData, error: sessionError } = await supabase
          .from('test_sessions')
          .select('*')
          .eq('test_id', params.id);

        if (sessionError) throw sessionError;
        setTestSessions(sessionData);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTestDetails();
  }, [params.id, supabase]);

  const handleEmailTest = async (email: string, testUrl: string) => {
    // Email functionality will be implemented later
    console.log('Sending test link to:', email, testUrl);
  };

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
        {/* Test Overview */}
        <section className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-start mb-6">
            <h1 className="text-2xl font-bold">{test.name}</h1>
            <span className={`px-3 py-1 rounded-full text-sm ${
              test.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {test.status}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-gray-600">Duration</p>
              <p className="font-medium">{test.duration_minutes} minutes</p>
            </div>
            <div>
              <p className="text-gray-600">Created</p>
              <p className="font-medium">{new Date(test.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-gray-600">Test Material</p>
            <a 
              href={test.material_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View Material
            </a>
          </div>

          {testConfig && (
            <div className="mt-4">
              <p className="text-gray-600">File Upload</p>
              <p className="font-medium">
                {testConfig.allow_file_upload 
                  ? `Allowed (up to ${testConfig.file_upload_limit_mb}MB)` 
                  : 'Not allowed'}
              </p>
            </div>
          )}
        </section>

        {/* Candidate List */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-6">Candidates</h2>
          <div className="space-y-4">
            {testSessions.map((session) => (
              <div 
                key={session.access_token} 
                className="flex items-center justify-between p-4 border rounded"
              >
                <div>
                  <p className="font-medium">{session.candidate_email}</p>
                  <p className="text-sm text-gray-600">
                    Status: {session.status}
                    {session.started_at && ` • Started: ${new Date(session.started_at).toLocaleString()}`}
                    {session.completed_at && ` • Completed: ${new Date(session.completed_at).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEmailTest(
                      session.candidate_email,
                      `${window.location.origin}/test/${params.id}/${session.access_token}`
                    )}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Send Test Link
                  </button>
                  <button
                    onClick={() => {
                      const testUrl = `${window.location.origin}/test/${params.id}/${session.access_token}`;
                      navigator.clipboard.writeText(testUrl);
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}