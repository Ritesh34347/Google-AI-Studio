import React from 'react';
import { SystemAlert } from '../types';
import { Terminal, Cpu, Check, ArrowRight, Activity, FileSearch } from 'lucide-react';

interface AgentMonitorProps {
  alerts: SystemAlert[];
  onViewLogs: (alert: SystemAlert) => void;
}

const AgentMonitor: React.FC<AgentMonitorProps> = ({ alerts, onViewLogs }) => {
  // Sort alerts by recency
  const sortedAlerts = [...alerts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="p-6 h-full overflow-y-auto">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Cpu className="text-purple-500" /> Agent Neural Activity
          </h1>
          <p className="text-slate-400 mt-1">Real-time log of autonomous remediation actions.</p>
        </div>
      </header>

      <div className="space-y-6">
        {sortedAlerts.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-800 rounded-xl">
             <Cpu className="h-12 w-12 text-slate-700 mb-4" />
             <p className="text-slate-500">Agent is standing by. No anomalies detected.</p>
           </div>
        ) : (
          sortedAlerts.map(alert => (
            <div key={alert.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden relative group">
              {/* Status Indicator Stripe */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                alert.status === 'resolved' ? 'bg-emerald-500' :
                alert.status === 'healing' ? 'bg-purple-500 animate-pulse' :
                'bg-red-500'
              }`} />
              
              <div className="p-5 pl-7">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg text-slate-200">{alert.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-slate-400 font-mono">Target: {alert.affectedService}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => onViewLogs(alert)}
                      className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded transition-colors"
                    >
                      <FileSearch className="h-3 w-3" />
                      View Related Logs
                    </button>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      alert.status === 'resolved' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800' :
                      alert.status === 'healing' ? 'bg-purple-900/50 text-purple-400 border border-purple-800' :
                      'bg-red-900/50 text-red-400 border border-red-800'
                    }`}>
                      {alert.status}
                    </div>
                  </div>
                </div>

                {/* Agent Thought Process Chain */}
                <div className="space-y-4">
                  {/* Step 1: Detection */}
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                       <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                         <Activity className="h-4 w-4 text-slate-400" />
                       </div>
                       <div className="w-0.5 h-full bg-slate-800 my-1"></div>
                    </div>
                    <div className="pb-4">
                       <h4 className="text-sm font-medium text-slate-300">Anomaly Detected</h4>
                       <p className="text-xs text-slate-500 mt-1">{alert.description}</p>
                    </div>
                  </div>

                  {/* Step 2: Diagnosis (if available) */}
                  {alert.agentThoughts && alert.agentThoughts.length > 0 && (
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                          <Terminal className="h-4 w-4 text-blue-400" />
                        </div>
                        <div className="w-0.5 h-full bg-slate-800 my-1"></div>
                      </div>
                      <div className="pb-4">
                        <h4 className="text-sm font-medium text-slate-300">Analysis & Strategy</h4>
                        <div className="mt-2 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-blue-300">
                           {'>'} {alert.agentThoughts}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Action */}
                  {alert.fixAction && (
                    <div className="flex gap-3">
                       <div className="flex flex-col items-center">
                         <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                           <ArrowRight className="h-4 w-4 text-purple-400" />
                         </div>
                         {alert.status === 'resolved' && <div className="w-0.5 h-full bg-slate-800 my-1"></div>}
                       </div>
                       <div className="pb-4">
                         <h4 className="text-sm font-medium text-slate-300">Executing Remediation</h4>
                         <div className="mt-2 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-purple-300">
                            $ {alert.fixAction}
                         </div>
                       </div>
                    </div>
                  )}

                   {/* Step 4: Resolution */}
                   {alert.status === 'resolved' && (
                    <div className="flex gap-3">
                       <div className="flex flex-col items-center">
                         <div className="w-8 h-8 rounded-full bg-emerald-900/30 flex items-center justify-center border border-emerald-800">
                           <Check className="h-4 w-4 text-emerald-500" />
                         </div>
                       </div>
                       <div>
                         <h4 className="text-sm font-medium text-emerald-400 mt-1.5">System Stabilized</h4>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AgentMonitor;