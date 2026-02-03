import React from 'react';
import { Bell, MessageSquare, Mail, AlertTriangle, CreditCard, TrendingUp } from 'lucide-react';

export default function NotificationSettings() {
  return (
    <div className="glass-card p-6 mb-6 border-t-4 border-purple-500">
      <h2 className="text-xl font-semibold mb-4 text-gray-900">Notification Preferences</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <Bell className="w-5 h-5 text-purple-600" />
            <div>
              <p className="font-medium">Push Notifications</p>
              <p className="text-sm text-gray-500">Get notified about important updates</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 
                          peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full 
                          peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] 
                          after:left-[2px] after:bg-white after:border-gray-300 after:border 
                          after:rounded-full after:h-5 after:w-5 after:transition-all 
                          peer-checked:bg-purple-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-5 h-5 text-purple-600" />
            <div>
              <p className="font-medium">Transaction Alerts</p>
              <p className="text-sm text-gray-500">Notifications for all transactions</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 
                          peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full 
                          peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] 
                          after:left-[2px] after:bg-white after:border-gray-300 after:border 
                          after:rounded-full after:h-5 after:w-5 after:transition-all 
                          peer-checked:bg-purple-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <div>
              <p className="font-medium">Investment Updates</p>
              <p className="text-sm text-gray-500">Get market insights and portfolio updates</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 
                          peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full 
                          peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] 
                          after:left-[2px] after:bg-white after:border-gray-300 after:border 
                          after:rounded-full after:h-5 after:w-5 after:transition-all 
                          peer-checked:bg-purple-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-purple-600" />
            <div>
              <p className="font-medium">Security Alerts</p>
              <p className="text-sm text-gray-500">Important security notifications</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 
                          peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full 
                          peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] 
                          after:left-[2px] after:bg-white after:border-gray-300 after:border 
                          after:rounded-full after:h-5 after:w-5 after:transition-all 
                          peer-checked:bg-purple-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <Mail className="w-5 h-5 text-purple-600" />
            <div>
              <p className="font-medium">Email Reports</p>
              <p className="text-sm text-gray-500">Weekly financial reports and insights</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 
                          peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full 
                          peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] 
                          after:left-[2px] after:bg-white after:border-gray-300 after:border 
                          after:rounded-full after:h-5 after:w-5 after:transition-all 
                          peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </div>
    </div>
  );
}