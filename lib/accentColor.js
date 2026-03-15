export const DEFAULT_ACCENTS = [
  { value: '#ff4d1c', label: 'Orange' },
  { value: '#00b5a5', label: 'Teal' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#ec4899', label: 'Pink' },
]

export function applyAccentColor(color) {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--accent', color || '#ff4d1c')
  try { localStorage.setItem('accent_color', color) } catch {}
}
