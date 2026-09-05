// Base URL of the backend API.
// The Express server (server.ts) serves both the API and the Vite app
// on the same port, so same-origin relative requests ('') work by default.
// Override with VITE_API_BASE_URL only if the API is hosted elsewhere.
export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || '';
