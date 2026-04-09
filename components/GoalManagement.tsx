import React, { useState, useEffect } from 'react';
import { Goal, Client, Holding } from '../types';
import { getGoals, addGoal, updateGoal, deleteGoal, calculateGoalProgress, getClients, calculateHoldings, getTransactions } from '../services/storageService';
import { Plus, Pencil, Trash2, Target, CalendarDays } from 'lucide-react';

interface GoalManagementProps {
  selectedClient?: Client;
  arnFilter?: string;
}

const GoalManagement: React.FC<GoalManagementProps> = ({ selectedClient, arnFilter }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [availableFolios, setAvailableFolios] = useState<Holding[]>([]);
  const [formData, setFormData] = useState({
    clientId: '',
    name: '',
    targetAmount: '',
    targetDate: '',
    category: 'EDUCATION' as Goal['category'],
    priority: 1 as Goal['priority'],
    linkedFolios: [] as string[]
  });

  useEffect(() => {
    loadData();
  }, [selectedClient, arnFilter]);

  useEffect(() => {
    const activeClientId = selectedClient?.id || formData.clientId;
    if (!activeClientId) {
      setAvailableFolios([]);
      return;
    }

    const holdings = calculateHoldings(getTransactions({ clientId: activeClientId }));
    setAvailableFolios(holdings);

    // Keep only valid folios after client changes.
    const folioSet = new Set(holdings.map(h => h.folioNumber));
    setFormData(prev => ({
      ...prev,
      linkedFolios: prev.linkedFolios.filter(folio => folioSet.has(folio))
    }));
  }, [selectedClient?.id, formData.clientId]);

  const loadData = () => {
    const allGoals = getGoals();
    const allClients = getClients(arnFilter);
    setClients(allClients);

    if (selectedClient) {
      setGoals(allGoals.filter(g => g.clientId === selectedClient.id));
      return;
    }

    if (arnFilter) {
      const arnClientIds = allClients.map(c => c.id);
      setGoals(allGoals.filter(g => arnClientIds.includes(g.clientId)));
      return;
    }

    setGoals(allGoals);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const goalData = {
      ...formData,
      targetAmount: parseFloat(formData.targetAmount),
      id: editingGoal ? editingGoal.id : crypto.randomUUID(),
      currentAmount: 0,
      linkedFolios: formData.linkedFolios.length > 0 ? formData.linkedFolios : undefined,
      status: 'ON_TRACK' as const
    };

    if (editingGoal) {
      updateGoal(editingGoal.id, goalData);
    } else {
      addGoal(goalData);
    }

    loadData();
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      clientId: selectedClient?.id || '',
      name: '',
      targetAmount: '',
      targetDate: '',
      category: 'EDUCATION',
      priority: 1,
      linkedFolios: []
    });
    setShowAddForm(false);
    setEditingGoal(null);
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      clientId: goal.clientId,
      name: goal.name,
      targetAmount: goal.targetAmount.toString(),
      targetDate: goal.targetDate,
      category: goal.category,
      priority: goal.priority,
      linkedFolios: goal.linkedFolios || []
    });
    setShowAddForm(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this goal?')) {
      deleteGoal(id);
      loadData();
    }
  };

  const getGoalProgress = (goal: Goal) => {
    const clientTransactions = getTransactions({ clientId: goal.clientId });
    const holdings = calculateHoldings(clientTransactions);
    return calculateGoalProgress(goal, holdings);
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown Client';
  };

  const toggleLinkedFolio = (folioNumber: string) => {
    setFormData(prev => ({
      ...prev,
      linkedFolios: prev.linkedFolios.includes(folioNumber)
        ? prev.linkedFolios.filter(f => f !== folioNumber)
        : [...prev.linkedFolios, folioNumber]
    }));
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Goal Management</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus size={16} />
          <span>Add Goal</span>
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">
            {editingGoal ? 'Edit Goal' : 'Add New Goal'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!selectedClient && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Client</label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value, linkedFolios: [] })}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  required
                >
                  <option value="">Select Client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name} ({client.pan})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Goal Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Amount (INR)</label>
                <input
                  type="number"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  min="0"
                  step="1000"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Date</label>
                <input
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as Goal['category'] })}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                >
                  <option value="EDUCATION">Education</option>
                  <option value="RETIREMENT">Retirement</option>
                  <option value="HOME">Home Purchase</option>
                  <option value="CHILD_MARRIAGE">Child Marriage</option>
                  <option value="VACATION">Vacation</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value, 10) as Goal['priority'] })}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                >
                  <option value={1}>High</option>
                  <option value={2}>Medium</option>
                  <option value={3}>Low</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Linked Funds / Folios (Optional)
                </label>
                {availableFolios.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      linkedFolios: prev.linkedFolios.length === availableFolios.length
                        ? []
                        : availableFolios.map(h => h.folioNumber)
                    }))}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {formData.linkedFolios.length === availableFolios.length ? 'Clear all' : 'Link all'}
                  </button>
                )}
              </div>
              {availableFolios.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md p-3">
                  No folios available for selected client yet. Goal progress will use all holdings.
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700 p-2 space-y-1">
                  {availableFolios.map(h => (
                    <label
                      key={h.folioNumber}
                      className="flex items-start gap-2 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.linkedFolios.includes(h.folioNumber)}
                        onChange={() => toggleLinkedFolio(h.folioNumber)}
                        className="mt-0.5"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-200">
                        <span className="font-medium block">{h.fundName}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Folio: {h.folioNumber}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                {editingGoal ? 'Update Goal' : 'Add Goal'}
              </button>
              <button type="button" onClick={resetForm} className="bg-slate-500 text-white px-4 py-2 rounded-lg hover:bg-slate-600">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {goals.map(goal => {
          const progress = getGoalProgress(goal);
          const progressPercentage = Math.min(progress.progress, 100);

          return (
            <div key={goal.id} className="bg-white dark:bg-slate-900 p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-start gap-3 mb-4">
                <div>
                  <h3 className="text-base md:text-lg font-semibold text-slate-800 dark:text-slate-100">{goal.name}</h3>
                  {!selectedClient && <p className="text-sm text-slate-600 dark:text-slate-400">{getClientName(goal.clientId)}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleEdit(goal)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => handleDelete(goal.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">Target</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">INR {goal.targetAmount.toLocaleString('en-IN')}</span>
                </div>

                <div>
                  <div className="flex justify-between mb-1 text-slate-600 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1"><Target size={13} />Progress</span>
                    <span>{progress.progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progressPercentage}%` }} />
                  </div>
                </div>

                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1"><CalendarDays size={13} />Projected</span>
                  <span>{new Date(progress.projectedCompletion).toLocaleDateString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">Gap</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">INR {progress.gap.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center text-sm pt-1">
                  <span className="text-slate-600 dark:text-slate-400">Priority: {goal.priority === 1 ? 'High' : goal.priority === 2 ? 'Medium' : 'Low'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    goal.status === 'ON_TRACK' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    goal.status === 'AT_RISK' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {goal.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="pt-1 text-xs text-slate-500 dark:text-slate-400">
                  Linked Funds: {goal.linkedFolios && goal.linkedFolios.length > 0 ? goal.linkedFolios.length : 'All funds'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {goals.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-300">No goals found. Add your first goal to get started.</p>
        </div>
      )}
    </div>
  );
};

export default GoalManagement;
