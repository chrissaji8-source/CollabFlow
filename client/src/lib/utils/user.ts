const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

const ADJECTIVES = [
  'Cosmic', 'Quantum', 'Neon', 'Cyber', 'Sonic', 'Hyper', 'Solar', 'Lunar',
  'Astral', 'Pixel', 'Vector', 'Matrix', 'Nexus', 'Pulse', 'Spark', 'Zen'
];

const NOUNS = [
  'Phoenix', 'Falcon', 'Panda', 'Lynx', 'Fox', 'Wolf', 'Dragon', 'Tiger',
  'Otter', 'Eagle', 'Hawk', 'Dolphin', 'Viper', 'Raven', 'Ghost', 'Voyager'
];

const AVATARS = ['🚀', '⚡', '🌟', '🎨', '🔥', '🔮', '🤖', '🦊', '🐱', '🦄', '🎯', '💡'];

export interface UserProfile {
  id: string;
  name: string;
  color: string;
  avatar: string;
}

export function getRandomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export function getRandomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

export function getRandomAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

export function getOrCreateUserProfile(customName?: string, customColor?: string, customAvatar?: string): UserProfile {
  const storageKey = 'collab_user_profile';
  
  if (customName) {
    const profile: UserProfile = {
      id: `usr_${Math.random().toString(36).substring(2, 9)}`,
      name: customName,
      color: customColor || getRandomColor(),
      avatar: customAvatar || getRandomAvatar(),
    };
    return profile;
  }

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    // ignore
  }

  const newProfile: UserProfile = {
    id: `usr_${Math.random().toString(36).substring(2, 9)}`,
    name: getRandomName(),
    color: getRandomColor(),
    avatar: getRandomAvatar(),
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(newProfile));
  } catch (e) {
    // ignore
  }

  return newProfile;
}

export function getSimulatedUsers(): UserProfile[] {
  return [
    { id: 'usr-alice', name: 'Alice (Engineer)', color: '#3b82f6', avatar: '👩‍💻' },
    { id: 'usr-bob', name: 'Bob (Designer)', color: '#10b981', avatar: '🎨' },
    { id: 'usr-charlie', name: 'Charlie (PM)', color: '#f59e0b', avatar: '📊' },
    { id: 'usr-diana', name: 'Diana (Architect)', color: '#8b5cf6', avatar: '⚡' },
  ];
}
