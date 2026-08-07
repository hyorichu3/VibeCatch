const dotenv = require('dotenv');
dotenv.config();
const fetch = global.fetch;
const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.spotify_client_id;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || process.env.spotify_client_secret;
if (!clientId || !clientSecret) throw new Error('missing creds');
const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
(async () => {
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method:'POST',
    headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded'},
    body:'grant_type=client_credentials',
  });
  const tokenBody = await tokenRes.text();
  const tokenData = JSON.parse(tokenBody);
  console.log('tokenStatus', tokenRes.status);
  console.log('tokenData', tokenData);
  const token = tokenData.access_token;
  const seedRes = await fetch('https://api.spotify.com/v1/recommendations/available-genre-seeds', {
    headers:{Authorization:`Bearer ${token}`}
  });
  console.log('seedStatus', seedRes.status);
  console.log('seedBody', await seedRes.text());
  const params = new URLSearchParams({seed_genres:'classical',limit:'8',market:'KR',target_valence:'0.55',target_energy:'0.5',target_acousticness:'0.6'});
  const url = 'https://api.spotify.com/v1/recommendations?' + params.toString();
  console.log('testUrl', url);
  const recRes = await fetch(url, {headers:{Authorization:`Bearer ${token}`}});
  console.log('recStatus', recRes.status);
  console.log('recBody', await recRes.text());
})();
