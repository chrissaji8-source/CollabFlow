import React, { useState } from 'react';
import { useYjsRoom } from '../../lib/crdt/useYjsRoom.js';
import { CollabEditor } from '../Editor/CollabEditor.js';
import { CollabWhiteboard } from '../Whiteboard/CollabWhiteboard.js';
import { PresenceBar } from '../Collaboration/PresenceBar.js';
import { ReactionOverlay } from '../Collaboration/ReactionOverlay.js';
import { UserProfile, getSimulatedUsers } from '../../lib/utils/user.js';
import { DocType } from '../../lib/types.js';
import { X, Columns2, Columns3, Users } from 'lucide-react';

interface SplitSandboxViewProps {
  roomId: string;
  docType: DocType;
  documentTitle: string;
  onClose: () => void;
}

const SingleUserPane: React.FC<{
  roomId: string;
  docType: DocType;
  documentTitle: string;
  user: UserProfile;
}> = ({ roomId, docType, documentTitle, user }) => {
  const {
    ydoc,
    provider,
    syncStatus,
    onlineUsers,
    activeReactions,
    latencyMs,
    updateCursor,
    setTyping,
    sendReaction,
  } = useYjsRoom({ roomId, user });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl relative">
      {/* Pane User Header */}
      <div className="bg-slate-900/90 backdrop-blur px-3 py-2 border-b border-slate-800 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow"
            style={{ backgroundColor: user.color }}
          >
            {user.avatar}
          </div>
          <div>
            <span className="text-xs font-bold text-slate-100">{user.name}</span>
            <span className="ml-2 text-[10px] text-slate-500 font-mono">Actor ID: {user.id}</span>
          </div>
        </div>

        <PresenceBar
          currentUser={user}
          onlineUsers={onlineUsers}
          syncStatus={syncStatus}
          latencyMs={latencyMs}
        />
      </div>

      {/* Pane Content */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {docType === 'document' ? (
          <CollabEditor
            ydoc={ydoc}
            provider={provider}
            currentUser={user}
            documentTitle={documentTitle}
            onTyping={setTyping}
          />
        ) : (
          <CollabWhiteboard
            ydoc={ydoc}
            provider={provider}
            currentUser={user}
            onlineUsers={onlineUsers}
            onCursorMove={updateCursor}
          />
        )}

        <ReactionOverlay reactions={activeReactions} onSendReaction={sendReaction} />
      </div>
    </div>
  );
};

export const SplitSandboxView: React.FC<SplitSandboxViewProps> = ({
  roomId,
  docType,
  documentTitle,
  onClose,
}) => {
  const simulatedUsers = getSimulatedUsers();
  const [paneCount, setPaneCount] = useState<2 | 3>(2);

  const activeUsers = simulatedUsers.slice(0, paneCount);

  return (
    <div className="fixed inset-0 bg-slate-950/95 z-50 flex flex-col overflow-hidden">
      {/* Top Banner */}
      <div className="bg-slate-900 px-6 py-2.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Multi-User Collaborative Simulation Sandbox
              <span className="text-xs px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/80 rounded-full">
                Side-by-Side Real-Time
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Type or draw in any pane below to experience zero-latency peer replication and multiplayer carets in real-time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Pane Switcher (2 or 3 users) */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setPaneCount(2)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                paneCount === 2 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>2 Users</span>
            </button>
            <button
              onClick={() => setPaneCount(3)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                paneCount === 3 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>3 Users</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
            title="Exit Simulation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Split Panes Area */}
      <div className="flex-1 p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-hidden">
        {activeUsers.map((user) => (
          <SingleUserPane
            key={user.id}
            roomId={roomId}
            docType={docType}
            documentTitle={documentTitle}
            user={user}
          />
        ))}
      </div>
    </div>
  );
};
