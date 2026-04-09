import React, { useState, useEffect } from 'react';
import { Family, Client } from '../types';
import { getFamilies, addFamily, updateFamily, deleteFamily, calculateFamilyPortfolio, getClients } from '../services/storageService';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Users } from 'lucide-react';

interface FamilyGroupingProps {
  arnFilter?: string;
}

const FamilyGrouping: React.FC<FamilyGroupingProps> = ({ arnFilter }) => {
  const [families, setFamilies] = useState<Family[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [arnFilter]);

  const loadData = () => {
    setFamilies(getFamilies(arnFilter));
    setClients(getClients(arnFilter));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedClients.length === 0) {
      alert('Please select at least one client for the family');
      return;
    }

    const familyData = {
      ...formData,
      clientIds: selectedClients,
      id: editingFamily ? editingFamily.id : crypto.randomUUID(),
      createdDate: editingFamily ? editingFamily.createdDate : new Date().toISOString().split('T')[0],
      arnFilter: arnFilter || ''
    };

    if (editingFamily) {
      updateFamily(editingFamily.id, familyData);
    } else {
      addFamily(familyData);
    }

    loadData();
    resetForm();
  };

  const resetForm = () => {
    setFormData({ name: '', description: '' });
    setSelectedClients([]);
    setShowAddForm(false);
    setEditingFamily(null);
  };

  const handleEdit = (family: Family) => {
    setEditingFamily(family);
    setFormData({ name: family.name, description: family.description || '' });
    setSelectedClients(family.clientIds);
    setShowAddForm(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this family group? This will not delete the clients.')) {
      deleteFamily(id);
      loadData();
    }
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => (prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]));
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown Client';
  };

  const availableClients = clients.filter(client => !families.some(family => family.id !== editingFamily?.id && family.clientIds.includes(client.id)));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Family Groups</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus size={16} />
          <span>Create Family Group</span>
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">
            {editingFamily ? 'Edit Family Group' : 'Create New Family Group'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Family Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  placeholder="e.g., Sharma Family"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  placeholder="Optional description"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Members ({selectedClients.length} selected)</label>
              <div className="max-h-60 overflow-y-auto border border-slate-300 dark:border-slate-600 rounded-md p-3 bg-slate-50 dark:bg-slate-800">
                {availableClients.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400 text-center py-4">
                    {editingFamily ? 'All clients are already in other families' : 'No available clients to add'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {availableClients.map(client => (
                      <label key={client.id} className="flex items-center space-x-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={selectedClients.includes(client.id)}
                          onChange={() => toggleClientSelection(client.id)}
                          className="rounded border-slate-300 dark:border-slate-600"
                        />
                        <span>{client.name} ({client.pan})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                {editingFamily ? 'Update Family' : 'Create Family'}
              </button>
              <button type="button" onClick={resetForm} className="bg-slate-500 text-white px-4 py-2 rounded-lg hover:bg-slate-600">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {families.map(family => {
          const portfolio = calculateFamilyPortfolio(family.id);
          const isExpanded = expandedFamily === family.id;

          return (
            <div key={family.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 md:p-5">
                <div className="flex justify-between items-start gap-3 mb-4">
                  <div>
                    <h3 className="text-base md:text-lg font-semibold text-slate-800 dark:text-slate-100">{family.name}</h3>
                    {family.description && <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{family.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setExpandedFamily(isExpanded ? null : family.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <button onClick={() => handleEdit(family)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(family.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Members: {family.clientIds.length}</span>
                    <span>{new Date(family.createdDate).toLocaleDateString('en-IN')}</span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Family Portfolio</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Total Value</span>
                        <div className="font-semibold text-green-600 dark:text-green-400">INR {portfolio.summary.currentValue.toLocaleString('en-IN')}</div>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Total Return</span>
                        <div className={`font-semibold ${portfolio.summary.totalGain >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {portfolio.summary.totalGain >= 0 ? '+' : ''}INR {portfolio.summary.totalGain.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500 dark:text-slate-400">Weighted XIRR</span>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{portfolio.summary.xirr.toFixed(2)}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 inline-flex items-center gap-1"><Users size={14} />Family Members</h4>
                    <div className="space-y-1.5">
                      {family.clientIds.map(clientId => {
                        const contribution = portfolio.clientBreakdown.find(c => c.clientId === clientId);
                        return (
                          <div key={clientId} className="flex justify-between text-sm text-slate-700 dark:text-slate-300">
                            <span>{getClientName(clientId)}</span>
                            <span>INR {contribution ? contribution.contribution.toLocaleString('en-IN') : '0'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {portfolio.holdings.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Top Holdings</h4>
                      <div className="space-y-1.5">
                        {portfolio.holdings.slice(0, 3).map(holding => (
                          <div key={holding.folioNumber} className="flex justify-between text-sm text-slate-700 dark:text-slate-300">
                            <span className="truncate pr-2">{holding.fundName}</span>
                            <span>INR {holding.currentValue.toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {families.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-300">No family groups found. Create your first family group to get started.</p>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-slate-900 border border-blue-100 dark:border-slate-700 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2">Family Grouping Benefits</h3>
        <ul className="text-sm text-blue-700 dark:text-slate-300 space-y-1">
          <li><strong>Consolidated View:</strong> Combined portfolio performance across members.</li>
          <li><strong>Tax Planning:</strong> Better visibility for family-level optimization.</li>
          <li><strong>Risk Management:</strong> Assess total risk exposure in one place.</li>
          <li><strong>Goal Alignment:</strong> Coordinate financial goals as a group.</li>
        </ul>
      </div>
    </div>
  );
};

export default FamilyGrouping;
