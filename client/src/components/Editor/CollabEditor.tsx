import React, { useEffect, useState, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { UserProfile } from '../../lib/utils/user.js';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Highlighter,
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Code2, Minus, Undo, Redo, FileText
} from 'lucide-react';

interface CollabEditorProps {
  ydoc: Y.Doc;
  provider: WebsocketProvider | null;
  currentUser: UserProfile;
  documentTitle: string;
  onUpdateTitle?: (title: string) => void;
  onTyping?: (isTyping: boolean) => void;
}

export const CollabEditor: React.FC<CollabEditorProps> = ({
  ydoc,
  provider,
  currentUser,
  documentTitle,
  onUpdateTitle,
  onTyping,
}) => {
  const [stats, setStats] = useState({ words: 0, characters: 0 });
  const [title, setTitle] = useState(documentTitle);
  const typingTimerRef = React.useRef<any>(null);

  // Sync title from Yjs doc map
  const metaMap = useMemo(() => ydoc.getMap('doc_meta'), [ydoc]);

  useEffect(() => {
    setTitle(documentTitle);
    const handleMetaChange = () => {
      const remoteTitle = metaMap.get('title') as string;
      if (remoteTitle && remoteTitle !== title) {
        setTitle(remoteTitle);
      }
    };
    metaMap.observe(handleMetaChange);
    return () => metaMap.unobserve(handleMetaChange);
  }, [metaMap, documentTitle]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    metaMap.set('title', newTitle);
    onUpdateTitle?.(newTitle);
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Yjs handles history
      }),
      Collaboration.configure({
        document: ydoc,
        field: 'default',
      }),
      ...(provider
        ? [
            CollaborationCursor.configure({
              provider,
              user: {
                name: currentUser.name,
                color: currentUser.color,
                avatar: currentUser.avatar,
              },
            }),
          ]
        : []),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Underline,
      Placeholder.configure({
        placeholder: 'Write something insightful or press "/" for commands...',
      }),
    ],
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setStats({ words, characters: text.length });

      if (onTyping) {
        onTyping(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          onTyping(false);
        }, 1500);
      }
    },
  }, [ydoc, provider]);

  // Update user cursor metadata if user profile changes
  useEffect(() => {
    if (editor && provider) {
      editor.commands.updateUser({
        name: currentUser.name,
        color: currentUser.color,
        avatar: currentUser.avatar,
      });
    }
  }, [editor, provider, currentUser]);

  if (!editor) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2" />
        <span className="ml-3">Connecting to collaborative CRDT stream...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Formatting Toolbar */}
      <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-2 flex flex-wrap items-center gap-1 shadow-sm z-10 select-none">
        {/* Undo / Redo */}
        <div className="flex items-center border-r border-slate-800 pr-2 mr-1 gap-0.5">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        {/* Text Formats */}
        <div className="flex items-center border-r border-slate-800 pr-2 mr-1 gap-0.5">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('bold')
                ? 'bg-blue-600/30 text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('italic')
                ? 'bg-blue-600/30 text-blue-400'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('underline')
                ? 'bg-blue-600/30 text-blue-400'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('strike')
                ? 'bg-blue-600/30 text-blue-400'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('code')
                ? 'bg-blue-600/30 text-blue-400'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Inline Code"
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('highlight')
                ? 'bg-amber-500/30 text-amber-300'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Highlight text"
          >
            <Highlighter className="w-4 h-4" />
          </button>
        </div>

        {/* Headings */}
        <div className="flex items-center border-r border-slate-800 pr-2 mr-1 gap-0.5">
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('heading', { level: 1 })
                ? 'bg-blue-600/30 text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-blue-600/30 text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('heading', { level: 3 })
                ? 'bg-blue-600/30 text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </button>
        </div>

        {/* Lists & Blocks */}
        <div className="flex items-center border-r border-slate-800 pr-2 mr-1 gap-0.5">
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('bulletList')
                ? 'bg-blue-600/30 text-blue-400'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Bullet list"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('orderedList')
                ? 'bg-blue-600/30 text-blue-400'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Numbered list"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('taskList')
                ? 'bg-blue-600/30 text-blue-400'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Task / Checklist"
          >
            <CheckSquare className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('blockquote')
                ? 'bg-blue-600/30 text-blue-400'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Blockquote"
          >
            <Quote className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('codeBlock')
                ? 'bg-blue-600/30 text-blue-400'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Code Block"
          >
            <Code2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            title="Horizontal Divider"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {/* Document Stats */}
        <div className="ml-auto text-xs text-slate-500 flex items-center gap-3">
          <span>{stats.words} words</span>
          <span>{stats.characters} chars</span>
        </div>
      </div>

      {/* Editor Content Body */}
      <div className="flex-1 overflow-y-auto px-6 py-8 md:px-16 lg:px-32 max-w-5xl mx-auto w-full">
        {/* Synchronized Title Header */}
        <div className="mb-6 group">
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Untitled Document"
            className="w-full bg-transparent text-3xl md:text-4xl font-black text-slate-100 placeholder-slate-600 border-none outline-none focus:ring-0 tracking-tight"
          />
        </div>

        {/* TipTap Document Area */}
        <EditorContent editor={editor} className="min-h-[500px]" />
      </div>
    </div>
  );
};
