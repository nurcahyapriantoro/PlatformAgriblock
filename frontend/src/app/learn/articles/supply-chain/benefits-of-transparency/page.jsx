"use client";

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the content from the existing file with a loading fallback
const ArticleContent = dynamic(() => import('../benefits-of-transparency.jsx'), {
  loading: () => <div className="min-h-screen flex items-center justify-center">
    <div className="animate-pulse text-blue-500">Loading content...</div>
  </div>
});

export default function BenefitsOfTransparencyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-blue-500">Loading content...</div>
    </div>}>
      <ArticleContent />
    </Suspense>
  );
} 