// URL única del backend, usada por toda la app (pantallas + AuthContext).
//
// Usamos el hostname Bonjour del Mac (termina en .local) en vez de una IP fija:
// las IPs de Wi-Fi cambian cada vez que el router reasigna DHCP, pero el nombre
// .local se resuelve solo mientras el iPhone y el Mac estén en la misma red.
//
// Si en algún momento "Stivens-MacBook-Air.local" no resuelve desde el iPhone,
// reemplaza este valor por la IP local actual del Mac (Preferencias del Sistema
// > Wi-Fi > Detalles, o `ipconfig getifaddr en0` en la terminal) manteniendo el
// puerto :5005/api.
export const API_URL = 'http://Stivens-MacBook-Air.local:5005/api';
