import React, { useState } from 'react';
import { DocumentMetadata, UserPresence } from '../../lib/types.js';
import { UserProfile } from '../../lib/utils/user.js';
import { PresenceBar } from '../Collaboration/PresenceBar.js';
import { getExportUrl } from '../../lib/utils/api.js';
import {
  Users, Activity, History, MessageSquare, Download,
  Share2, Sparkles, Check, ChevronDown, FileText, Layout
} from 'lucide-react';

interface NavbarProps {
  currentDoc: DocumentMetadata;
  currentUser: UserProfile;
  onlineUsers: UserPresence[];
  syncStatus: 'connecting' | 'connected' | 'offline' | 'syncing';
  latencyMs: number;
  unreadChatCount: number;
  onOpenSandbox: () => void;
  onOpenCRDTInspector: () => void;
  onOpenVersionHistory: () => void;
  onToggleChat: () => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentDoc,
  currentUser,
  onlineUsers,
  syncStatus,
  latencyMs,
  unreadChatCount,
  onOpenSandbox,
  onOpenCRDTInspector,
  onOpenVersionHistory,
  onToggleChat,
  onOpenProfile,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <header className="h-14 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 px-4 flex items-center justify-between z-20 select-none">
      {/* Document Info */}
      <div className="flex items-center gap-3 overflow-hidden">
        <span className="text-xl select-none">{currentDoc.icon || (currentDoc.type === 'document' ? '📝' : '🎨')}</span>
        <div className="flex items-center gap-2 overflow-hidden">
          <h2 className="font-bold text-sm text-slate-100 truncate max-w-[180px] sm:max-w-xs md:max-w-md">
            {currentDoc.title}
          </h2>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
              currentDoc.type === 'document'
                ? 'bg-blue-950/80 text-blue-400 border border-blue-800/80'
                : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
            }`}
          >
            {currentDoc.type}
          </span>
        </div>
      </div>

      {/* Right Actions & Multiplayer Presence */}
      <div className="flex items-center gap-2.5">
        {/* Presence Bar */}
        <PresenceBar
          currentUser={currentUser}
          onlineUsers={onlineUsers}
          syncStatus={syncStatus}
          latencyMs={latencyMs}
          onOpenProfile={onOpenProfile}
        />

        <div className="w-px h-5 bg-slate-800 mx-1 hidden sm:block" />

        {/* Multi-User Split Sandbox Button */}
        <button
          onClick={onOpenSandbox}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
          title="Open Side-by-Side Multi-User Simulation"
        >
          <Users className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Split Sandbox</span>
        </button>

        {/* CRDT Inspector Button */}
        <button
          onClick={onOpenCRDTInspector}
          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-xl text-xs transition-colors"
          title="Inspect CRDT State & Latency Chaos Simulator"
        >
          <Activity className="w-4 h-4" />
        </button>

        {/* Version History Button */}
        <button
          onClick={onOpenVersionHistory}
          className="p-2 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded-xl text-xs transition-colors"
          title="Document Version Snapshots"
        >
          <History className="w-4 h-4" />
        </button>

        {/* Live Chat Toggle Button */}
        <button
          onClick={onToggleChat}
          className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl text-xs transition-colors"
          title="In-Room Team Chat"
        >
          <MessageSquare className="w-4 h-4" />
          {unreadChatCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          )}
        </button>

        {/* Share Link Button */}
        <button
          onClick={handleShareLink}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl text-xs transition-colors hidden sm:block"
          title="Copy Room Link to Clipboard"
        >
          {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
        </button>

        {/* Export Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl text-xs transition-colors"
            title="Export Document"
          >
            <Download className="w-4 h-4" />
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-1 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
              {currentDoc.type === 'document' && (
                <a
                  href={getExportUrl(currentDoc.id, 'markdown')}
                  download
                  onClick={() => setShowExportMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>Export Markdown</span>
                </a>
              )}
              <a
                href={getExportUrl(currentDoc.id, 'json')}
                download
                onClick={() => setShowExportMenu(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Layout className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CRDT State</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
