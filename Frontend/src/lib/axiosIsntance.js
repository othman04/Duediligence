import axios from 'axios';

// URL de l'API :
//  - Production (Vercel)  → variable d'environnement VITE_API_URL,
//    ou '' pour passer par le proxy /api défini dans vercel.json
//    (même origine → cookies de session OK, pas de problème CORS).
//  - Développement local  → '/api/v1' via le proxy Vite (vite.config.ts)
const baseURL = import.meta.env.VITE_API_URL ?? '/api/v1';

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true, // envoi automatique du cookie de session HTTP-Only
  headers: { 'Content-Type': 'application/json' },
});

export default axiosInstance;