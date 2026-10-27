// SECURITY 3.3: these words opt out; case and surrounding whitespace do not matter. Free-text
// phrases such as "do not contact me" are not keywords; they are flagged for a human.
const STOP_WORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit']);

export function isStopKeyword(body: string): boolean {
  return STOP_WORDS.has(body.trim().toLowerCase());
}

export function isHelpKeyword(body: string): boolean {
  return body.trim().toLowerCase() === 'help';
}
