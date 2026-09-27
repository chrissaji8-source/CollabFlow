import React, { useState } from 'react';
import { UserProfile, getRandomColor } from '../../lib/utils/user.js';
import { User, Sparkles, Check } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
}

const AVATAR_CHOICES = ['🚀', '⚡', '🌟', '🎨', '🔥', '🔮', '🤖', '🦊', '🐱', '🦄', '🎯', '💡', '👩‍💻', '👨‍💻', '🍕', '🎮'];
const COLOR_CHOICES = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSaveProfile,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [color, setColor] = useState(currentUser.color);
  const [avatar, setAvatar] = useState(currentUser.avatar);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updated: UserProfile = {
      ...currentUser,
      name: name.trim(),
      color,
      avatar,
    };

    try {
      localStorage.setItem('collab_user_profile', JSON.stringify(updated));
    } catch (e) {
      // ignore
    }

    onSaveProfile(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-100">Multiplayer Profile</h2>
          </div>
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Avatar Preview */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-xl ring-4 ring-slate-800 transition-transform hover:scale-105"
              style={{ backgroundColor: color }}
            >
              {avatar}
            </div>
            <span className="text-xs text-slate-400">Live Caret & Pointer Preview</span>
          </div>

          {/* Name Input */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Color Palette */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Caret / Cursor Color
            </label>
            <div className="flex items-center gap-2">
              {COLOR_CHOICES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? 'scale-125 ring-2 ring-white shadow-lg' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Avatar Emoji Choices */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Avatar Icon
            </label>
            <div className="grid grid-cols-8 gap-2">
              {AVATAR_CHOICES.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => setAvatar(emoji)}
                  className={`p-2 rounded-xl text-lg flex items-center justify-center transition-all ${
                    avatar === emoji
                      ? 'bg-blue-600/40 border border-blue-500 scale-110'
                      : 'bg-slate-950 hover:bg-slate-800'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-500/25 transition-all"
          >
            Save Profile & Broadcast
          </button>
        </form>
      </div>
    </div>
  );
};
