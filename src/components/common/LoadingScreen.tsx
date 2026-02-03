import React from 'react';
import { BrainCircuit } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="text-center">
        <BrainCircuit className="h-12 w-12 text-indigo-600 mx-auto animate-bounce" />
        <h2 className="mt-4 text-xl font-semibold text-gray-900">Loading FinanceAI</h2>
      </div>
    </div>
  );
}