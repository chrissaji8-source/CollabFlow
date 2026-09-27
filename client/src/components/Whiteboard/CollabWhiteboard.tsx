import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { UserProfile } from '../../lib/utils/user.js';
import { WhiteboardElement, ElementType, Point, UserPresence } from '../../lib/types.js';
import {
  Square, Circle, Diamond, ArrowRight, StickyNote,
  Pencil, Type, MousePointer, Hand, ZoomIn, ZoomOut,
  Maximize2, Trash2, Copy, ArrowUp, ArrowDown, Download,
  Undo, Redo, Palette, Grid
} from 'lucide-react';

interface CollabWhiteboardProps {
  ydoc: Y.Doc;
  provider: WebsocketProvider | null;
  currentUser: UserProfile;
  onlineUsers: UserPresence[];
  onCursorMove?: (pos: { x: number; y: number }) => void;
}

const COLOR_PALETTE = [
  '#ffffff', '#94a3b8', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'
];

const BG_COLOR_PALETTE = [
  'transparent', '#1e293b44', '#1e3a8a44', '#064e3b44', '#78350f44', '#7f1d1d44', '#581c8744', '#83184344'
];

export const CollabWhiteboard: React.FC<CollabWhiteboardProps> = ({
  ydoc,
  provider,
  currentUser,
  onlineUsers,
  onCursorMove,
}) => {
  const [activeTool, setActiveTool] = useState<ElementType | 'select' | 'hand'>('select');
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [strokeColor, setStrokeColor] = useState('#3b82f6');
  const [bgColor, setBgColor] = useState('#1e3a8a33');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingElementRef = useRef(false);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const elementStartPosRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const currentDrawPointsRef = useRef<Point[]>([]);

  // Yjs Shared Array for Whiteboard Elements
  const yElements = useMemo(() => ydoc.getArray<WhiteboardElement>('elements'), [ydoc]);
  
  // Yjs UndoManager for Canvas
  const undoManager = useMemo(() => new Y.UndoManager(yElements), [yElements]);

  // Sync state from Yjs
  useEffect(() => {
    const updateLocalState = () => {
      setElements(yElements.toArray());
    };

    yElements.observe(updateLocalState);
    updateLocalState();

    return () => {
      yElements.unobserve(updateLocalState);
    };
  }, [yElements]);

  // Transform Screen Coordinates to Canvas World Coordinates
  const toWorldCoords = useCallback((screenX: number, screenY: number): Point => {
    if (!containerRef.current) return { x: screenX, y: screenY };
    const rect = containerRef.current.getBoundingClientRect();
    const x = (screenX - rect.left - pan.x) / zoom;
    const y = (screenY - rect.top - pan.y) / zoom;
    return { x, y };
  }, [pan, zoom]);

  // Mouse Move on Container
  const handleMouseMove = (e: React.MouseEvent) => {
    const worldPos = toWorldCoords(e.clientX, e.clientY);
    onCursorMove?.(worldPos);

    // 1. Pan mode dragging
    if (isPanning || activeTool === 'hand') {
      if (e.buttons === 1 || e.buttons === 4) { // left or middle click
        setPan((prev) => ({
          x: prev.x + e.movementX,
          y: prev.y + e.movementY,
        }));
        return;
      }
    }

    // 2. Element Dragging
    if (isDraggingElementRef.current && selectedId && elementStartPosRef.current) {
      const dx = worldPos.x - dragStartRef.current.x;
      const dy = worldPos.y - dragStartRef.current.y;

      const idx = elements.findIndex((el) => el.id === selectedId);
      if (idx !== -1) {
        const updated = {
          ...elements[idx],
          x: Math.round(elementStartPosRef.current.x + dx),
          y: Math.round(elementStartPosRef.current.y + dy),
          updatedBy: currentUser.name,
        };

        // Update in Yjs array
        ydoc.transact(() => {
          yElements.delete(idx, 1);
          yElements.insert(idx, [updated]);
        });
      }
      return;
    }

    // 3. Freehand Pen Drawing
    if (activeTool === 'draw' && e.buttons === 1) {
      currentDrawPointsRef.current.push(worldPos);
      const currentPoints = [...currentDrawPointsRef.current];

      if (selectedId) {
        const idx = elements.findIndex((el) => el.id === selectedId);
        if (idx !== -1) {
          const updated = {
            ...elements[idx],
            points: currentPoints,
          };
          ydoc.transact(() => {
            yElements.delete(idx, 1);
            yElements.insert(idx, [updated]);
          });
        }
      }
    }
  };

  // Canvas Click / Mouse Down
  const handleMouseDown = (e: React.MouseEvent) => {
    // Space/Alt or middle click activates panning
    if (e.button === 1 || e.altKey || activeTool === 'hand') {
      setIsPanning(true);
      return;
    }

    if (e.target !== containerRef.current && (e.target as HTMLElement).tagName !== 'svg') {
      // Clicked on an element
      return;
    }

    const worldPos = toWorldCoords(e.clientX, e.clientY);

    if (activeTool === 'select') {
      setSelectedId(null);
      setEditingTextId(null);
      return;
    }

    // Creating new element based on activeTool
    const newId = `el-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    let newElement: WhiteboardElement | null = null;

    if (activeTool === 'rectangle') {
      newElement = {
        id: newId,
        type: 'rectangle',
        x: Math.round(worldPos.x - 75),
        y: Math.round(worldPos.y - 45),
        width: 150,
        height: 90,
        strokeColor,
        backgroundColor: bgColor,
        strokeWidth,
        text: 'New Block',
        textColor: '#e2e8f0',
        fontSize: 14,
        zIndex: elements.length + 1,
        createdBy: currentUser.name,
      };
    } else if (activeTool === 'circle') {
      newElement = {
        id: newId,
        type: 'circle',
        x: Math.round(worldPos.x - 60),
        y: Math.round(worldPos.y - 60),
        width: 120,
        height: 120,
        strokeColor,
        backgroundColor: bgColor,
        strokeWidth,
        text: 'Circle Node',
        textColor: '#e2e8f0',
        fontSize: 14,
        zIndex: elements.length + 1,
        createdBy: currentUser.name,
      };
    } else if (activeTool === 'diamond') {
      newElement = {
        id: newId,
        type: 'diamond',
        x: Math.round(worldPos.x - 65),
        y: Math.round(worldPos.y - 50),
        width: 130,
        height: 100,
        strokeColor,
        backgroundColor: bgColor,
        strokeWidth,
        text: 'Decision?',
        textColor: '#e2e8f0',
        fontSize: 13,
        zIndex: elements.length + 1,
        createdBy: currentUser.name,
      };
    } else if (activeTool === 'sticky') {
      newElement = {
        id: newId,
        type: 'sticky',
        x: Math.round(worldPos.x - 85),
        y: Math.round(worldPos.y - 75),
        width: 170,
        height: 150,
        strokeColor: '#f59e0b',
        backgroundColor: '#78350f44',
        strokeWidth: 1,
        text: '📌 New Idea\nDouble click to edit',
        textColor: '#fde68a',
        fontSize: 14,
        zIndex: elements.length + 1,
        createdBy: currentUser.name,
      };
    } else if (activeTool === 'arrow') {
      newElement = {
        id: newId,
        type: 'arrow',
        x: Math.round(worldPos.x - 60),
        y: Math.round(worldPos.y),
        width: 120,
        height: 0,
        strokeColor,
        strokeWidth: 3,
        text: 'Connects',
        textColor: strokeColor,
        fontSize: 12,
        zIndex: elements.length + 1,
        createdBy: currentUser.name,
      };
    } else if (activeTool === 'text') {
      newElement = {
        id: newId,
        type: 'text',
        x: Math.round(worldPos.x - 50),
        y: Math.round(worldPos.y - 15),
        width: 140,
        height: 40,
        strokeColor: 'transparent',
        strokeWidth: 0,
        text: 'Heading Label',
        textColor: '#38bdf8',
        fontSize: 18,
        zIndex: elements.length + 1,
        createdBy: currentUser.name,
      };
    } else if (activeTool === 'draw') {
      currentDrawPointsRef.current = [worldPos];
      newElement = {
        id: newId,
        type: 'draw',
        x: Math.round(worldPos.x),
        y: Math.round(worldPos.y),
        width: 0,
        height: 0,
        strokeColor,
        strokeWidth: Math.max(2, strokeWidth * 1.5),
        points: [worldPos],
        zIndex: elements.length + 1,
        createdBy: currentUser.name,
      };
    }

    if (newElement) {
      yElements.push([newElement]);
      setSelectedId(newId);
      if (activeTool !== 'draw') {
        setActiveTool('select');
      }
    }
  };

  const handleMouseUp = () => {
    isDraggingElementRef.current = false;
    elementStartPosRef.current = null;
    setIsPanning(false);
    currentDrawPointsRef.current = [];
  };

  // Element Selection & Drag Start
  const handleElementMouseDown = (e: React.MouseEvent, el: WhiteboardElement) => {
    e.stopPropagation();
    if (activeTool === 'hand') return;

    setSelectedId(el.id);
    const worldPos = toWorldCoords(e.clientX, e.clientY);
    dragStartRef.current = worldPos;
    elementStartPosRef.current = { x: el.x, y: el.y, width: el.width, height: el.height };
    isDraggingElementRef.current = true;
  };

  // Element Actions
  const deleteSelected = () => {
    if (!selectedId) return;
    const idx = elements.findIndex((el) => el.id === selectedId);
    if (idx !== -1) {
      yElements.delete(idx, 1);
      setSelectedId(null);
    }
  };

  const duplicateSelected = () => {
    if (!selectedId) return;
    const el = elements.find((e) => e.id === selectedId);
    if (!el) return;

    const dup: WhiteboardElement = {
      ...el,
      id: `el-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      x: el.x + 30,
      y: el.y + 30,
      zIndex: elements.length + 1,
      createdBy: currentUser.name,
    };
    yElements.push([dup]);
    setSelectedId(dup.id);
  };

  const bringToFront = () => {
    if (!selectedId) return;
    const idx = elements.findIndex((el) => el.id === selectedId);
    if (idx !== -1) {
      const el = elements[idx];
      const maxZ = Math.max(...elements.map((e) => e.zIndex || 0), 0);
      const updated = { ...el, zIndex: maxZ + 1 };
      ydoc.transact(() => {
        yElements.delete(idx, 1);
        yElements.push([updated]);
      });
    }
  };

  const updateElementText = (id: string, text: string) => {
    const idx = elements.findIndex((el) => el.id === id);
    if (idx !== -1) {
      const updated = { ...elements[idx], text };
      ydoc.transact(() => {
        yElements.delete(idx, 1);
        yElements.insert(idx, [updated]);
      });
    }
  };

  const clearCanvas = () => {
    if (window.confirm('Are you sure you want to clear the collaborative whiteboard?')) {
      yElements.delete(0, yElements.length);
      setSelectedId(null);
    }
  };

  // Keyboard shortcuts (Delete, Escape, Ctrl+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingTextId) return; // Don't intercept while typing text

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) deleteSelected();
      } else if (e.key === 'Escape') {
        setSelectedId(null);
        setActiveTool('select');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          undoManager.redo();
        } else {
          undoManager.undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, elements, editingTextId, undoManager]);

  const selectedElement = elements.find((e) => e.id === selectedId);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative select-none">
      {/* Top Whiteboard Floating Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-700/80 shadow-2xl flex items-center gap-1.5">
        {/* Pointer / Select */}
        <button
          onClick={() => setActiveTool('select')}
          className={`p-2 rounded-xl transition-all ${
            activeTool === 'select' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Select / Move Tool (V)"
        >
          <MousePointer className="w-4 h-4" />
        </button>

        {/* Pan Hand */}
        <button
          onClick={() => setActiveTool('hand')}
          className={`p-2 rounded-xl transition-all ${
            activeTool === 'hand' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Pan Canvas (H / Space)"
        >
          <Hand className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-800 mx-1" />

        {/* Rectangle */}
        <button
          onClick={() => setActiveTool('rectangle')}
          className={`p-2 rounded-xl transition-all ${
            activeTool === 'rectangle' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Rectangle (R)"
        >
          <Square className="w-4 h-4" />
        </button>

        {/* Circle */}
        <button
          onClick={() => setActiveTool('circle')}
          className={`p-2 rounded-xl transition-all ${
            activeTool === 'circle' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Circle (O)"
        >
          <Circle className="w-4 h-4" />
        </button>

        {/* Diamond */}
        <button
          onClick={() => setActiveTool('diamond')}
          className={`p-2 rounded-xl transition-all ${
            activeTool === 'diamond' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Diamond / Decision Node (D)"
        >
          <Diamond className="w-4 h-4" />
        </button>

        {/* Arrow */}
        <button
          onClick={() => setActiveTool('arrow')}
          className={`p-2 rounded-xl transition-all ${
            activeTool === 'arrow' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Arrow Connector (A)"
        >
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Sticky Note */}
        <button
          onClick={() => setActiveTool('sticky')}
          className={`p-2 rounded-xl transition-all ${
            activeTool === 'sticky' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Sticky Note (S)"
        >
          <StickyNote className="w-4 h-4" />
        </button>

        {/* Freehand Pen */}
        <button
          onClick={() => setActiveTool('draw')}
          className={`p-2 rounded-xl transition-all ${
            activeTool === 'draw' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Freehand Draw (P)"
        >
          <Pencil className="w-4 h-4" />
        </button>

        {/* Text Block */}
        <button
          onClick={() => setActiveTool('text')}
          className={`p-2 rounded-xl transition-all ${
            activeTool === 'text' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Text Block (T)"
        >
          <Type className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-800 mx-1" />

        {/* Undo / Redo */}
        <button
          onClick={() => undoManager.undo()}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          onClick={() => undoManager.redo()}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Redo (Ctrl+Y)"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Selected Element Style Bar (Left Float) */}
      {selectedElement && (
        <div className="absolute top-20 left-6 z-20 bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-700/80 shadow-2xl space-y-3 w-56 animate-in fade-in slide-in-from-left-2 duration-150">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 border-b border-slate-800 pb-1.5">
            <span className="capitalize">{selectedElement.type} Settings</span>
            <div className="flex items-center gap-1">
              <button
                onClick={duplicateSelected}
                className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                title="Duplicate (Ctrl+D)"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={bringToFront}
                className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                title="Bring to Front"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={deleteSelected}
                className="p-1 hover:bg-rose-950/60 rounded text-rose-400"
                title="Delete (Del)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Stroke Color */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Stroke Color</label>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setStrokeColor(c);
                    const idx = elements.findIndex((e) => e.id === selectedElement.id);
                    if (idx !== -1) {
                      const updated = { ...elements[idx], strokeColor: c };
                      ydoc.transact(() => {
                        yElements.delete(idx, 1);
                        yElements.insert(idx, [updated]);
                      });
                    }
                  }}
                  className={`w-5 h-5 rounded-full border border-slate-700 transition-transform ${
                    selectedElement.strokeColor === c ? 'scale-125 ring-2 ring-blue-500' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Fill Color (if applicable) */}
          {selectedElement.type !== 'arrow' && selectedElement.type !== 'draw' && selectedElement.type !== 'text' && (
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Fill Background</label>
              <div className="flex flex-wrap gap-1.5">
                {BG_COLOR_PALETTE.map((bg) => (
                  <button
                    key={bg}
                    onClick={() => {
                      setBgColor(bg);
                      const idx = elements.findIndex((e) => e.id === selectedElement.id);
                      if (idx !== -1) {
                        const updated = { ...elements[idx], backgroundColor: bg };
                        ydoc.transact(() => {
                          yElements.delete(idx, 1);
                          yElements.insert(idx, [updated]);
                        });
                      }
                    }}
                    className={`w-5 h-5 rounded-md border border-slate-700 transition-transform ${
                      selectedElement.backgroundColor === bg ? 'scale-125 ring-2 ring-blue-500' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: bg === 'transparent' ? '#0f172a' : bg }}
                  >
                    {bg === 'transparent' && <span className="text-[10px] text-slate-500">∅</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Canvas Viewport */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        className={`w-full h-full relative cursor-crosshair overflow-hidden ${
          showGrid ? 'whiteboard-grid' : 'bg-slate-950'
        } ${activeTool === 'hand' || isPanning ? '!cursor-grab active:!cursor-grabbing' : ''}`}
      >
        {/* World Transformation Layer */}
        <div
          className="absolute inset-0 origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* SVG Overlay for Arrows and Freehand Lines */}
          <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none z-0">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#60a5fa" />
              </marker>
            </defs>

            {elements.map((el) => {
              if (el.type === 'draw' && el.points && el.points.length > 1) {
                const pathData = el.points.reduce((acc, pt, i) => {
                  return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
                }, '');

                return (
                  <path
                    key={el.id}
                    d={pathData}
                    fill="none"
                    stroke={el.strokeColor || '#3b82f6'}
                    strokeWidth={el.strokeWidth || 3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              }

              if (el.type === 'arrow') {
                const startX = el.x;
                const startY = el.y;
                const endX = el.x + el.width;
                const endY = el.y + el.height;

                return (
                  <g key={el.id}>
                    <line
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke={el.strokeColor || '#60a5fa'}
                      strokeWidth={el.strokeWidth || 3}
                      markerEnd="url(#arrowhead)"
                    />
                    {el.text && (
                      <text
                        x={(startX + endX) / 2}
                        y={(startY + endY) / 2 - 8}
                        fill={el.textColor || '#93c5fd'}
                        fontSize={el.fontSize || 12}
                        textAnchor="middle"
                        className="font-medium"
                      >
                        {el.text}
                      </text>
                    )}
                  </g>
                );
              }

              return null;
            })}
          </svg>

          {/* HTML Canvas Shapes & Sticky Notes */}
          {elements.map((el) => {
            if (el.type === 'draw' || el.type === 'arrow') return null;

            const isSelected = selectedId === el.id;
            const isEditing = editingTextId === el.id;

            let shapeClasses = 'absolute transition-shadow duration-75 flex items-center justify-center p-3 text-center ';
            let borderRadius = 'rounded-xl';

            if (el.type === 'circle') borderRadius = 'rounded-full';
            if (el.type === 'diamond') borderRadius = 'rotate-45 rounded-lg';
            if (el.type === 'sticky') borderRadius = 'rounded-sm shadow-xl';

            return (
              <div
                key={el.id}
                onMouseDown={(e) => handleElementMouseDown(e, el)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingTextId(el.id);
                }}
                className={`${shapeClasses} ${borderRadius} ${
                  isSelected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-950 shadow-2xl' : 'hover:ring-1 hover:ring-slate-500/50'
                }`}
                style={{
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.width}px`,
                  height: `${el.height}px`,
                  border: el.strokeWidth ? `${el.strokeWidth}px solid ${el.strokeColor}` : 'none',
                  backgroundColor: el.backgroundColor || 'transparent',
                  zIndex: el.zIndex || 1,
                  cursor: activeTool === 'hand' ? 'grab' : 'move',
                }}
              >
                {/* Text Content / Inline Editor */}
                <div className={`${el.type === 'diamond' ? '-rotate-45' : ''} w-full h-full flex items-center justify-center`}>
                  {isEditing ? (
                    <textarea
                      autoFocus
                      defaultValue={el.text || ''}
                      onBlur={(e) => {
                        updateElementText(el.id, e.target.value);
                        setEditingTextId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          updateElementText(el.id, (e.target as HTMLTextAreaElement).value);
                          setEditingTextId(null);
                        }
                      }}
                      className="w-full h-full bg-slate-900/90 text-white text-xs p-1 rounded resize-none outline-none border border-blue-500 font-sans"
                    />
                  ) : (
                    <div
                      className="whitespace-pre-wrap select-none font-medium leading-snug"
                      style={{
                        color: el.textColor || '#f8fafc',
                        fontSize: `${el.fontSize || 14}px`,
                      }}
                    >
                      {el.text || (el.type === 'text' ? 'Click to type' : '')}
                    </div>
                  )}
                </div>

                {/* Creator label tag on hover */}
                {el.createdBy && (
                  <div className="absolute -bottom-4 left-1 text-[9px] text-slate-400/80 bg-slate-900/60 px-1 rounded pointer-events-none">
                    {el.createdBy}
                  </div>
                )}
              </div>
            );
          })}

          {/* Remote Multiplayer Live Cursors on Whiteboard Canvas */}
          {onlineUsers
            .filter((u) => u.id !== currentUser.id && u.cursor && typeof u.cursor.x === 'number')
            .map((u) => (
              <div
                key={u.id}
                className="absolute pointer-events-none transition-all duration-75"
                style={{
                  left: `${u.cursor!.x}px`,
                  top: `${u.cursor!.y}px`,
                  zIndex: 100,
                }}
              >
                <svg
                  className="w-5 h-5 drop-shadow-md"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                    fill={u.color || '#3b82f6'}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                </svg>
                <div
                  className="ml-3 -mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white shadow-lg whitespace-nowrap"
                  style={{ backgroundColor: u.color || '#3b82f6' }}
                >
                  {u.avatar} {u.name}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Bottom Left Canvas Controls (Zoom, Pan, Clear, Grid) */}
      <div className="absolute bottom-5 left-6 z-20 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-700/80 shadow-2xl flex items-center gap-2">
        <button
          onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono text-slate-300 w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Reset Zoom & Pan"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-slate-800" />

        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`p-1.5 rounded-lg transition-colors ${
            showGrid ? 'text-blue-400 bg-blue-950/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Toggle Grid"
        >
          <Grid className="w-4 h-4" />
        </button>

        <button
          onClick={clearCanvas}
          className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
          title="Clear Whiteboard"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
