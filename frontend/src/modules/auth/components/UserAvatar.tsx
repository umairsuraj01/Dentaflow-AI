// UserAvatar.tsx — User avatar with initials fallback.

import { getInitials } from '@/lib/utils';

interface UserAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
} as const;

export function UserAvatar({ name, imageUrl, size = 'md' }: UserAvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`rounded-full object-cover ${sizeMap[size]}`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-electric font-semibold text-white ${sizeMap[size]}`}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  );
}
