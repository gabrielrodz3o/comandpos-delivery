/**
 * Paleta ComandPOS Delivery — "warm white" minimalista.
 * Primario NARANJA (#F97316) — cálido, energético, identidad de delivery/comida.
 * Inspiración: Linear (light), Stripe, con acento cálido tipo on-demand delivery.
 *
 * El namespace `dark` se mantiene por compatibilidad de imports (es el tema claro).
 */
const base = {
  // Fondos
  bg: '#FAF8F5', // base — blanco cálido
  surface: '#FFFFFF', // cards
  elevated: '#FFFFFF',
  soft: '#F4F1EC', // chips inactivos / dividers de bloque

  // Bordes
  border: '#ECE7E0',
  borderHi: '#E0DAD1',

  // Texto
  text: '#1A1410', // headings — casi negro cálido
  textDim: '#5E574F',
  textMuted: '#9C948A',

  // Marca (naranja)
  primary: '#F97316', // orange-500 — accent principal
  primaryHi: '#FB923C', // orange-400
  primaryDim: '#FFEDD5', // orange-100 — tonal suave para chips
  brandDeep: '#7C2D12', // orange-900 — para gradientes hero
  brandMid: '#EA580C', // orange-600

  // Semánticos
  success: '#16A34A',
  warning: '#D97706',
  danger: '#EF4444',
  info: '#2563EB',

  // Overlays
  overlay: 'rgba(26, 20, 16, 0.45)',
  backdrop: 'rgba(250, 248, 245, 0.85)',
} as const;

export const palette = { dark: base, light: base } as const;

export const shadow = {
  none: { shadowColor: '#000', shadowOpacity: 0, shadowOffset: { width: 0, height: 0 }, shadowRadius: 0, elevation: 0 },
  sm: { shadowColor: '#1A1410', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: '#1A1410', shadowOpacity: 0.07, shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 2 },
  lg: { shadowColor: '#1A1410', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 8 }, shadowRadius: 22, elevation: 5 },
  hero: { shadowColor: '#F97316', shadowOpacity: 0.28, shadowOffset: { width: 0, height: 14 }, shadowRadius: 28, elevation: 9 },
} as const;

export type ThemeColors = typeof base;
