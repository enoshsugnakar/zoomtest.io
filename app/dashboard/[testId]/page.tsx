'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Test {
  id: string;
  name: string;
  material_url: string;
  duration_minutes: number;
  candidate_emails: string[];
  created_at: string;
}

export default function TestDetailPage({
  params,
}: {
  params: { testId: string };
}) {
  const router = useRouter();
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTest();
  }, [params.testId]);

  async function loadTest() {
    const { data, error } = await supabase
      .from('tests')
      .select('*')
      .eq('id', params.testId)
      .single();

    if (error) {
      setError('Failed to load test');
      console.error(error);
    } else {
      setTest(data);
    }
    setLoading(false);
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!test) return <div className="p-8">Test not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{test.name}</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-blue-600 hover:underline"
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Test Setup Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-6 bg-white hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold mb-2">Configure Test</h2>
          <p className="text-gray-600 mb-4">
            Set up file upload options and other test settings
          </p>
          <button
            onClick={() => router.push(`/dashboard/${params.testId}/configure`)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Configure Settings
          </button>
        </div>

        <div className="border rounded-lg p-6 bg-white hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold mb-2">Manage Questions</h2>
          <p className="text-gray-600 mb-4">
            Create and organize test questions
          </p>
          <button
            onClick={() => router.push(`/dashboard/${params.testId}/questions`)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Manage Questions
          </button>
        </div>
      </div>

      {/* Test Information */}
      <div className="border rounded-lg p-6 bg-white">
        <h2 className="text-xl font-semibold mb-4">Test Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Created</dt>
            <dd className="mt-1">
              {new Date(test.created_at).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Duration</dt>
            <dd className="mt-1">{test.duration_minutes} minutes</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Material URL</dt>
            <dd className="mt-1">
              <a
                href={test.material_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {test.material_url}
              </a>
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Candidates</dt>
            <dd className="mt-1">
              <ul className="border rounded-lg divide-y">
                {test.candidate_emails.map((email) => (
                  <li key={email} className="px-4 py-2 text-sm">
                    {email}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}