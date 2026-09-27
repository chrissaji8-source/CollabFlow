import React, { useState, useEffect, useCallback } from 'react';
import { DocumentMetadata, DocType } from './lib/types.js';
import { getOrCreateUserProfile, UserProfile } from './lib/utils/user.js';
import { fetchDocuments, createDocument, deleteDocument, updateDocumentMetadata } from './lib/utils/api.js';
import { useYjsRoom } from './lib/crdt/useYjsRoom.js';
import { Sidebar } from './components/Navigation/Sidebar.js';
import { Navbar } from './components/Navigation/Navbar.js';
import { CollabEditor } from './components/Editor/CollabEditor.js';
import { CollabWhiteboard } from './components/Whiteboard/CollabWhiteboard.js';
import { LiveChatSidebar } from './components/Collaboration/LiveChatSidebar.js';
import { ReactionOverlay } from './components/Collaboration/ReactionOverlay.js';
import { SplitSandboxView } from './components/Sandbox/SplitSandboxView.js';
import { CRDTInspector } from './components/Debugger/CRDTInspector.js';
import { VersionHistoryModal } from './components/Versions/VersionHistoryModal.js';
import { UserProfileModal } from './components/Navigation/UserProfileModal.js';

export function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => getOrCreateUserProfile());
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentMetadata | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Modals & Panels
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [isCRDTOpen, setIsCRDTOpen] = useState(false);
  const [isVersionsOpen, setIsVersionsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Load initial document catalog
  const loadDocuments = useCallback(async () => {
    try {
      const list = await fetchDocuments();
      setDocuments(list);
      if (list.length > 0 && !selectedDoc) {
        setSelectedDoc(list[0]);
      }
    } catch (e) {
      console.error('Failed to load documents catalog', e);
    }
  }, [selectedDoc]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Active Yjs Room hook
  const activeRoomId = selectedDoc ? selectedDoc.id : 'default-room';
  const {
    ydoc,
    provider,
    syncStatus,
    onlineUsers,
    chatMessages,
    activeReactions,
    latencyMs,
    updateCursor,
    setTyping,
    sendChatMessage,
    sendReaction,
  } = useYjsRoom({
    roomId: activeRoomId,
    user: currentUser,
  });

  // Track unread chat messages when chat drawer is closed
  useEffect(() => {
    if (!isChatOpen && chatMessages.length > 0) {
      setUnreadChatCount((c) => c + 1);
    }
  }, [chatMessages.length, isChatOpen]);

  // Handle Document Creation
  const handleCreateDocument = async (type: DocType, title?: string) => {
    try {
      const defaultTitle = type === 'document' ? 'Untitled Document' : 'Untitled Canvas';
      const icon = type === 'document' ? '📝' : '🎨';
      const newDoc = await createDocument(title || defaultTitle, type, currentUser.name, icon);
      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedDoc(newDoc);
    } catch (err: any) {
      alert(`Error creating document: ${err.message}`);
    }
  };

  // Handle Document Deletion
  const handleDeleteDocument = async (id: string) => {
    try {
      await deleteDocument(id);
      const remaining = documents.filter((d) => d.id !== id);
      setDocuments(remaining);
      if (selectedDoc?.id === id) {
        setSelectedDoc(remaining[0] || null);
      }
    } catch (err: any) {
      alert(`Error deleting document: ${err.message}`);
    }
  };

  // Handle Title Update
  const handleUpdateTitle = async (newTitle: string) => {
    if (!selectedDoc || selectedDoc.title === newTitle) return;
    try {
      const updated = await updateDocumentMetadata(selectedDoc.id, { title: newTitle });
      setSelectedDoc(updated);
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (e) {
      console.error('Failed to update title metadata', e);
    }
  };

  // Global keyboard shortcuts (e.g. 'E' for reactions, Space for hand)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        sendReaction('🚀', window.innerWidth / 2, window.innerHeight - 200);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [sendReaction]);

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Left Sidebar */}
      <Sidebar
        documents={documents}
        selectedDocId={selectedDoc?.id || null}
        onSelectDoc={(doc) => {
          setSelectedDoc(doc);
          setUnreadChatCount(0);
        }}
        onCreateDoc={handleCreateDocument}
        onDeleteDoc={handleDeleteDocument}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Collaborative Workspace Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {selectedDoc ? (
          <>
            {/* Top Navbar */}
            <Navbar
              currentDoc={selectedDoc}
              currentUser={currentUser}
              onlineUsers={onlineUsers}
              syncStatus={syncStatus}
              latencyMs={latencyMs}
              unreadChatCount={unreadChatCount}
              onOpenSandbox={() => setIsSandboxOpen(true)}
              onOpenCRDTInspector={() => setIsCRDTOpen(true)}
              onOpenVersionHistory={() => setIsVersionsOpen(true)}
              onToggleChat={() => {
                setIsChatOpen(!isChatOpen);
                if (!isChatOpen) setUnreadChatCount(0);
              }}
              onOpenProfile={() => setIsProfileOpen(true)}
            />

            {/* Active Canvas or Document Editor */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
              {selectedDoc.type === 'document' ? (
                <CollabEditor
                  key={selectedDoc.id}
                  ydoc={ydoc}
                  provider={provider}
                  currentUser={currentUser}
                  documentTitle={selectedDoc.title}
                  onUpdateTitle={handleUpdateTitle}
                  onTyping={setTyping}
                />
              ) : (
                <CollabWhiteboard
                  key={selectedDoc.id}
                  ydoc={ydoc}
                  provider={provider}
                  currentUser={currentUser}
                  onlineUsers={onlineUsers}
                  onCursorMove={updateCursor}
                />
              )}

              {/* Floating Emoji Reactions Layer */}
              <ReactionOverlay
                reactions={activeReactions}
                onSendReaction={sendReaction}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-4">
            <div className="text-4xl">📝🎨</div>
            <h2 className="text-base font-semibold text-slate-300">No Document Selected</h2>
            <p className="text-xs text-slate-500">Create a new collaborative doc or whiteboard from the sidebar to begin.</p>
          </div>
        )}

        {/* Live In-Room Chat Drawer */}
        <LiveChatSidebar
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={chatMessages}
          currentUser={currentUser}
          onSendMessage={sendChatMessage}
          onlineCount={onlineUsers.length}
        />
      </div>

      {/* Multi-User Split Sandbox Modal */}
      {isSandboxOpen && selectedDoc && (
        <SplitSandboxView
          roomId={selectedDoc.id}
          docType={selectedDoc.type}
          documentTitle={selectedDoc.title}
          onClose={() => setIsSandboxOpen(false)}
        />
      )}

      {/* CRDT Inspector & Chaos Simulator Modal */}
      <CRDTInspector
        isOpen={isCRDTOpen}
        onClose={() => setIsCRDTOpen(false)}
        roomId={activeRoomId}
        ydoc={ydoc}
        provider={provider}
        latencyMs={latencyMs}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={isVersionsOpen}
        onClose={() => setIsVersionsOpen(false)}
        roomId={activeRoomId}
        currentUserName={currentUser.name}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser}
        onSaveProfile={(updated) => setCurrentUser(updated)}
      />
    </div>
  );
}

export default App;
