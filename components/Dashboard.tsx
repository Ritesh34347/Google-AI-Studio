import React, { useMemo } from 'react';
import { LogEntry, SystemAlert, LogLevel } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Activity, AlertTriangle, CheckCircle, Server, ShieldCheck, RefreshCw } from 'lucide-react';

interface DashboardProps {
  logs: LogEntry[];
  alerts: SystemAlert[];
  onRefresh: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ logs, alerts, onRefresh }) => {
  
  const stats = useMemo(() => {
    const errorCount = logs.filter(l => l.level === LogLevel.ERROR || l.level === LogLevel.CRITICAL).length;
    const warnCount = logs.filter(l => l.level === LogLevel.WARNING).length;
    const successCount = logs.filter(l => l.level === LogLevel.SUCCESS || l.level === LogLevel.INFO).length;
    const activeAlerts = alerts.filter(a => a.status !== 'resolved').length;
    const resolvedAlerts = alerts.filter(a => a.status === 'resolved').length;
    return { errorCount, warnCount, successCount, activeAlerts, resolvedAlerts };
  }, [logs, alerts]);

  const logsByService = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(l => {
      counts[l.service] = (counts[l.service] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [logs]);

  const errorsOverTime = useMemo(() => {
    // Group by hour if dataset is large, or minute if small. 
    // Given the 24h mock dataset, grouping by Hour is better for visual trend.
    const counts: Record<string, number> = {};
    logs.filter(l => l.level === LogLevel.ERROR || l.level === LogLevel.CRITICAL).forEach(l => {
      const date = new Date(l.timestamp);
      const time = `${date.getHours()}:00`; 
      counts[time] = (counts[time] || 0) + 1;
    });
    // Sort keys
    return Object.entries(counts)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([time, count]) => ({ time, count })); 
  }, [logs]);

  // Extended palette for 8+ services
  const COLORS = [
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#6366f1', // Indigo
    '#84cc16', // Lime
  ];

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full pb-20">
      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-2">
            <Activity className="text-blue-500" /> Data Ecosystem Overview
          </h1>
          <p className="text-slate-400 mt-1">Real-time monitoring of Snowflake, Glue, SAP, Kafka, and more.</p>
        </div>
        <button 
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-all active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh Data</span>
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-red-500/10 rounded-lg">
            <AlertTriangle className="text-red-500 h-6 w-6" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Active Alerts</p>
            <p className="text-2xl font-bold text-slate-100">{stats.activeAlerts}</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-lg">
            <ShieldCheck className="text-emerald-500 h-6 w-6" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Auto-Healed</p>
            <p className="text-2xl font-bold text-slate-100">{stats.resolvedAlerts}</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <Server className="text-blue-500 h-6 w-6" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Total Log Events</p>
            <p className="text-2xl font-bold text-slate-100">{logs.length}</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-lg">
            <Activity className="text-amber-500 h-6 w-6" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Warnings</p>
            <p className="text-2xl font-bold text-slate-100">{stats.warnCount}</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-80">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">Event Volume by Service</h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={logsByService}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickFormatter={(val) => val.substring(0, 10)} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#f1f5f9' }}
                  cursor={{fill: '#1e293b', opacity: 0.4}}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {logsByService.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">Failures Over Time (24h)</h3>
          <div className="flex-1 w-full min-h-0">
             {errorsOverTime.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                <BarChart data={errorsOverTime}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                   <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                   <YAxis stroke="#64748b" fontSize={12} />
                   <Tooltip 
                     contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#f1f5f9' }}
                   />
                   <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                 </BarChart>
               </ResponsiveContainer>
             ) : (
               <div className="h-full flex items-center justify-center text-slate-500">
                 No errors detected in the current window.
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Active Alerts List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-200">Active Incidents</h3>
          <span className="text-xs font-mono text-slate-500">LIVE FEED</span>
        </div>
        <div className="divide-y divide-slate-800">
          {alerts.filter(a => a.status !== 'resolved').length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-emerald-500/50" />
              <p>No active incidents. The ecosystem is stable.</p>
            </div>
          ) : (
            alerts.filter(a => a.status !== 'resolved').map(alert => (
              <div key={alert.id} className="p-4 hover:bg-slate-800/50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="mt-1">
                      {alert.severity === 'critical' || alert.severity === 'high' ? (
                        <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-amber-500" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">{alert.title}</h4>
                      <p className="text-xs text-slate-400 mt-1">{alert.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                         <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                           {alert.affectedService}
                         </span>
                         {alert.status === 'healing' && (
                           <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 animate-pulse">
                             Agent Healing...
                           </span>
                         )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 font-mono">
                      {new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;