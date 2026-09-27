import React, { useState, useEffect } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { fetchCRDTStats, fetchServerStats } from '../../lib/utils/api.js';
import {
  Activity, Zap, ShieldCheck, Database, Server,
  Sliders, WifiOff, RefreshCw, Layers, CheckCircle2,
  Cpu, HardDrive, Info
} from 'lucide-react';

interface CRDTInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  ydoc: Y.Doc;
  provider: WebsocketProvider | null;
  latencyMs: number;
}

export const CRDTInspector: React.FC<CRDTInspectorProps> = ({
  isOpen,
  onClose,
  roomId,
  ydoc,
  provider,
  latencyMs,
}) => {
  const [stats, setStats] = useState<any>(null);
  const [serverStats, setServerStats] = useState<any>(null);
  const [isOfflineSimulated, setIsOfflineSimulated] = useState(false);
  const [simulatedLag, setSimulatedLag] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    const loadStats = async () => {
      try {
        const [crdtData, sStats] = await Promise.all([
          fetchCRDTStats(roomId).catch(() => null),
          fetchServerStats().catch(() => null),
        ]);
        setStats(crdtData);
        setServerStats(sStats);
      } catch (e) {
        // ignore
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 2500);
    return () => clearInterval(interval);
  }, [isOpen, roomId]);

  const toggleSimulatedOffline = () => {
    if (!provider) return;
    if (isOfflineSimulated) {
      provider.connect();
      setIsOfflineSimulated(false);
    } else {
      provider.disconnect();
      setIsOfflineSimulated(true);
    }
  };

  if (!isOpen) return null;

  const stateVector = Y.encodeStateVector(ydoc);
  const clientStoreCount = ydoc.store.clients.size;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                CRDT & State Vector Inspector
                <span className="px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-800/80 text-[10px] font-mono rounded-md">
                  Yjs v13
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Live mathematical convergence, conflict-free state store, & Redis Pub/Sub telemetry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Top Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                <span>CRDT Clients</span>
              </div>
              <div className="text-lg font-bold text-slate-100 font-mono">{clientStoreCount}</div>
              <div className="text-[10px] text-slate-500">Unique actor IDs in store</div>
            </div>

            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>State Vector</span>
              </div>
              <div className="text-lg font-bold text-slate-100 font-mono">{stateVector.byteLength} B</div>
              <div className="text-[10px] text-slate-500">Binary vector clock size</div>
            </div>

            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Network RTT</span>
              </div>
              <div className="text-lg font-bold text-slate-100 font-mono">
                {isOfflineSimulated ? 'OFFLINE' : `${latencyMs} ms`}
              </div>
              <div className="text-[10px] text-slate-500">Real-time roundtrip ping</div>
            </div>

            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Server className="w-3.5 h-3.5 text-purple-400" />
                <span>Pub/Sub Engine</span>
              </div>
              <div className="text-lg font-bold text-slate-100 capitalize font-mono">
                {serverStats?.pubsub?.mode || 'In-Memory'}
              </div>
              <div className="text-[10px] text-slate-500">
                {serverStats?.pubsub?.messagesPublished || 0} msgs routed
              </div>
            </div>
          </div>

          {/* Interactive Chaos / Latency / Offline Simulator */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-sm text-slate-200">
                  Optimistic UI & Latency Simulator
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">Demonstrate instant local UI vs catch-up</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Airplane / Offline Mode */}
              <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-800">
                <div>
                  <div className="font-medium text-slate-200">Simulate Offline Mode</div>
                  <div className="text-[10px] text-slate-500">
                    Disconnect socket, type edits, then reconnect to see CRDT merge.
                  </div>
                </div>
                <button
                  onClick={toggleSimulatedOffline}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    isOfflineSimulated
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {isOfflineSimulated ? (
                    <>
                      <WifiOff className="w-3.5 h-3.5" /> Reconnect
                    </>
                  ) : (
                    'Go Offline'
                  )}
                </button>
              </div>

              {/* Synthetic Delay Selector */}
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-slate-200">Synthetic Network Delay</span>
                  <span className="font-mono text-blue-400">{simulatedLag} ms</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[0, 100, 300, 800, 1500].map((ms) => (
                    <button
                      key={ms}
                      onClick={() => setSimulatedLag(ms)}
                      className={`flex-1 py-1 rounded text-[10px] font-mono transition-colors ${
                        simulatedLag === ms
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {ms === 0 ? '0ms' : `${ms}ms`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CRDT Structural Insights */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              Yjs CRDT Mathematical Guarantees
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-400">
              <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800/80">
                <div className="text-emerald-400 font-bold mb-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Commutativity
                </div>
                <div>
                  Operations arrive and apply in any order across peers while producing the exact same state tree.
                </div>
              </div>
              <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800/80">
                <div className="text-emerald-400 font-bold mb-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Associativity
                </div>
                <div>
                  Groupings and batchings of delta updates merge consistently whether in 1 bulk message or 100 packets.
                </div>
              </div>
              <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800/80">
                <div className="text-emerald-400 font-bold mb-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Idempotence
                </div>
                <div>
                  Re-applying identical CRDT updates or retransmissions will never create duplicates or side effects.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
