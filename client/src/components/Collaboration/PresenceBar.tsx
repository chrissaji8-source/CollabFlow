import React from 'react';
import { UserPresence } from '../../lib/types.js';
import { UserProfile } from '../../lib/utils/user.js';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface PresenceBarProps {
  currentUser: UserProfile;
  onlineUsers: UserPresence[];
  syncStatus: 'connecting' | 'connected' | 'offline' | 'syncing';
  latencyMs: number;
  onOpenProfile?: () => void;
}

export const PresenceBar: React.FC<PresenceBarProps> = ({
  currentUser,
  onlineUsers,
  syncStatus,
  latencyMs,
  onOpenProfile,
}) => {
  // Deduplicate remote users by ID excluding current user
  const remoteUsers = onlineUsers.filter((u) => u.id !== currentUser.id);

  return (
    <div className="flex items-center gap-3">
      {/* Network / Sync Status Indicator */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
          syncStatus === 'connected'
            ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-400'
            : syncStatus === 'syncing' || syncStatus === 'connecting'
            ? 'bg-amber-950/60 border-amber-800/80 text-amber-400 animate-pulse'
            : 'bg-rose-950/60 border-rose-800/80 text-rose-400'
        }`}
        title={`Status: ${syncStatus} | RTT Latency: ${latencyMs}ms`}
      >
        {syncStatus === 'connected' && <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
        {(syncStatus === 'syncing' || syncStatus === 'connecting') && (
          <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
        )}
        {syncStatus === 'offline' && <WifiOff className="w-3.5 h-3.5 text-rose-400" />}
        
        <span className="capitalize">{syncStatus}</span>
        {syncStatus === 'connected' && latencyMs > 0 && (
          <span className="text-[10px] text-emerald-400/80 font-mono">({latencyMs}ms)</span>
        )}
      </div>

      {/* Online Avatars Stack */}
      <div className="flex items-center -space-x-2">
        {/* Current User Avatar */}
        <div
          onClick={onOpenProfile}
          className="relative group cursor-pointer"
          title={`You: ${currentUser.name}`}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-md border-2 border-slate-900 ring-2 ring-blue-500/50 transition-transform hover:scale-110"
            style={{ backgroundColor: currentUser.color }}
          >
            {currentUser.avatar || currentUser.name.charAt(0).toUpperCase()}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
        </div>

        {/* Remote Users Avatars */}
        {remoteUsers.slice(0, 4).map((user) => (
          <div
            key={user.id}
            className="relative group"
            title={`${user.name} (${user.status})`}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-md border-2 border-slate-900 transition-transform hover:scale-110"
              style={{ backgroundColor: user.color }}
            >
              {user.avatar || user.name.charAt(0).toUpperCase()}
            </div>
            {user.isTyping && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500 text-[8px] text-white items-center justify-center">✎</span>
              </span>
            )}
          </div>
        ))}

        {remoteUsers.length > 4 && (
          <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-semibold border-2 border-slate-900 shadow">
            +{remoteUsers.length - 4}
          </div>
        )}
      </div>
    </div>
  );
};
