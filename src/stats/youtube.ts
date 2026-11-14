/** The 11-character video id in a YouTube link (watch, youtu.be, embed, shorts, live) or a bare id. */
export function extractYoutubeId(url: string): string | null {
  if (!url) return null;

  const trimmed = url.trim();

  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|live\/|watch\?v=|&v=)([\w-]{11})/);

  return match ? match[1] : null;
}
