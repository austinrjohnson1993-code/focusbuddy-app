export const DEFAULT_ACCENTS = [
  { value: '#ff4d1c', label: 'Orange' },
  { value: '#4ecdc4', label: 'Teal' },
  { value: '#a78bfa', label: 'Purple' },
  { value: '#34d399', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#60a5fa', label: 'Blue' },
  { value: '#f472b6', label: 'Pink' },
  { value: '#fb923c', label: 'Peach' },
  { value: '#a3e635', label: 'Lime' },
  { value: '#e879f9', label: 'Fuchsia' },
]

// Precomputed RGB triples for each accent so rgba(var(--accent-rgb), opacity) works
const ACCENT_RGB = {
  '#ff4d1c': '255,77,28',
  '#4ecdc4': '78,205,196',
  '#a78bfa': '167,139,250',
  '#34d399': '52,211,153',
  '#f59e0b': '245,158,11',
  '#60a5fa': '96,165,250',
  '#f472b6': '244,114,182',
  '#fb923c': '251,146,60',
  '#a3e635': '163,230,53',
  '#e879f9': '232,121,249',
}

export function applyAccentColor(color) {
  if (typeof document === 'undefined') return
  const hex = color || '#ff4d1c'
  document.documentElement.style.setProperty('--accent', hex)
  document.documentElement.style.setProperty('--accent-rgb', ACCENT_RGB[hex] || '255,77,28')
  try { localStorage.setItem('fb_accent_color', hex) } catch {}
}
