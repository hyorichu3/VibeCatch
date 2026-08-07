const users = [];
const history = [];

function createUser(username, passwordHash) {
  const user = {
    id: users.length + 1,
    username,
    passwordHash,
  };
  users.push(user);
  return user;
}

function getUserByUsername(username) {
  return users.find((u) => u.username === username);
}

function getUserById(id) {
  return users.find((u) => u.id === Number(id));
}

function getHistoryForUser(userContext) {
  if (!userContext) {
    return history.filter((item) => item.userId === null);
  }

  const userId = Number(userContext.userId ?? userContext.id);
  const username = userContext.username;
  return history.filter((item) => item.userId === userId || item.username === username || item.userId === null);
}

function addHistoryEntry({ userContext, videoId, title, channelTitle, source = 'youtube', spotifyUrl = '' }) {
  const userId = userContext ? Number(userContext.userId ?? userContext.id) : null;
  const username = userContext ? userContext.username : 'anonymous';
  const existing = history.find((item) => item.userId === userId && item.videoId === videoId);

  if (existing) {
    existing.title = title || existing.title;
    existing.channelTitle = channelTitle || existing.channelTitle;
    existing.source = source || existing.source || 'youtube';
    existing.spotifyUrl = spotifyUrl || existing.spotifyUrl || '';
    existing.playedAt = new Date().toLocaleString('ko-KR');
    existing.hitCount += 1;
    return existing;
  }

  const entry = {
    id: history.length + 1,
    userId,
    username,
    videoId,
    title,
    channelTitle: channelTitle || '',
    source,
    spotifyUrl,
    playedAt: new Date().toLocaleString('ko-KR'),
    hitCount: 1,
  };
  history.push(entry);
  return entry;
}

function removeHistoryEntry(userContext, videoId) {
  const userId = userContext ? Number(userContext.userId ?? userContext.id) : null;
  const username = userContext ? userContext.username : 'anonymous';
  // Prefer strict match by userId + videoId
  let index = history.findIndex((item) => item.userId === userId && item.videoId === videoId);
  // If not found, try matching by username + videoId (useful when userContext shape differs)
  if (index === -1) {
    index = history.findIndex((item) => item.username === username && item.videoId === videoId);
  }
  // As a last resort for anonymous or legacy entries, remove any entry with the videoId
  if (index === -1 && !userContext) {
    index = history.findIndex((item) => item.videoId === videoId);
  }

  if (index === -1) return false;
  history.splice(index, 1);
  return true;
}

function getHistoryEntries(userContext, { sortBy = 'latest', query = '' } = {}) {
  const filtered = getHistoryForUser(userContext).filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return [item.title, item.channelTitle, item.videoId].some((value) => String(value || '').toLowerCase().includes(q));
  });

  if (sortBy === 'hits') {
    return filtered.sort((a, b) => b.hitCount - a.hitCount || b.id - a.id);
  }

  return filtered.sort((a, b) => b.id - a.id);
}

module.exports = {
  createUser,
  getUserByUsername,
  getUserById,
  addHistoryEntry,
  removeHistoryEntry,
  getHistoryEntries,
};
