import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { storageService } from '../services/storage';
import { TransactionType } from '../types';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const Dashboard: React.FC = () => {
  const transactions = storageService.getTransactions();
  const categories = storageService.getCategories();
  const projects = storageService.getProjects();

  const stats = useMemo(() => {
    // 1. Income vs Expense
    const income = transactions.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);
    
    // 2. Expense by Category
    const expenseByCat = categories
      .filter(c => c.type === TransactionType.EXPENSE)
      .map(c => ({
        name: c.name,
        value: transactions
          .filter(t => t.categoryId === c.id && t.type === TransactionType.EXPENSE)
          .reduce((acc, t) => acc + t.amount, 0)
      }))
      .filter(i => i.value > 0);

    // 3. Expense by Project
    const expenseByProj = projects.map(p => ({
      name: p.name,
      value: transactions
        .filter(t => t.projectDeptId === p.id && t.type === TransactionType.EXPENSE)
        .reduce((acc, t) => acc + t.amount, 0)
    })).filter(i => i.value > 0);

    return { income, expense, expenseByCat, expenseByProj };
  }, [transactions, categories, projects]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">報表中心</h2>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
          <p className="text-sm text-gray-500">總收入 (Total Income)</p>
          <p className="text-2xl font-bold text-gray-900">${stats.income.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-red-500">
          <p className="text-sm text-gray-500">總支出 (Total Expense)</p>
          <p className="text-2xl font-bold text-gray-900">${stats.expense.toLocaleString()}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">支出分佈 (依科目)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.expenseByCat}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.expenseByCat.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">支出分佈 (依專案/部門)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.expenseByProj} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                <Bar dataKey="value" fill="#8884d8">
                  {stats.expenseByProj.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};