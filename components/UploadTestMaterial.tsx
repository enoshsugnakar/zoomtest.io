// components/UploadTestMaterial.tsx
'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
];

interface UploadTestMaterialProps {
  onUploadComplete: (publicUrl: string) => void;
}

export default function UploadTestMaterial({
  onUploadComplete,
}: UploadTestMaterialProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    if (selected && !ACCEPTED_FILE_TYPES.includes(selected.type)) {
      setError('Unsupported file type');
      setFile(null);
      return;
    }
    setFile(selected);
    setError('');
  };

  const uploadFile = async () => {
    if (!file) return;
    setUploading(true);

    // Log current session to confirm you’re authenticated
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  console.log('👤 Current session:', session, 'Error fetching session:', sessionError);


    const filePath = `${uuidv4()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('test-materials')
      .upload(filePath, file);

    if (uploadError) {
      setError('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('test-materials')
      .getPublicUrl(filePath);

    onUploadComplete(urlData.publicUrl);
    setUploading(false);
  };

  const handleLinkSubmit = () => {
    if (
      link.startsWith('https://docs.google.com/') ||
      link.startsWith('https://drive.google.com/')
    ) {
      onUploadComplete(link);
      setError('');
    } else {
      setError('Invalid Google Docs or Slides link');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block font-semibold">Upload a file</label>
        <input
          type="file"
          accept={ACCEPTED_FILE_TYPES.join(',')}
          onChange={handleFileChange}
          className="block mt-1"
        />
      </div>

      {file && <p className="text-sm">Selected: {file.name}</p>}

      <button
        disabled={!file || uploading}
        onClick={uploadFile}
        className="mt-2 bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {uploading ? 'Uploading...' : 'Upload File'}
      </button>

      <div className="border-t pt-4">
        <label className="block font-semibold">Or paste a Google Docs/Slides link</label>
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://docs.google.com/..."
          className="border px-3 py-2 rounded w-full mt-1"
        />
        <button
          onClick={handleLinkSubmit}
          className="mt-2 bg-green-600 text-white px-4 py-2 rounded"
        >
          Use Link
        </button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}
