// Prueba manual de POST /publico/productos/regenerar_price_today. Requiere el servidor en
// marcha y encola una tarea real. La ruta exige sesión y clave.
// Uso: TEST_TOKEN=<token de sesión> node test_regenerar_endpoint.js

require("dotenv").config({ path: '.env' });
const axios = require('axios');

const KEY = process.env.KEY_INT;
const TOKEN = process.env.TEST_TOKEN;
const BASE_URL = `http://localhost:${process.env.service_port_api}/publico/productos`;

(async () => {
    if (!KEY || !TOKEN) {
        console.error('Faltan KEY_INT (en .env) o TEST_TOKEN (token de una sesión activa)');
        process.exit(1);
    }

    try {
        console.log('Enviando petición de regeneración...');
        const resp = await axios.post(`${BASE_URL}/regenerar_price_today`, { key: KEY }, { headers: { 'x-api-key': TOKEN } });
        console.log('Respuesta del servidor:', resp.data);
    } catch (err) {
        console.error('Error al llamar al endpoint:', err.response?.data || err.message);
    }
})();
