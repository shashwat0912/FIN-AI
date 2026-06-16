import React from 'react';
import { User, Mail, Phone, Camera } from 'lucide-react';

export default function ProfileSettings() {
  return (
    <div className="glass-card p-6 mb-6 border-t-4 border-indigo-500">
      <h2 className="text-xl font-semibold mb-4 text-gray-900">Profile Settings</h2>
      <div className="mb-6">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center">
              <User className="w-10 h-10 text-indigo-600" />
            </div>
            <button className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 rounded-full text-white
                           hover:bg-indigo-700 transition-colors duration-200
                           focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Profile Photo</h3>
            <p className="text-sm text-gray-500">Update your profile picture</p>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
          <User className="w-5 h-5 text-indigo-600" />
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              className="input-primary mt-1"
              placeholder="John Doe"
            />
          </div>
        </div>
        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
          <Mail className="w-5 h-5 text-indigo-600" />
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              className="input-primary mt-1"
              placeholder="john@example.com"
            />
          </div>
        </div>
        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
          <Phone className="w-5 h-5 text-indigo-600" />
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              className="input-primary mt-1"
              placeholder="+91 98765 43210"
            />
          </div>
        </div>
        <button className="btn-primary w-full mt-4">
          Save Changes
        </button>
      </div>
    </div>
  );
}