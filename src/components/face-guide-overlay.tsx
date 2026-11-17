import Svg, { Ellipse, Path } from 'react-native-svg';

interface FaceGuideOverlayProps {
  width: number;
  height: number;
}

/**
 * Bingkai oval putus-putus + sudut emas sebagai panduan posisi wajah.
 * Digambar dengan SVG agar border putus-putus tetap rapi di Android & iOS.
 */
export function FaceGuideOverlay({ width, height }: FaceGuideOverlayProps) {
  if (width <= 0 || height <= 0) {
    return null;
  }

  const centerX = width / 2;
  const centerY = height * 0.46;
  const radiusX = width * 0.31;
  const radiusY = height * 0.35;
  const bracket = 22;
  const inset = 16;
  const left = inset;
  const right = width - inset;
  const top = inset;
  const bottom = height - inset;

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} pointerEvents="none">
      <Ellipse
        cx={centerX}
        cy={centerY}
        rx={radiusX}
        ry={radiusY}
        stroke="#FFFFFF"
        strokeOpacity={0.8}
        strokeWidth={2}
        strokeDasharray="10 8"
        fill="none"
      />
      <Ellipse
        cx={centerX}
        cy={centerY}
        rx={radiusX + 8}
        ry={radiusY + 8}
        stroke="#D9822B"
        strokeOpacity={0.35}
        strokeWidth={1}
        fill="none"
      />

      <Path
        d={`M ${left} ${top + bracket} L ${left} ${top} L ${left + bracket} ${top}`}
        stroke="#D9822B"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={`M ${right - bracket} ${top} L ${right} ${top} L ${right} ${top + bracket}`}
        stroke="#D9822B"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={`M ${left} ${bottom - bracket} L ${left} ${bottom} L ${left + bracket} ${bottom}`}
        stroke="#D9822B"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={`M ${right - bracket} ${bottom} L ${right} ${bottom} L ${right} ${bottom - bracket}`}
        stroke="#D9822B"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
