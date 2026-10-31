import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface AppleHomeIconProps {
  size?: number;
  color?: string;
}

/**
 * Exact SF Symbols house.fill icon matching the Apple Books reference design:
 * Monolithic silhouette with seamlessly integrated roof slopes, rounded peak,
 * smooth rounded shoulders, and a centered rounded-arch doorway cutout.
 */
export const AppleHomeIcon: React.FC<AppleHomeIconProps> = ({
  size = 25,
  color = '#FFFFFF',
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.74 2.86a1.9 1.9 0 0 1 2.52 0l7.85 6.78c.57.5.89 1.21.89 1.96V19.8a2.2 2.2 0 0 1-2.2 2.2H15.6a.8.8 0 0 1-.8-.8v-6.2a1.2 1.2 0 0 0-1.2-1.2h-3.2a1.2 1.2 0 0 0-1.2 1.2v6.2a.8.8 0 0 1-.8.8H4.2A2.2 2.2 0 0 1 2 19.8v-8.2c0-.75.32-1.46.89-1.96l7.85-6.78Z"
      />
    </Svg>
  );
};
