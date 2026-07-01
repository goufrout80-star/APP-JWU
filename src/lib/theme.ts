/* Minimal brand tokens (copied from the marketing site so the admin
   app reads as the same product without importing across app boundaries). */
export const T = {
  paper: '#FBFAF6',
  surface: '#FFFFFF',
  ink: '#0D1A14',
  body: '#56615B',
  muted: '#66706A',
  hairline: '#ECEAE1',
  teal: '#2BDBA4',
  tealDeep: '#0FA877',
  tealInk: '#0B7D58',
  tintTeal: '#E8F9F1',
  coral: '#FF5C38',
  coralInk: '#C73F22',
  tintCoral: '#FFEBE4',
  sun: '#F2A516',
  tintSun: '#FFF3D2',
  lilac: '#7C5CFC',
  tintLilac: '#EEEBFF',
  sky: '#2F6FB3',
  tintSky: '#E6F1FF',
} as const

export const SHADOW = {
  soft: '0 1px 3px rgba(13,26,20,0.05)',
  card: '0 1px 2px rgba(13,26,20,0.04), 0 14px 36px -16px rgba(13,26,20,0.16)',
  lift: '0 22px 54px -20px rgba(13,26,20,0.24)',
} as const
