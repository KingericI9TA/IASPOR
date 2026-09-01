export function jarvisWebUrl(question: string) {
  const q = question.trim().slice(0, 400);
  return `https://grok.com/?q=${encodeURIComponent(q)}`;
}
