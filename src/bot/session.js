// In-memory session store: userId -> { state, data }
const sessions = new Map();

const STATES = {
  IDLE: 'IDLE',
  UPLOAD_TMDB_ID: 'UPLOAD_TMDB_ID',
  UPLOAD_TMDB_TITLE: 'UPLOAD_TMDB_TITLE',
  UPLOAD_SERIES_TMDB_ID: 'UPLOAD_SERIES_TMDB_ID',
  UPLOAD_SERIES_TMDB_TITLE: 'UPLOAD_SERIES_TMDB_TITLE',
  UPLOAD_SERIES_SEASON: 'UPLOAD_SERIES_SEASON',
  UPLOAD_SERIES_EPISODES: 'UPLOAD_SERIES_EPISODES',
  // Upload
  UPLOAD_TITLE: 'UPLOAD_TITLE',
  UPLOAD_ORIGINAL_TITLE: 'UPLOAD_ORIGINAL_TITLE',
  UPLOAD_YEAR: 'UPLOAD_YEAR',
  UPLOAD_COUNTRY: 'UPLOAD_COUNTRY',
  UPLOAD_GENRE: 'UPLOAD_GENRE',
  UPLOAD_RATING: 'UPLOAD_RATING',
  UPLOAD_IS_PREMIERE: 'UPLOAD_IS_PREMIERE',
  UPLOAD_EXCLUSIVE: 'UPLOAD_EXCLUSIVE',
  UPLOAD_LANGUAGE: 'UPLOAD_LANGUAGE',
  UPLOAD_QUALITY: 'UPLOAD_QUALITY',
  UPLOAD_DURATION: 'UPLOAD_DURATION',
  UPLOAD_DESCRIPTION: 'UPLOAD_DESCRIPTION',
  UPLOAD_POSTER: 'UPLOAD_POSTER',
  UPLOAD_VIDEO: 'UPLOAD_VIDEO',
  UPLOAD_CONFIRM: 'UPLOAD_CONFIRM',
  // Edit
  EDIT_FIELD_VALUE: 'EDIT_FIELD_VALUE',
  // Search
  // Notification
  NOTIF_TITLE: 'NOTIF_TITLE',
  NOTIF_MESSAGE: 'NOTIF_MESSAGE',
};

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, { state: STATES.IDLE, data: {} });
  }
  return sessions.get(userId);
}

function setState(userId, state, data = {}) {
  sessions.set(userId, { state, data });
}

function updateData(userId, updates) {
  const session = getSession(userId);
  session.data = { ...session.data, ...updates };
  sessions.set(userId, session);
}

function clearSession(userId) {
  sessions.set(userId, { state: STATES.IDLE, data: {} });
}

module.exports = { STATES, getSession, setState, updateData, clearSession };
