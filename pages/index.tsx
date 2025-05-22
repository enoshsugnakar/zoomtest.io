// pages/index.tsx
import React from 'react'
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <h1 className="text-4xl font-extrabold mb-4 text-center">
        Zoomtest.io MVP
      </h1>
      <p className="text-lg text-gray-700 mb-8 text-center max-w-2xl">
        A timed test brief platform for creative agencies. Upload your test
        materials, set a time limit, and invite candidates—streamline your
        hiring process in minutes.
      </p>
      <Link 
        href="/auth/signup"
        className="px-6 py-3 bg-blue-600 text-white font-medium rounded hover:bg-blue-700"
      >
        Get Started
      </Link>
    </div>
  );
}