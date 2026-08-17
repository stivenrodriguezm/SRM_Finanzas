// URL única del backend, usada por toda la app (pantallas + AuthContext).
//
// El backend ya no depende de que el Mac esté encendido: corre 24/7 en el VPS
// (usuario `finanzas`, vía PM2 con arranque automático) detrás de Nginx con
// HTTPS real (Let's Encrypt). Esto funciona desde cualquier red (Wi-Fi o datos
// móviles), no solo en la misma red que el Mac.
export const API_URL = 'https://finanzas-api.muebleslottus.com/api';
