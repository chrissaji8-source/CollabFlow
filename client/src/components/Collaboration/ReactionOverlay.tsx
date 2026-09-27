import React, { useState } from 'react';
import { LiveReaction } from '../../lib/types.js';
import { Smile, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ReactionOverlayProps {
  reactions: LiveReaction[];
  onSendReaction: (emoji: string, x?: number, y?: number) => void;
}

const EMOJI_OPTIONS = ['❤️', '🔥', '🎉', '🚀', '💡', '👍', '👏', '👀', '💯'];

export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({ reactions, onSendReaction }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleEmojiClick = (emoji: string) => {
    // Generate reaction near the center-bottom or trigger confetti on celebration
    if (emoji === '🎉' || emoji === '🚀') {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.85 },
      });
    }

    const randomX = window.innerWidth / 2 + (Math.random() * 200 - 100);
    const randomY = window.innerHeight - 180 + (Math.random() * 60 - 30);
    onSendReaction(emoji, randomX, randomY);
  };

  return (
    <>
      {/* Active Floating Emoji Bursts */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-40">
        {reactions.map((reaction) => (
          <div
            key={reaction.id}
            className="absolute flex flex-col items-center animate-float-up pointer-events-none"
            style={{
              left: `${reaction.x || window.innerWidth / 2}px`,
              top: `${reaction.y || window.innerHeight - 200}px`,
            }}
          >
            <span className="text-3xl filter drop-shadow-md select-none">{reaction.emoji}</span>
            <span className="text-[10px] font-bold text-slate-200 bg-slate-900/80 px-1.5 py-0.5 rounded-full border border-slate-700/50 shadow">
              {reaction.userName}
            </span>
          </div>
        ))}
      </div>

      {/* Floating Reaction Bar at Bottom Right */}
      <div className="fixed bottom-5 right-6 z-30 flex items-center gap-2">
        {isOpen && (
          <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-700/80 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                className="text-xl p-1.5 hover:scale-125 transition-transform active:scale-95 rounded-lg hover:bg-slate-800/80"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`p-3 rounded-full shadow-xl border transition-all ${
            isOpen
              ? 'bg-blue-600 text-white border-blue-400 scale-105'
              : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-700/80 hover:scale-105'
          }`}
          title="Send live reaction (or press E)"
        >
          {isOpen ? <Sparkles className="w-5 h-5 animate-spin" /> : <Smile className="w-5 h-5" />}
        </button>
      </div>
    </>
  );
};
