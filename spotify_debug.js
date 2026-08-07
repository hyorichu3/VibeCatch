const dotenv = require('dotenv');
dotenv.config();
const fetch = global.fetch;
const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.spotify_client_id;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || process.env.spotify_client_secret;
console.log('clientId', !!clientId, 'clientSecret', !!clientSecret);
if (!clientId || !clientSecret) process.exit(1);
const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
(async () => {
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  console.log('tokenStatus', tokenRes.status);
  const tokenBody = await tokenRes.text();
  console.log('tokenBody', tokenBody);
  if (!tokenRes.ok) return;
  const token = JSON.parse(tokenBody).access_token;
  const params = new URLSearchParams({
    seed_genres: 'classical',
    limit: '8',
    market: 'KR',
    target_valence: '0.55',
    target_energy: '0.5',
    target_acousticness: '0.6',
  });
  const url = `https://api.spotify.com/v1/recommendations?${params.toString()}`;
  console.log('url', url);
  const recRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('recStatus', recRes.status);
  console.log('recBody', await recRes.text());
})();
