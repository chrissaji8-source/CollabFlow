import React from 'react';
import { UserPresence } from '../../lib/types.js';

interface MultiplayerCursorsProps {
  users: UserPresence[];
  currentUserId: string;
}

export const MultiplayerCursors: React.FC<MultiplayerCursorsProps> = ({ users, currentUserId }) => {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-30">
      {users
        .filter((u) => u.id !== currentUserId && u.cursor && typeof u.cursor.x === 'number' && typeof u.cursor.y === 'number')
        .map((user) => {
          const { x = 0, y = 0 } = user.cursor!;
          return (
            <div
              key={user.id}
              className="absolute transition-all duration-75 ease-out"
              style={{
                transform: `translate(${x}px, ${y}px)`,
                left: 0,
                top: 0,
              }}
            >
              {/* Cursor SVG Arrow */}
              <svg
                className="w-5 h-5 drop-shadow-md"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                  fill={user.color || '#3b82f6'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              </svg>

              {/* Cursor Name Badge */}
              <div
                className="ml-4 -mt-2 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white shadow-lg whitespace-nowrap flex items-center gap-1"
                style={{ backgroundColor: user.color || '#3b82f6' }}
              >
                <span>{user.avatar}</span>
                <span>{user.name}</span>
                {user.isTyping && <span className="animate-pulse text-[9px]">typing...</span>}
              </div>
            </div>
          );
        })}
    </div>
  );
};
