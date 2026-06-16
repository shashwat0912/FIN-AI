import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';

export default function SettingsHeader() {
  return (
    <div className="mb-6">
      <div className="flex items-center space-x-3">
        <SettingsIcon className="w-8 h-8 text-indigo-600" />
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>
      <p className="mt-2 text-gray-600">
        Manage your account preferences and personal information
      </p>
    </div>
  );
}