import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ChevronDown, RefreshCw, Download } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: Record<string, any>;
  ip_address: string;
  user_agent: string;
  status: string;
  error_message: string;
  created_at: string;
  users?: { full_name: string; email: string };
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [dateRange, setDateRange] = useState('7');

  useEffect(() => {
    loadLogs();
  }, [filterAction, filterEntity, dateRange]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));

      let query = supabase
        .from('audit_logs')
        .select('*, users(full_name, email)')
        .gte('created_at', daysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (filterAction !== 'all') {
        query = query.eq('action', filterAction);
      }
      if (filterEntity !== 'all') {
        query = query.eq('entity_type', filterEntity);
      }

      const { data, error } = await query;
      if (!error && data) {
        setLogs(data as AuditLogEntry[]);
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = () => {
    const csv = [
      ['Date', 'Utilisateur', 'Action', 'Entité', 'Statut', 'Adresse IP'],
      ...logs.map(log => [
        new Date(log.created_at).toLocaleString('fr-FR'),
        log.users?.full_name || 'Inconnu',
        log.action,
        log.entity_type,
        log.status,
        log.ip_address,
      ]),
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-green-100 text-green-800';
      case 'update':
        return 'bg-blue-100 text-blue-800';
      case 'delete':
        return 'bg-red-100 text-red-800';
      case 'payment':
        return 'bg-purple-100 text-purple-800';
      case 'export':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <RefreshCw className="w-6 h-6 text-blue-600 mx-auto animate-spin" />
          <p className="text-gray-600 mt-2">Chargement des journaux...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Journaux d'Audit</h2>
          <p className="text-gray-600 text-sm mt-1">Suivi complet des actions système</p>
        </div>
        <button
          onClick={exportLogs}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Download className="w-5 h-5" />
          Exporter CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Plage de Dates</label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="1">Dernier jour</option>
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">Toutes les actions</option>
            <option value="create">Créer</option>
            <option value="update">Mettre à jour</option>
            <option value="delete">Supprimer</option>
            <option value="payment">Paiement</option>
            <option value="export">Exporter</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Entité</label>
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">Toutes les entités</option>
            <option value="product">Produit</option>
            <option value="sale">Vente</option>
            <option value="user">Utilisateur</option>
            <option value="category">Catégorie</option>
            <option value="supplier">Fournisseur</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={loadLogs}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entité</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Aucun journal d'audit trouvé
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(log.created_at).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div>
                        <p className="font-medium">{log.users?.full_name || 'Inconnu'}</p>
                        <p className="text-xs text-gray-500">{log.users?.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{log.entity_type}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-mono text-xs">{log.ip_address}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ChevronDown className={`w-5 h-5 transition ${expandedId === log.id ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {logs.map((log) => (
          expandedId === log.id && (
            <div key={`${log.id}-details`} className="bg-gray-50 border-t p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">ID Entité</p>
                  <p className="text-sm font-mono text-gray-600">{log.entity_id || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">User Agent</p>
                  <p className="text-xs text-gray-600 break-words">{log.user_agent}</p>
                </div>
                {log.error_message && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-red-700">Message d'Erreur</p>
                    <p className="text-sm text-red-600">{log.error_message}</p>
                  </div>
                )}
                {log.changes && Object.keys(log.changes).length > 0 && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-gray-700">Modifications</p>
                    <pre className="text-xs bg-white p-2 rounded border border-gray-300 mt-1 overflow-x-auto">
                      {JSON.stringify(log.changes, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
