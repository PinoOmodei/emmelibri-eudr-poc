import axios from 'axios';
import { config } from './config.js';

export async function getAccessToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', config.clientId);
  params.append('client_secret', config.clientSecret);

  const { data } = await axios.post(config.tokenUrl, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  if (!data.access_token) throw new Error('Token missing in response');
  return data.access_token;
}
