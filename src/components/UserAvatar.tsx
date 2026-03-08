import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useUserRole } from '../context/UserRoleProvider';
import { driveGetPersonPhotoUrl } from '../lib/drive';

interface UserAvatarProps {
  size?: 'sm' | 'md';
  className?: string;
}

const sizeClasses = { sm: 'w-7 h-7 text-sm', md: 'w-8 h-8 text-base' };

export const UserAvatar: React.FC<UserAvatarProps> = ({ size = 'md', className = '' }) => {
  const { email, isConnected } = useAuth();
  const { userProfilePhotoFileId } = useUserRole();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfilePhotoFileId || !isConnected) {
      setPhotoUrl(null);
      return;
    }
    let cancelled = false;
    driveGetPersonPhotoUrl(userProfilePhotoFileId)
      .then((url) => {
        if (!cancelled) setPhotoUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPhotoUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userProfilePhotoFileId, isConnected]);

  const initial = email ? email.charAt(0).toUpperCase() : '?';
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
      className={`${sizeClass} rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary flex-shrink-0 ${className}`}
    >
      {initial}
    </div>
  );
};
