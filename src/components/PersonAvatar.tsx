import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { driveGetPersonPhotoUrl } from '../lib/drive';
import type { Person } from '../types/models';

interface PersonAvatarProps {
  person: Person;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const DEFAULT_EMOJIS = ['👨', '👩', '👦', '👧', '🧒'];

function getDefaultEmoji(personId: string): string {
  const hash = personId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return DEFAULT_EMOJIS[Math.abs(hash) % DEFAULT_EMOJIS.length];
}

const sizeClasses = {
  sm: 'w-8 h-8 text-base',
  md: 'w-12 h-12 text-2xl',
  lg: 'w-14 h-14 text-3xl',
};

export const PersonAvatar: React.FC<PersonAvatarProps> = ({ person, size = 'md', className = '' }) => {
  const { isConnected } = useAuth();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!person.photoFileId || !isConnected) {
      setPhotoUrl(null);
      return;
    }
    let cancelled = false;
    driveGetPersonPhotoUrl(person.photoFileId)
      .then((url) => {
        if (!cancelled) setPhotoUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPhotoUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [person.photoFileId, isConnected]);

  const sizeClass = sizeClasses[size];

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  const emoji = getDefaultEmoji(person.id);
  return (
    <div
      className={`${sizeClass} rounded-2xl flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ backgroundColor: `${person.color || '#94a3b8'}20` }}
    >
      <span>{emoji}</span>
    </div>
  );
};
