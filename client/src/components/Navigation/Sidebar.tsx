import React, { useState } from 'react';
import { DocumentMetadata, DocType } from '../../lib/types.js';
import {
  FileText, Layout, Plus, Trash2, Search, Sparkles,
  Layers, Users, Compass, ChevronLeft, ChevronRight
} from 'lucide-react';

interface SidebarProps {
  documents: DocumentMetadata[];
  selectedDocId: string | null;
  onSelectDoc: (doc: DocumentMetadata) => void;
  onCreateDoc: (type: DocType, title?: string) => void;
  onDeleteDoc: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  documents,
  selectedDocId,
  onSelectDoc,
  onCreateDoc,
  onDeleteDoc,
  collapsed,
  onToggleCollapse,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'document' | 'whiteboard'>('all');

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || doc.type === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div
      className={`h-full bg-slate-900/90 backdrop-blur-xl border-r border-slate-800 transition-all duration-300 flex flex-col z-20 select-none ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm text-slate-100 tracking-tight">CollabFlow</h1>
              <span className="text-[10px] text-blue-400 font-mono font-semibold">CRDT Suite</span>
            </div>
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors mx-auto"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Action Buttons: New Doc / New Whiteboard */}
      {!collapsed ? (
        <div className="p-3 grid grid-cols-2 gap-2 border-b border-slate-800/80">
          <button
            onClick={() => onCreateDoc('document')}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-95"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>New Doc</span>
          </button>
          <button
            onClick={() => onCreateDoc('whiteboard')}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-95"
          >
            <Layout className="w-3.5 h-3.5" />
            <span>New Canvas</span>
          </button>
        </div>
      ) : (
        <div className="p-2 flex flex-col gap-2 border-b border-slate-800/80">
          <button
            onClick={() => onCreateDoc('document')}
            className="p-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-xl flex items-center justify-center transition-colors"
            title="New Document"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => onCreateDoc('whiteboard')}
            className="p-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-xl flex items-center justify-center transition-colors"
            title="New Canvas"
          >
            <Layout className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-2 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search workspaces..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800/80">
            <button
              onClick={() => setFilterType('all')}
              className={`flex-1 py-1 text-[11px] rounded font-medium transition-colors ${
                filterType === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('document')}
              className={`flex-1 py-1 text-[11px] rounded font-medium transition-colors ${
                filterType === 'document' ? 'bg-blue-900/60 text-blue-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Docs
            </button>
            <button
              onClick={() => setFilterType('whiteboard')}
              className={`flex-1 py-1 text-[11px] rounded font-medium transition-colors ${
                filterType === 'whiteboard' ? 'bg-emerald-900/60 text-emerald-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Canvas
            </button>
          </div>
        </div>
      )}

      {/* Document Items List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredDocs.map((doc) => {
          const isSelected = selectedDocId === doc.id;
          return (
            <div
              key={doc.id}
              onClick={() => onSelectDoc(doc)}
              className={`group flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                isSelected
                  ? 'bg-blue-600/20 text-white border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title={doc.title}
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <span className="text-base select-none shrink-0">
                  {doc.icon || (doc.type === 'document' ? '📝' : '🎨')}
                </span>
                {!collapsed && (
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold truncate text-slate-200 group-hover:text-white">
                      {doc.title}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-2">
                      <span className="capitalize">{doc.type}</span>
                      {doc.activeUsers && doc.activeUsers > 0 ? (
                        <span className="text-emerald-400 flex items-center gap-0.5">
                          <Users className="w-2.5 h-2.5" /> {doc.activeUsers}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>

              {!collapsed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${doc.title}"?`)) {
                      onDeleteDoc(doc.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-950/60 hover:text-rose-400 rounded-md text-slate-500 transition-opacity"
                  title="Delete Document"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      {!collapsed && (
        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-blue-400" /> {documents.length} workspaces
          </span>
          <span className="text-[10px] bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-400">
            v1.0.0
          </span>
        </div>
      )}
    </div>
  );
};
