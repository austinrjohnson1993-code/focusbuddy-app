function sanitizeText(input, maxLength) {
  if (input === null || input === undefined) return ''
  // Strip HTML tags
  const stripped = String(input).replace(/<[^>]*>/g, '')
  // Trim and truncate
  return stripped.trim().slice(0, maxLength)
}

export function sanitizeTitle(input) {
  return sanitizeText(input, 500)
}

export function sanitizeContent(input) {
  return sanitizeText(input, 10000)
}

export function sanitizeNotes(input) {
  return sanitizeText(input, 1000)
}
