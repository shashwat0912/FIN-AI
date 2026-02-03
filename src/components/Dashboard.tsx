import React from 'react';
import StatsCards from './dashboard/StatsCards';
import BalanceChart from './dashboard/BalanceChart';
import AiAdvisor from './dashboard/AiAdvisor';

export default function Dashboard() {
  return (
    <div className="space-y-6 w-full">
      <StatsCards />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <BalanceChart />
        </div>
        <div>
          <AiAdvisor />
        </div>
      </div>
    </div>
  );
}