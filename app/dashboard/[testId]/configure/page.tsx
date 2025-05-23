'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface TestConfig {
  id: string;
  test_id: string;
  allow_file_upload: boolean;
  file_upload_limit: number | null;
}

export default function ConfigurePage({ 
  params 
}: { 
  params: { testId: string } 
}) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<TestConfig>({
    id: '',
    test_id: params.testId,
    allow_file_upload: false,
    file_upload_limit: null,
  });

  useEffect(() => {
    loadConfig();
  }, [params.testId]);

  async function loadConfig() {
    try {
      const { data, error } = await supabase
        .from('test_configs')
        .select('*')
        .eq('test_id', params.testId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }

      if (data) {
        setConfig(data);
      }
    } catch (err: any) {
      console.error('Error loading config:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const { error } = await supabase
        .from('test_configs')
        .upsert({
          test_id: params.testId,
          allow_file_upload: config.allow_file_upload,
          file_upload_limit: config.file_upload_limit,
        });

      if (error) throw error;

      router.push(`/dashboard/${params.testId}/questions`);
    } catch (err: any) {
      console.error('Error saving config:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-6">
        <button
          onClick={() => router.push(`/dashboard/${params.testId}`)}
          className="text-blue-600 hover:underline"
        >
          ← Back to Test Details
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-6">Configure Test</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.allow_file_upload}
              onChange={(e) => setConfig(c => ({
                ...c,
                allow_file_upload: e.target.checked,
                file_upload_limit: e.target.checked ? c.file_upload_limit || 1 : null
              }))}
              className="rounded"
            />
            <span>Allow candidates to upload files</span>
          </label>
        </div>

        {config.allow_file_upload && (
          <div>
            <label className="block font-medium mb-1">
              Maximum number of files
            </label>
            <input
              type="number"
              value={config.file_upload_limit || 1}
              onChange={(e) => setConfig(c => ({
                ...c,
                file_upload_limit: Math.max(1, parseInt(e.target.value) || 1)
              }))}
              min="1"
              className="w-32 border rounded p-2"
            />
          </div>
        )}

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/${params.testId}`)}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ${
              saving ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {saving ? 'Saving...' : 'Save and Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}