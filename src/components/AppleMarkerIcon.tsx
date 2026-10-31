import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface AppleMarkerIconProps {
  size?: number;
  color?: string;
}

/**
 * Exact location marker pin icon matching the user's reference design:
 * Smooth teardrop outline with rounded bottom tip and concentric hollow circular core.
 */
export const AppleMarkerIcon: React.FC<AppleMarkerIconProps> = ({
  size = 25,
  color = '#FFFFFF',
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21.6C11.4 21.6 4.6 15.6 4.6 9.6C4.6 5.5 7.9 2.2 12 2.2C16.1 2.2 19.4 5.5 19.4 9.6C19.4 15.6 12.6 21.6 12 21.6Z"
        stroke={color}
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="9.6" r="2.8" stroke={color} strokeWidth="2.1" />
    </Svg>
  );
};
