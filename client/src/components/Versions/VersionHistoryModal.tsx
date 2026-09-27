import React, { useState, useEffect } from 'react';
import { VersionSnapshot } from '../../lib/types.js';
import { fetchVersionHistory, createVersionSnapshot, restoreVersionSnapshot } from '../../lib/utils/api.js';
import { History, Plus, RotateCcw, Clock, User, HardDrive, Check, AlertTriangle } from 'lucide-react';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentUserName: string;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  roomId,
  currentUserName,
}) => {
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const data = await fetchVersionHistory(roomId);
      setVersions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, roomId]);

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionName.trim()) return;
    try {
      await createVersionSnapshot(roomId, newVersionName.trim(), currentUserName);
      setNewVersionName('');
      setIsCreating(false);
      loadVersions();
      setSuccessMsg('Version snapshot created successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Error creating version: ${err.message}`);
    }
  };

  const handleRestore = async (versionId: string, versionName: string) => {
    if (!window.confirm(`Are you sure you want to restore the document state to "${versionName}"?`)) {
      return;
    }
    setRestoringId(versionId);
    try {
      await restoreVersionSnapshot(roomId, versionId);
      setSuccessMsg(`Document restored to "${versionName}"!`);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      alert(`Failed to restore: ${err.message}`);
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Document Version History</h2>
              <p className="text-xs text-slate-400">Time-travel through immutable CRDT state snapshots</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>

        {/* Create Snapshot Form */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-3">
          {isCreating ? (
            <form onSubmit={handleCreateSnapshot} className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                placeholder="e.g. Release 1.0 Milestone / Architecture Review"
                autoFocus
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded-xl"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Named Checkpoint</span>
            </button>
          )}

          {successMsg && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <Check className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Version List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500 mx-auto mb-2" />
              Loading snapshot timeline...
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <History className="w-8 h-8 mx-auto mb-2 opacity-30 text-purple-400" />
              No named version checkpoints created yet. Click "Create Named Checkpoint" above to bookmark the current state.
            </div>
          ) : (
            versions.map((ver) => (
              <div
                key={ver.id}
                className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between gap-4 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100">{ver.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/60 font-mono">
                      v{ver.versionNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(ver.createdAt).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-500" />
                      {ver.createdBy}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-slate-500">
                      <HardDrive className="w-3 h-3" />
                      {(ver.sizeBytes / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleRestore(ver.id, ver.name)}
                  disabled={restoringId === ver.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                  title="Restore this version snapshot"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${restoringId === ver.id ? 'animate-spin' : ''}`} />
                  <span>Restore</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
