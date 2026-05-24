export function formatDuration(totalMs) {
  if (totalMs == null || isNaN(totalMs)) return '0s';
  const totalSeconds = Math.floor(totalMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0 && secs > 0) return `${minutes}m ${secs}s`;
  return `${minutes}m`;
}

export function escapeHTML(str) {
  if (typeof str !== 'string') return str ?? '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}