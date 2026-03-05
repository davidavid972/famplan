import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { driveGetPersonPhotoUrl } from '../lib/drive';
import type { Person } from '../types/models';

interface PersonAvatarProps {
  person: Person;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-xl',
  lg: 'w-14 h-14 text-2xl',
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

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
      style={{ backgroundColor: person.color || '#94a3b8' }}
    >
      {((person.name && String(person.name).charAt(0)) || '?').toUpperCase()}
    </div>
  );
};
