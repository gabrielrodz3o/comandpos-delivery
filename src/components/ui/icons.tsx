/**
 * Set de iconos line-art (estilo Feather, stroke 1.8) para ComandPOS Delivery.
 * Reemplaza los emojis del MVP por iconografía vectorial nítida y consistente.
 * Todos comparten la firma { size, color, strokeWidth } y heredan el color del texto.
 */
import Svg, { Path, Circle, Rect, Line, Polyline, Polygon } from 'react-native-svg';
import type { ReactNode } from 'react';

export type IconProps = { size?: number; color?: string; strokeWidth?: number };

const Base = ({ size = 22, children }: { size?: number; children: ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {children}
  </Svg>
);

const common = (color: string, w: number) => ({
  stroke: color,
  strokeWidth: w,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IcMapPin = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" {...common(color, strokeWidth)} />
    <Circle cx={12} cy={10} r={2.8} {...common(color, strokeWidth)} />
  </Base>
);

export const IcNavigation = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Polygon points="3 11 22 2 13 21 11 13 3 11" {...common(color, strokeWidth)} fill="none" />
  </Base>
);

export const IcPhone = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Path
      d="M22 16.9v2.1a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h2.1a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L7.6 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2Z"
      {...common(color, strokeWidth)}
    />
  </Base>
);

export const IcChat = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Path
      d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.7Z"
      {...common(color, strokeWidth)}
    />
  </Base>
);

export const IcCheck = ({ size, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Base size={size}>
    <Polyline points="20 6 9 17 4 12" {...common(color, strokeWidth)} fill="none" />
  </Base>
);

export const IcCheckCircle = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" {...common(color, strokeWidth)} />
    <Polyline points="22 4 12 14 9 11" {...common(color, strokeWidth)} fill="none" />
  </Base>
);

export const IcChevronRight = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Polyline points="9 18 15 12 9 6" {...common(color, strokeWidth)} fill="none" />
  </Base>
);

export const IcArrowLeft = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Line x1={19} y1={12} x2={5} y2={12} {...common(color, strokeWidth)} />
    <Polyline points="12 19 5 12 12 5" {...common(color, strokeWidth)} fill="none" />
  </Base>
);

export const IcX = ({ size, color = '#000', strokeWidth = 1.9 }: IconProps) => (
  <Base size={size}>
    <Line x1={18} y1={6} x2={6} y2={18} {...common(color, strokeWidth)} />
    <Line x1={6} y1={6} x2={18} y2={18} {...common(color, strokeWidth)} />
  </Base>
);

export const IcClock = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Circle cx={12} cy={12} r={9} {...common(color, strokeWidth)} />
    <Polyline points="12 7 12 12 15.5 14" {...common(color, strokeWidth)} fill="none" />
  </Base>
);

export const IcWallet = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Rect x={3} y={6} width={18} height={13} rx={2.6} {...common(color, strokeWidth)} />
    <Path d="M3 9.5h18" {...common(color, strokeWidth)} />
    <Circle cx={16.5} cy={13.5} r={1.1} fill={color} />
  </Base>
);

export const IcCash = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Rect x={2} y={6} width={20} height={12} rx={2.4} {...common(color, strokeWidth)} />
    <Circle cx={12} cy={12} r={2.6} {...common(color, strokeWidth)} />
    <Path d="M5.5 9.2v.01M18.5 14.8v.01" {...common(color, strokeWidth)} />
  </Base>
);

export const IcPackage = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" {...common(color, strokeWidth)} />
    <Polyline points="3.3 7 12 12 20.7 7" {...common(color, strokeWidth)} fill="none" />
    <Line x1={12} y1={22} x2={12} y2={12} {...common(color, strokeWidth)} />
  </Base>
);

export const IcPower = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Path d="M18.4 6.6a9 9 0 1 1-12.8 0" {...common(color, strokeWidth)} />
    <Line x1={12} y1={2} x2={12} y2={12} {...common(color, strokeWidth)} />
  </Base>
);

export const IcLogOut = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...common(color, strokeWidth)} />
    <Polyline points="16 17 21 12 16 7" {...common(color, strokeWidth)} fill="none" />
    <Line x1={21} y1={12} x2={9} y2={12} {...common(color, strokeWidth)} />
  </Base>
);

export const IcUser = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...common(color, strokeWidth)} />
    <Circle cx={12} cy={7} r={4} {...common(color, strokeWidth)} />
  </Base>
);

export const IcReceipt = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Path d="M6 3.5h12V19l-1.5-1.3L15 19l-1.5-1.3L12 19l-1.5-1.3L9 19l-1.5-1.3L6 19V3.5Z" {...common(color, strokeWidth)} />
    <Line x1={9} y1={8.5} x2={15} y2={8.5} {...common(color, strokeWidth)} />
    <Line x1={9} y1={12} x2={15} y2={12} {...common(color, strokeWidth)} />
  </Base>
);

export const IcBell = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...common(color, strokeWidth)} />
    <Path d="M13.7 21a2 2 0 0 1-3.4 0" {...common(color, strokeWidth)} />
  </Base>
);

export const IcZap = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" {...common(color, strokeWidth)} fill="none" />
  </Base>
);

export const IcTrendingUp = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Polyline points="23 6 13.5 15.5 8.5 10.5 1 18" {...common(color, strokeWidth)} fill="none" />
    <Polyline points="17 6 23 6 23 12" {...common(color, strokeWidth)} fill="none" />
  </Base>
);

export const IcCopy = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Rect x={9} y={9} width={12} height={12} rx={2.2} {...common(color, strokeWidth)} />
    <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" {...common(color, strokeWidth)} />
  </Base>
);

export const IcHeadset = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Path d="M4 13a8 8 0 0 1 16 0" {...common(color, strokeWidth)} />
    <Path d="M4 13.5a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2 1.5 1.5 0 0 1-1.5-1.5V15A1.5 1.5 0 0 1 4 13.5Z" {...common(color, strokeWidth)} />
    <Path d="M20 13.5a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2 1.5 1.5 0 0 0 1.5-1.5V15A1.5 1.5 0 0 0 20 13.5Z" {...common(color, strokeWidth)} />
  </Base>
);

export const IcInfo = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Circle cx={12} cy={12} r={9} {...common(color, strokeWidth)} />
    <Line x1={12} y1={11} x2={12} y2={16} {...common(color, strokeWidth)} />
    <Circle cx={12} cy={8} r={0.9} fill={color} />
  </Base>
);

/** Scooter de delivery — icono de marca para tab bar y estados vacíos. */
export const IcBike = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Circle cx={5.6} cy={16.6} r={3} {...common(color, strokeWidth)} />
    <Circle cx={18} cy={16.6} r={3} {...common(color, strokeWidth)} />
    <Path d="M8.6 16.6h6.2l-2.6-7.2H9.3" {...common(color, strokeWidth)} />
    <Path d="M15 16.6 18.2 8H21" {...common(color, strokeWidth)} />
    <Path d="M16.6 8H20" {...common(color, strokeWidth)} />
    <Path d="M9.3 9.4 8 6.4H6" {...common(color, strokeWidth)} />
  </Base>
);

/** Ruta con pines — motivo para estados vacíos / hero. */
export const IcRoute = ({ size, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Base size={size}>
    <Path d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" {...common(color, strokeWidth)} />
    <Path d="M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" {...common(color, strokeWidth)} />
    <Path d="M6 15V11a4 4 0 0 1 4-4h6" strokeDasharray="1 3" {...common(color, strokeWidth)} />
  </Base>
);
