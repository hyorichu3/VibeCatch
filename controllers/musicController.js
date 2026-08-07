const https = require('https');
const pool = require('../db');
const { addHistoryEntry, getHistoryEntries, removeHistoryEntry } = require('../serverData');

const WEATHER_OPTIONS = ['맑음', '흐림', '눈', '비', '더움', '쌀쌀', '추움'];
const MOOD_OPTIONS = ['상쾌', '보통', '기쁨', '우울', '슬픔', '화남'];
const GENRE_OPTIONS = ['Pop', 'Rock', 'Hip-Hop', 'Ballad', 'Jazz', 'Classic', 'Rhythm and Blues & Soul', 'Electronic Dance Music'];

const SPOTIFY_SEED_GENRE_MAP = {
  Pop: 'pop',
  Rock: 'rock',
  'Hip-Hop': 'hip-hop',
  Ballad: 'pop',
  Jazz: 'jazz',
  Classic: 'classical',
  'Rhythm and Blues & Soul': 'rnb',
  'Electronic Dance Music': 'edm',
};

const SPOTIFY_MOOD_PARAMS = {
  '상쾌': { target_valence: 0.75, target_energy: 0.7 },
  보통: { target_valence: 0.55, target_energy: 0.5 },
  기쁨: { target_valence: 0.9, target_energy: 0.8 },
  우울: { target_valence: 0.25, target_energy: 0.35 },
  슬픔: { target_valence: 0.2, target_energy: 0.3 },
  화남: { target_valence: 0.35, target_energy: 0.85 },
};

const SPOTIFY_WEATHER_PARAMS = {
  맑음: { target_danceability: 0.7 },
  흐림: { target_danceability: 0.45 },
  눈: { target_acousticness: 0.6 },
  비: { target_acousticness: 0.65 },
  더움: { target_energy: 0.85 },
  쌀쌀: { target_energy: 0.45 },
  추움: { target_energy: 0.35 },
};

const SPOTIFY_SEARCH_KEYWORDS = {
  weather: {
    맑음: 'sunny',
    흐림: 'cloudy',
    눈: 'snowy',
    비: 'rainy',
    더움: 'warm',
    쌀쌀: 'cool',
    추움: 'cold',
  },
  mood: {
    상쾌: 'uplifting',
    보통: 'chill',
    기쁨: 'happy',
    우울: 'sad',
    슬픔: 'melancholy',
    화남: 'intense',
  },
};

const SPOTIFY_GENRE_SEARCH_TERMS = {
  Pop: 'pop',
  Rock: 'rock',
  'Hip-Hop': 'hip hop',
  Ballad: 'ballad',
  Jazz: 'jazz',
  Classic: 'classical',
  'Rhythm and Blues & Soul': 'r&b soul',
  'Electronic Dance Music': 'edm electronic dance',
};

const SPOTIFY_GENRE_KEYWORDS = {
  pop: ['pop'],
  rock: ['rock'],
  'hip hop': ['hip hop', 'hip-hop', 'rap'],
  ballad: ['ballad'],
  jazz: ['jazz'],
  classical: ['classical', 'classic'],
  'r&b soul': ['r&b', 'rnb', 'soul'],
  'edm electronic dance': ['edm', 'electronic dance', 'dance'],
};

const SPOTIFY_BLOCKED_ARTIST_NAMES = ['bobby cole'];
const SPOTIFY_TOP_ARTISTS_PER_GENRE = 4;

const FALLBACK_VIDEOS = [
  { videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', channelTitle: 'Rick Astley' },
  { videoId: '9bZkp7q19f0', title: 'Gangnam Style', channelTitle: 'officialpsy' },
  { videoId: 'YQHsXMglC9A', title: 'Uptown Funk', channelTitle: 'Mark Ronson' },
];

const recommendVideos = async (req, res, next) => {
  try {
    const weather = `${req.body.weather || '맑음'}`.trim();
    const mood = `${req.body.mood || '상쾌'}`.trim();
    const genre = `${req.body.genre || 'Pop'}`.trim();
    const source = `${req.body.source || 'spotify'}`.trim().toLowerCase();

    console.log('recommendVideos request', { weather, mood, genre, source, body: req.body });

    if (!WEATHER_OPTIONS.includes(weather) || !MOOD_OPTIONS.includes(mood) || !GENRE_OPTIONS.includes(genre)) {
      return res.status(400).json({ error: '날씨, 기분, 장르 값이 올바르지 않습니다.' });
    }

    const query = `${genre} ${weather} ${mood}`;
    const apiKey = process.env.YOUTUBE_API_KEY || process.env.youtube_api_key;

    let videos = [];
    let apiMessage = '추천 실패';

    if (source === 'spotify') {
      try {
        console.log('Spotify source selected', { genre, weather, mood });
        videos = await searchSpotifyTracks({ genre, weather, mood, accessToken: await getSpotifyAccessToken() });
        if (videos.length > 0) {
          apiMessage = 'Spotify 검색 기반 완료';
        } else {
          console.log('Spotify search returned no results; falling back to recommendations');
          videos = await getSpotifyRecommendations({ genre, weather, mood });
          if (videos.length > 0) {
            apiMessage = 'Spotify 추천 기반 대체 완료';
          } else {
            apiMessage = 'Spotify에서 결과가 없어 YouTube로 대체합니다.';
          }
        }
      } catch (err) {
        console.error('Spotify error', err);
        apiMessage = `Spotify API 오류: ${err.message}`;
      }
    }

    if (videos.length === 0 && apiKey) {
      try {
        const youtubeQuery = `${query} official music video audio`;
        const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&videoEmbeddable=true&videoDefinition=high&maxResults=10&q=${encodeURIComponent(youtubeQuery)}&key=${apiKey}`;
        const youtubeResponse = await fetchYouTube(apiUrl);
        if (youtubeResponse.items && youtubeResponse.items.length > 0) {
          const blockedPattern = /(playlist|mix|best of|replay|compilation|medley|setlist|노래모음|모음|리믹스|remix|cover|karaoke|instrumental|reaction|dance practice|lyric video?)/i;
          const officialPattern = /(official|audio|mv|뮤직비디오|공식|오피셜|video clip)/i;
          const officialChannelPattern = /(official|오피셜|공식|music channel|music official|label|entertainment|records)/i;

          const scoredItems = youtubeResponse.items
            .filter((item) => {
              const text = `${item.snippet.title || ''} ${item.snippet.description || ''}`;
              return !blockedPattern.test(text);
            })
            .map((item) => {
              const title = item.snippet.title || '';
              const description = item.snippet.description || '';
              const channelTitle = item.snippet.channelTitle || '';
              let score = 0;

              if (officialPattern.test(title)) score += 20;
              if (officialPattern.test(description)) score += 10;
              if (officialChannelPattern.test(channelTitle)) score += 15;
              if (/\bofficial\b/i.test(channelTitle)) score += 10;
              if (/music video|mv|뮤직비디오|video clip/i.test(title)) score += 8;
              if (/audio/i.test(title)) score += 6;
              if (/official lyric|lyrics?/i.test(title)) score += 4;

              return { item, score };
            })
            .sort((a, b) => b.score - a.score)
            .map(({ item }) => ({
              videoId: item.id.videoId,
              title: item.snippet.title,
              channelTitle: item.snippet.channelTitle,
              hitCount: 0,
              source: 'youtube',
            }));

          if (scoredItems.length > 0) {
            videos = scoredItems;
            apiMessage = source === 'spotify' ? `${apiMessage} / YouTube 대체 추천 완료` : 'YouTube 추천 완료';
          }
        }
      } catch (err) {
        if (!apiMessage.startsWith('Spotify API 오류')) {
          apiMessage = `YouTube API 오류: ${err.message}`;
        }
      }
    }

    if (videos.length === 0) {
      videos = FALLBACK_VIDEOS.map((video) => ({ ...video, hitCount: 0, source: 'youtube' }));
    }

    const message = `${weather} / ${mood} / ${genre} 조합에 맞는 추천 음악을 준비했습니다.`;
    return res.json({ message, apiMessage, videos });
  } catch (err) {
    next(err);
  }
};

const addToHistory = async (req, res, next) => {
  try {
    const { videoId, title, channelTitle, source, spotifyUrl } = req.body;
    const userContext = req.user || null;

    if (!videoId || !title) {
      return res.status(400).json({ error: 'videoId와 제목이 필요합니다.' });
    }

    const entry = addHistoryEntry({ userContext, videoId, title, channelTitle, source, spotifyUrl });
    res.status(201).json({ message: '재생 기록이 저장되었습니다.', item: entry });
  } catch (err) {
    next(err);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const { sortBy = 'latest', query = '' } = req.query;
    const userContext = req.user || null;
    const history = getHistoryEntries(userContext, { sortBy, query });
    res.json({ history });
  } catch (err) {
    next(err);
  }
};

const incrementHit = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const userContext = req.user || null;
    const history = getHistoryEntries(userContext, { sortBy: 'latest', query: '' });
    const target = history.find((item) => item.videoId === videoId);

    if (!target) {
      return res.status(404).json({ error: '해당 기록을 찾을 수 없습니다.' });
    }

    target.hitCount += 1;
    res.json({ message: '재생 수가 증가했습니다.', hitCount: target.hitCount });
  } catch (err) {
    next(err);
  }
};

const deleteHistory = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const userContext = req.user || null;
    console.log('deleteHistory called', { videoId, userContext });
    const removed = removeHistoryEntry(userContext, videoId);
    console.log('removeHistoryEntry result:', removed);

    if (!removed) {
      return res.status(404).json({ error: '해당 기록을 찾을 수 없습니다.' });
    }

    res.json({ message: '기록이 삭제되었습니다.' });
  } catch (err) {
    next(err);
  }
};

function fetchYouTube(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {
      let data = '';
      resp.on('data', (chunk) => data += chunk);
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'YouTube API 오류'));
            return;
          }
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

const spotifyTokenCache = {
  accessToken: null,
  expiresAt: 0,
};

async function getSpotifyAccessToken() {
  const now = Date.now();
  if (spotifyTokenCache.accessToken && spotifyTokenCache.expiresAt > now + 10000) {
    return spotifyTokenCache.accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.spotify_client_id;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || process.env.spotify_client_secret;
  if (!clientId || !clientSecret) {
    throw new Error('Spotify 클라이언트 정보가 없습니다. .env에 SPOTIFY_CLIENT_ID와 SPOTIFY_CLIENT_SECRET 또는 spotify_client_id와 spotify_client_secret을 추가하세요.');
  }

  const tokenUrl = 'https://accounts.spotify.com/api/token';
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Spotify 토큰 요청 실패: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  spotifyTokenCache.accessToken = data.access_token;
  spotifyTokenCache.expiresAt = now + (data.expires_in || 3600) * 1000;
  return spotifyTokenCache.accessToken;
}

async function getSpotifyRecommendations({ genre, weather, mood }) {
  const accessToken = await getSpotifyAccessToken();
  const seedGenre = SPOTIFY_SEED_GENRE_MAP[genre] || 'pop';
  const moodParams = SPOTIFY_MOOD_PARAMS[mood] || { target_valence: 0.6, target_energy: 0.55 };
  const weatherParams = SPOTIFY_WEATHER_PARAMS[weather] || {};
  const genreTerm = SPOTIFY_GENRE_SEARCH_TERMS[genre] || genre;
  const params = new URLSearchParams({
    seed_genres: seedGenre,
    market: 'US',
    limit: '15',
    ...Object.fromEntries(Object.entries({
      ...moodParams,
      ...weatherParams,
    }).map(([key, value]) => [key, value.toString()])),
  });

  const recommendationUrl = `https://api.spotify.com/v1/recommendations?${params.toString()}`;
  let data;

  try {
    const response = await fetch(recommendationUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Spotify 추천 실패: ${response.status} ${errorBody}`);
    }

    data = await response.json();
  } catch (err) {
    console.error('Spotify recommendations failed, falling back to search', err.message || err);
    return await searchSpotifyTracks({ genre, weather, mood, accessToken });
  }

  if (!data?.tracks?.length) {
    console.warn('Spotify recommendations returned no tracks, falling back to search');
    return await searchSpotifyTracks({ genre, weather, mood, accessToken });
  }

  const validTracks = data.tracks
    .filter((track) => track.type === 'track' && !isPodcastTrack(track) && isSpotifyTrackOfficial(track) && isTrackAlbumTypeValid(track) && !isSpotifyTrackByBlockedArtist(track));

  const artistIds = Array.from(new Set(validTracks.flatMap((track) => track.artists?.map((artist) => artist.id).filter(Boolean) || [])));
  const artistPopularityMap = await fetchSpotifyArtistPopularity(artistIds, accessToken);
  const topArtistTracks = filterTracksByTopArtists(validTracks, artistPopularityMap, SPOTIFY_TOP_ARTISTS_PER_GENRE);
  const tracksToUse = topArtistTracks.length ? topArtistTracks : validTracks;
  const popularTracks = sortSpotifyTracksByPopularity(tracksToUse);
  if (!popularTracks.length) {
    return [];
  }
  return popularTracks.map((track) => ({
    videoId: track.id,
    title: track.name,
    channelTitle: track.artists.map((artist) => artist.name).join(', '),
    albumName: track.album?.name || '',
    image: track.album?.images?.[0]?.url || '',
    spotifyUrl: track.external_urls?.spotify || '',
    hitCount: 0,
    source: 'spotify',
  }));
}

function isPodcastTrack(track) {
  const text = `${track.name || ''} ${track.artists?.map((artist) => artist.name).join(' ') || ''} ${track.album?.name || ''}`.toLowerCase();
  return /podcast|episode|talk show|interview|radio/i.test(text) || track.type !== 'track';
}

function isSpotifyTrackOfficial(track) {
  const text = `${track.name || ''} ${track.artists?.map((artist) => artist.name).join(' ') || ''} ${track.album?.name || ''}`.toLowerCase();
  const blockedTerms = /(playlist|mix|replay|compilation|medley|setlist|노래모음|모음|리믹스|remix|cover|karaoke|reaction|dance practice|lyric video?|live|version|studio version|instrumental|intro|outro)/i;
  return !blockedTerms.test(text);
}

function sortSpotifyTracksByPopularity(tracks) {
  return tracks.slice().sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
}

function isTrackAlbumTypeValid(track) {
  const validTypes = ['album', 'single'];
  return validTypes.includes(track.album?.album_type);
}

async function searchSpotifyTracks({ genre, weather, mood, accessToken }) {
  const weatherTerm = SPOTIFY_SEARCH_KEYWORDS.weather[weather] || weather;
  const moodTerm = SPOTIFY_SEARCH_KEYWORDS.mood[mood] || mood;
  const genreTerm = SPOTIFY_GENRE_SEARCH_TERMS[genre] || genre;
  const queryParts = [
    `${genreTerm}`,
    `${weatherTerm}`,
    `${moodTerm}`,
  ].filter(Boolean);
  const query = queryParts.join(' ');
  const params = new URLSearchParams({
    q: query,
    type: 'track',
    market: 'US',
    limit: '10',
  });
  const searchUrl = `https://api.spotify.com/v1/search?${params.toString()}`;
  console.log('Spotify search query', { query, genreTerm, weatherTerm, moodTerm, searchUrl });
  let response = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 400 && errorBody?.includes('Invalid limit')) {
      console.warn('Spotify search limit rejected; retrying with limit=5');
      const fallbackParams = new URLSearchParams({
        q: query,
        type: 'track',
        market: 'US',
        limit: '5',
      });
      const fallbackUrl = `https://api.spotify.com/v1/search?${fallbackParams.toString()}`;
      response = await fetch(fallbackUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        const retryBody = await response.text();
        throw new Error(`Spotify 검색 실패: ${response.status} ${retryBody}`);
      }
    } else {
      throw new Error(`Spotify 검색 실패: ${response.status} ${errorBody}`);
    }
  }

  const data = await response.json();
  if (!data.tracks?.items?.length) {
    return [];
  }

  const validTracks = data.tracks.items
    .filter((track) => track.type === 'track' && !isPodcastTrack(track) && isSpotifyTrackOfficial(track) && isTrackAlbumTypeValid(track) && !isSpotifyTrackByBlockedArtist(track));

  const artistIds = Array.from(new Set(validTracks.flatMap((track) => track.artists?.map((artist) => artist.id).filter(Boolean) || [])));
  const artistPopularityMap = await fetchSpotifyArtistPopularity(artistIds, accessToken);
  const topArtistTracks = filterTracksByTopArtists(validTracks, artistPopularityMap, SPOTIFY_TOP_ARTISTS_PER_GENRE);
  const tracksToUse = topArtistTracks.length ? topArtistTracks : validTracks;
  const popularTracks = sortSpotifyTracksByPopularity(tracksToUse);
  if (!popularTracks.length) {
    return [];
  }

  return popularTracks.map((track) => ({
    videoId: track.id,
    title: track.name,
    channelTitle: track.artists.map((artist) => artist.name).join(', '),
    albumName: track.album?.name || '',
    image: track.album?.images?.[0]?.url || '',
    spotifyUrl: track.external_urls?.spotify || '',
    hitCount: 0,
    source: 'spotify',
  }));
}

function isSpotifyTrackByBlockedArtist(track) {
  const artistNames = track.artists?.map((artist) => (artist.name || '').toLowerCase()) || [];
  return artistNames.some((name) => SPOTIFY_BLOCKED_ARTIST_NAMES.some((blocked) => name.includes(blocked)));
}

async function fetchSpotifyArtistPopularity(artistIds, accessToken) {
  if (!artistIds.length) return {};
  const chunks = [];
  for (let i = 0; i < artistIds.length; i += 50) {
    chunks.push(artistIds.slice(i, i + 50));
  }

  const popularityMap = {};
  for (const chunk of chunks) {
    const url = `https://api.spotify.com/v1/artists?ids=${chunk.join(',')}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) continue;
    const result = await response.json();
    result.artists?.forEach((artist) => {
      if (artist?.id) {
        popularityMap[artist.id] = typeof artist.popularity === 'number' ? artist.popularity : 0;
      }
    });
  }

  return popularityMap;
}

function filterTracksByTopArtists(tracks, artistPopularityMap, maxArtistCount) {
  const allArtistIds = Array.from(new Set(tracks.flatMap((track) => track.artists?.map((artist) => artist.id).filter(Boolean) || [])));
  const sortedArtistIds = allArtistIds
    .map((artistId) => ({ id: artistId, popularity: artistPopularityMap[artistId] ?? 0 }))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, maxArtistCount)
    .map((artist) => artist.id);

  if (!sortedArtistIds.length) return [];

  return tracks.filter((track) => track.artists?.some((artist) => sortedArtistIds.includes(artist.id)));
}

module.exports = {
  recommendVideos,
  addToHistory,
  getHistory,
  incrementHit,
  deleteHistory,
};
