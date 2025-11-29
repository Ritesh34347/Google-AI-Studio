import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LogEntry, SystemAlert, ViewState, LogLevel } from './types';
import Dashboard from './components/Dashboard';
import ChatBot from './components/ChatBot';
import AgentMonitor from './components/AgentMonitor';
import { LayoutDashboard, FileText, Bot, Upload, ShieldAlert, Play, RefreshCw, X, Key } from 'lucide-react';
import { parseRawLogs, analyzeForAlerts, agentDiagnoseAndHeal } from './services/geminiService';
import { generateEnterpriseLogs } from './services/mockData';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('dashboard');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(true); // Chat is a persistent sidebar by default on large screens
  const [logFilterIds, setLogFilterIds] = useState<string[] | null>(null);
  const [isApiKeyReady, setIsApiKeyReady] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      if ((window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setIsApiKeyReady(hasKey);
      } else {
        // Fallback for environments where window.aistudio is not present
        setIsApiKeyReady(true);
      }
    };
    checkApiKey();
  }, []);

  const handleApiKeySelect = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      // Assume success after dialog closes (mitigate race condition)
      setIsApiKeyReady(true);
    }
  };

  // Log Ingestion Handler
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const parsed = await parseRawLogs(text);
      setLogs(prev => [...prev, ...parsed]);
      setIsLoading(false);
    };
    reader.readAsText(file);
  };

  const handleEnterpriseScenario = async () => {
    setIsLoading(true);
    // Simulate loading delay for better UX
    setTimeout(async () => {
      const enterpriseLogs = generateEnterpriseLogs();
      setLogs(prev => [...prev, ...enterpriseLogs]);
      setIsLoading(false);
    }, 800);
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    // Simulate network delay for realistic feel
    await new Promise(r => setTimeout(r, 800));
    
    // Add a heartbeat log to simulate live data ingestion
    const newLog: LogEntry = {
      id: `live-${Date.now()}`,
      timestamp: new Date().toISOString(),
      service: 'System Monitor',
      level: LogLevel.INFO,
      message: 'Heartbeat check passed. System metrics validated.'
    };
    
    setLogs(prev => [...prev, newLog]);
    setIsLoading(false);
  };

  const handleViewRelatedLogs = (alert: SystemAlert) => {
    if (alert.relatedLogIds && alert.relatedLogIds.length > 0) {
      setLogFilterIds(alert.relatedLogIds);
    } else {
      // Fallback if no specific IDs returned by AI: Filter by service and non-info levels
      const relevantLogs = logs
        .filter(l => l.service === alert.affectedService && (l.level === LogLevel.ERROR || l.level === LogLevel.CRITICAL || l.level === LogLevel.WARNING))
        .map(l => l.id);
      setLogFilterIds(relevantLogs.length > 0 ? relevantLogs : null);
    }
    setView('logs');
  };

  const clearLogFilter = () => {
    setLogFilterIds(null);
  };

  const displayedLogs = useMemo(() => {
    if (!logFilterIds) return logs;
    return logs.filter(l => logFilterIds.includes(l.id));
  }, [logs, logFilterIds]);

  // Agent Monitoring Effect
  useEffect(() => {
    const monitorLogs = async () => {
      if (logs.length === 0) return;

      // 1. Check for new alerts based on logs
      const hasErrors = logs.some(l => l.level === LogLevel.ERROR || l.level === LogLevel.CRITICAL);
      
      // Allow re-analysis if there are errors and we either have no alerts OR we just refreshed (logs length changed)
      // Note: In a real app we would track "processed" logs. 
      // Here we rely on the list length and existence of errors.
      if (hasErrors && alerts.length === 0) {
        const newAlerts = await analyzeForAlerts(logs);
        setAlerts(newAlerts);
      }
    };

    monitorLogs();
  }, [logs]);

  // Self-Healing Effect
  useEffect(() => {
    const healSystem = async () => {
      const activeAlerts = alerts.filter(a => a.status === 'active');

      for (const alert of activeAlerts) {
        // Mark as healing
        setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: 'healing' } : a));

        // Wait a bit for "Thinking" UI effect
        await new Promise(r => setTimeout(r, 2000));

        // Call Agent
        const diagnosis = await agentDiagnoseAndHeal(alert);

        // Update Alert with agent's plan
        setAlerts(prev => prev.map(a => a.id === alert.id ? { 
          ...a, 
          agentThoughts: [diagnosis.thoughts],
          fixAction: diagnosis.action
        } : a));

        // Simulate Action Delay
        await new Promise(r => setTimeout(r, 4000));

        // Resolve
        if (diagnosis.success) {
           setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: 'resolved' } : a));
           
           // Add a success log
           setLogs(prev => [...prev, {
             id: `sys-${Date.now()}`,
             timestamp: new Date().toISOString(),
             level: LogLevel.SUCCESS,
             service: 'Sentinel-Agent',
             message: `Resolved alert: ${alert.title}. Action Taken: ${diagnosis.action}`
           }]);
        }
      }
    };

    const hasActive = alerts.some(a => a.status === 'active');
    if (hasActive) {
      healSystem();
    }
  }, [alerts]);

  // Render API Key Selection Screen if key is not ready
  if (!isApiKeyReady) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="mx-auto w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center animate-pulse">
            <ShieldAlert className="w-8 h-8 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Sentinel DataOps</h1>
            <p className="text-slate-400 mt-2">AI-Powered Ecosystem Monitoring</p>
          </div>
          <div className="p-4 bg-slate-800/50 rounded-lg text-sm text-slate-300 border border-slate-700">
            To enable the autonomous agent features and ecosystem analysis, please select a valid Google Gemini API Key.
          </div>
          <button
            onClick={handleApiKeySelect}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            <Key className="w-4 h-4" />
            Connect API Key
          </button>
           <p className="text-xs text-slate-500">
            Using a paid key? See <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Billing Docs</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Sidebar Navigation */}
      <aside className="w-16 md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 transition-all duration-300">
        <div>
          <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-slate-800">
             <div className="bg-indigo-600 p-2 rounded-lg">
                <ShieldAlert className="h-5 w-5 text-white" />
             </div>
             <span className="hidden md:block ml-3 font-bold text-lg tracking-tight">Sentinel</span>
          </div>

          <nav className="p-2 space-y-1 mt-4">
            <button 
              onClick={() => setView('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'dashboard' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <LayoutDashboard className="h-5 w-5" />
              <span className="hidden md:block text-sm font-medium">Dashboard</span>
            </button>
            <button 
              onClick={() => setView('agent-monitor')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'agent-monitor' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <Bot className="h-5 w-5" />
              <span className="hidden md:block text-sm font-medium">Agent Monitor</span>
            </button>
            <button 
              onClick={() => { setView('logs'); clearLogFilter(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'logs' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <FileText className="h-5 w-5" />
              <span className="hidden md:block text-sm font-medium">Raw Logs</span>
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <label className="flex items-center justify-center md:justify-start gap-2 w-full p-2 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors border border-slate-700">
            <Upload className="h-4 w-4 text-slate-400" />
            <span className="hidden md:block text-xs font-medium text-slate-300">Upload Logs</span>
            <input type="file" onChange={handleFileUpload} className="hidden" accept=".log,.txt,.json" />
          </label>
          <button 
             onClick={handleEnterpriseScenario}
             disabled={logs.length > 0 && alerts.length > 0}
             className="flex items-center justify-center md:justify-start gap-2 w-full p-2 bg-emerald-900/20 hover:bg-emerald-900/30 text-emerald-400 rounded-lg transition-colors border border-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
             <Play className="h-4 w-4" />
             <span className="hidden md:block text-xs font-medium">Load Enterprise Demo</span>
          </button>
          {logs.length > 0 && (
            <button 
              onClick={() => { setLogs([]); setAlerts([]); }}
              className="flex items-center justify-center md:justify-start gap-2 w-full p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden md:block text-xs font-medium">Reset Data</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {/* Top Mobile/Tablet Header (Simplified) */}
        <div className="md:hidden h-14 border-b border-slate-800 flex items-center px-4 bg-slate-900">
          <span className="font-bold text-lg">Sentinel DataOps</span>
        </div>

        <div className="flex-1 relative overflow-hidden flex">
          {/* Main View */}
          <div className="flex-1 h-full overflow-hidden relative">
            {isLoading && (
              <div className="absolute inset-0 bg-slate-950/80 z-50 flex items-center justify-center backdrop-blur-sm">
                 <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-indigo-400 font-mono text-sm animate-pulse">Processing Data Ecosystem...</span>
                 </div>
              </div>
            )}

            {view === 'dashboard' && <Dashboard logs={logs} alerts={alerts} onRefresh={handleRefresh} />}
            {view === 'agent-monitor' && <AgentMonitor alerts={alerts} onViewLogs={handleViewRelatedLogs} />}
            {view === 'logs' && (
              <div className="p-6 h-full overflow-hidden flex flex-col">
                <header className="mb-4 flex justify-between items-center">
                   <div>
                     <h1 className="text-2xl font-bold text-slate-200">System Logs</h1>
                     <p className="text-slate-500 text-sm">Showing {displayedLogs.length} events {logFilterIds ? '(Filtered by Alert)' : 'from the last 24 hours'}.</p>
                   </div>
                   {logFilterIds && (
                     <button 
                       onClick={clearLogFilter}
                       className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                     >
                       <X className="h-4 w-4" />
                       Clear Filter
                     </button>
                   )}
                </header>
                <div className="flex-1 overflow-auto bg-slate-900 rounded-xl border border-slate-800 p-4 font-mono text-xs">
                   {logs.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-500">
                        <FileText className="h-10 w-10 mb-2 opacity-50" />
                        <p>No logs ingested.</p>
                        <p className="text-xs mt-1">Click "Load Enterprise Demo" to start.</p>
                     </div>
                   ) : displayedLogs.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-500">
                        <p>No matching logs found for this filter.</p>
                        <button onClick={clearLogFilter} className="text-indigo-400 hover:underline mt-2">Clear Filter</button>
                     </div>
                   ) : (
                     displayedLogs.map(log => (
                       <div key={log.id} className="mb-1 hover:bg-slate-800 p-1 rounded grid grid-cols-[140px_80px_140px_1fr] gap-2 items-start border-b border-slate-800/50 last:border-0">
                         <span className="text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                         <span className={`font-bold ${
                           log.level === 'ERROR' || log.level === 'CRITICAL' ? 'text-red-500' : 
                           log.level === 'WARNING' ? 'text-amber-500' : 
                           log.level === 'SUCCESS' ? 'text-emerald-500' : 'text-blue-400'
                         }`}>{log.level}</span>
                         <span className="text-slate-400 truncate" title={log.service}>{log.service}</span>
                         <span className="text-slate-300 break-words">{log.message}</span>
                       </div>
                     ))
                   )}
                </div>
              </div>
            )}
          </div>
          
          {/* Right Sidebar - ChatBot */}
          <div className={`w-96 border-l border-slate-800 bg-slate-900/50 hidden xl:block h-full transition-transform`}>
             <ChatBot logs={logs} alerts={alerts} />
          </div>

          {/* Mobile/Tablet Chat Toggle Overlay */}
          <div className="xl:hidden absolute bottom-4 right-4 z-40">
            <button 
              onClick={() => setShowChat(!showChat)}
              className="p-3 bg-indigo-600 rounded-full shadow-lg text-white hover:bg-indigo-500 transition-transform hover:scale-105"
            >
              <Bot className="h-6 w-6" />
            </button>
          </div>

          {showChat && (
             <div className="xl:hidden absolute inset-0 z-30 bg-slate-900/95 backdrop-blur-sm p-4 pt-16">
                <button 
                  onClick={() => setShowChat(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                  Close
                </button>
                <div className="h-full border border-slate-700 rounded-xl overflow-hidden">
                   <ChatBot logs={logs} alerts={alerts} />
                </div>
             </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default App;