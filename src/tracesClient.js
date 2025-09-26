import axios from 'axios';
import { config } from './config.js';

export async function submitDDS(token, payload) {
  const { data } = await axios.post(`${config.apiBase}/dds/submit`, payload, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
}

export async function retrieveDDS(token, referenceNumber) {
  const { data } = await axios.get(`${config.apiBase}/dds/${referenceNumber}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
}

export async function retractDDS(token, referenceNumber) {
  const { data } = await axios.post(
    `${config.apiBase}/dds/${referenceNumber}/retract`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}
