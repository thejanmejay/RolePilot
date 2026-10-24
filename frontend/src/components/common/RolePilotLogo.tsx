import React from 'react';

export type LogoVariant = 'full' | 'compact' | 'icon';

export interface RolePilotLogoProps {
  /**
   * 'full': original 1:1 logo with emblem, wordmark, and tagline
   * 'compact': horizontal lockup for navigation bars and headers
   * 'icon': emblem only (R with arrow and star)
   */
  variant?: LogoVariant;
  /**
   * Predefined sizes or custom dimensions
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
  transparent?: boolean;
}

export const RolePilotLogo: React.FC<RolePilotLogoProps> = ({
  variant = 'compact',
  size = 'md',
  width,
  height,
  className = '',
  style = {},
  alt = 'RolePilot — Your Career. Your Next Move.',
  transparent = false,
}) => {
  // Determine asset source based on variant & transparency preference
  let src = '/rolepilot-compact.png';
  if (variant === 'full') {
    src = transparent ? '/rolepilot-logo-transparent.png' : '/rolepilot-logo.png';
  } else if (variant === 'icon') {
    src = transparent ? '/rolepilot-icon-transparent.png' : '/rolepilot-icon.png';
  } else {
    // compact
    src = transparent ? '/rolepilot-compact-transparent.png' : '/rolepilot-compact.png';
  }

  // Dimension presets
  let defaultHeight: number | string = 38;
  let defaultWidth: number | string = 'auto';

  if (variant === 'full') {
    switch (size) {
      case 'sm':
        defaultHeight = 80;
        defaultWidth = 80;
        break;
      case 'md':
        defaultHeight = 120;
        defaultWidth = 120;
        break;
      case 'lg':
        defaultHeight = 160;
        defaultWidth = 160;
        break;
      case 'xl':
        defaultHeight = 220;
        defaultWidth = 220;
        break;
    }
  } else if (variant === 'icon') {
    switch (size) {
      case 'sm':
        defaultHeight = 24;
        defaultWidth = 24;
        break;
      case 'md':
        defaultHeight = 36;
        defaultWidth = 36;
        break;
      case 'lg':
        defaultHeight = 48;
        defaultWidth = 48;
        break;
      case 'xl':
        defaultHeight = 64;
        defaultWidth = 64;
        break;
    }
  } else {
    // compact (aspect ratio ~ 5.08:1)
    switch (size) {
      case 'sm':
        defaultHeight = 28;
        break;
      case 'md':
        defaultHeight = 36;
        break;
      case 'lg':
        defaultHeight = 44;
        break;
      case 'xl':
        defaultHeight = 56;
        break;
    }
  }

  const finalHeight = height ?? defaultHeight;
  const finalWidth = width ?? defaultWidth;

  return (
    <img
      src={src}
      alt={alt}
      width={typeof finalWidth === 'number' ? finalWidth : undefined}
      height={typeof finalHeight === 'number' ? finalHeight : undefined}
      className={`rolepilot-logo rolepilot-logo-${variant} ${className}`.trim()}
      style={{
        height: typeof finalHeight === 'number' ? `${finalHeight}px` : finalHeight,
        width: typeof finalWidth === 'number' ? `${finalWidth}px` : finalWidth,
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style,
      }}
      loading="eager"
      decoding="async"
    />
  );
};

export default RolePilotLogo;
