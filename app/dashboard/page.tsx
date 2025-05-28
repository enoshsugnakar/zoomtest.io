'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

interface Test {
  id: string;
  name: string;
  created_at: string;
  candidate_emails: string[];
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTests();
  }, []);

  async function loadTests() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth/login');
        return;
      }

      const { data, error } = await supabase
        .from('tests')
        .select('id, name, created_at, candidate_emails')
        .eq('creator_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setTests(data);
    } catch (error) {
      console.error('Error loading tests:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Tests</h1>
        <div className="space-x-4">
          <button
            onClick={() => router.push('/dashboard/create-test')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create New Test
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/auth/login');
            }}
            className="text-gray-600 hover:text-gray-800"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {tests.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No tests created yet. Click "Create New Test" to get started.
          </p>
        ) : (
          tests.map((test) => (
            <div
              key={test.id}
              onClick={() => router.push(`/dashboard/tests/${test.id}`)}
              className="border rounded-lg p-6 bg-white hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold">{test.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Created {new Date(test.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-sm text-gray-500">
                  {test.candidate_emails.length} candidates
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}