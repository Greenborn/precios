const TABLE = 'negocio_contactos';
const db = (...a) => global.knex(...a);
db.transaction = (...a) => global.knex.transaction(...a);
db.fn = { now: () => global.knex.fn.now() };

// Tope de datos del mismo tipo (por ejemplo teléfonos o emails) en un perfil
const MAX_POR_TIPO = 10;

const RE_URL = /^https?:\/\/\S+$/i;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_USUARIO = /^[A-Za-z0-9._-]{2,60}$/;

// Devuelve el hostname de una URL o null si no es una URL http(s) válida
function hostnameDe(valor) {
  try {
    const url = new URL(valor);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function esDominioPermitido(hostname, dominios) {
  return dominios.some((d) => hostname === d || hostname.endsWith(`.${d}`));
}

// Teléfono/WhatsApp: se guarda en formato internacional (+ y sólo dígitos) para
// que sirvan tanto el enlace tel: como el de wa.me. Un número que empieza con 0
// es local: así armado el enlace no funcionaría, por eso se rechaza.
function normalizarTelefono(valor, label) {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.startsWith('0')) {
    return { error: `${label}: no empieces con 0, usá el código de país (por ejemplo +54 9 2494 123456).` };
  }
  if (digitos.length < 8 || digitos.length > 15) {
    return { error: `${label}: ingresá el número con código de país y característica (entre 8 y 15 dígitos).` };
  }
  return { valor: `+${digitos}` };
}

// Redes sociales: se acepta el usuario (con o sin @) o el enlace completo al
// perfil, siempre que sea del dominio de esa red.
function normalizarPerfil(valor, label, dominios) {
  if (RE_URL.test(valor)) {
    const hostname = hostnameDe(valor);
    if (!hostname || !esDominioPermitido(hostname, dominios)) {
      return { error: `${label}: el enlace tiene que ser de ${dominios[0]}.` };
    }
    return { valor };
  }
  const usuario = valor.replace(/^@+/, '');
  if (!RE_USUARIO.test(usuario)) {
    return { error: `${label}: ingresá tu usuario (letras, números, punto, guion) o el enlace completo a tu perfil.` };
  }
  return { valor: usuario };
}

// Catálogo de datos de contacto publicables. Cada tipo sabe cómo normalizar lo
// que escribió el titular y cómo armar el enlace final, así el frontend sólo
// pinta el icono oficial y abre la URL en una pestaña nueva.
const CATALOGO = [
  {
    tipo: 'telefono',
    label: 'Teléfono',
    normalizar: (valor) => normalizarTelefono(valor, 'Teléfono'),
    url: (valor) => `tel:${valor}`,
  },
  {
    tipo: 'whatsapp',
    label: 'WhatsApp',
    normalizar: (valor) => normalizarTelefono(valor, 'WhatsApp'),
    url: (valor) => `https://wa.me/${valor.replace(/\D/g, '')}`,
  },
  {
    tipo: 'email',
    label: 'Email',
    // Correo de contacto que se publica en el perfil (no es el correo de la cuenta)
    normalizar: (valor) =>
      RE_EMAIL.test(valor) && valor.length <= 190
        ? { valor: valor.toLowerCase() }
        : { error: 'Email: ingresá una dirección de correo válida.' },
    url: (valor) => `mailto:${valor}`,
  },
  {
    tipo: 'facebook',
    label: 'Facebook',
    normalizar: (valor) => normalizarPerfil(valor, 'Facebook', ['facebook.com', 'fb.com', 'fb.me', 'm.me']),
    url: (valor) => (RE_URL.test(valor) ? valor : `https://www.facebook.com/${valor}`),
  },
  {
    tipo: 'instagram',
    label: 'Instagram',
    normalizar: (valor) => normalizarPerfil(valor, 'Instagram', ['instagram.com', 'instagr.am']),
    url: (valor) => (RE_URL.test(valor) ? valor : `https://www.instagram.com/${valor}`),
  },
  {
    tipo: 'google',
    label: 'Google',
    // Una cuenta de Google es un correo (se abre como mailto:) o el enlace a un
    // perfil/ficha de Google (Google Business, Maps, etc.).
    normalizar: (valor) => {
      if (RE_EMAIL.test(valor)) return { valor: valor.toLowerCase() };
      const hostname = RE_URL.test(valor) ? hostnameDe(valor) : null;
      const dominios = ['google.com', 'goo.gl', 'g.page', 'share.google', 'googleusercontent.com'];
      if (hostname && esDominioPermitido(hostname, dominios)) return { valor };
      return { error: 'Google: ingresá tu correo de Google o el enlace a tu ficha/perfil de Google.' };
    },
    url: (valor) => (RE_URL.test(valor) ? valor : `mailto:${valor}`),
  },
  {
    tipo: 'tiktok',
    label: 'TikTok',
    normalizar: (valor) => normalizarPerfil(valor, 'TikTok', ['tiktok.com']),
    url: (valor) => (RE_URL.test(valor) ? valor : `https://www.tiktok.com/@${valor}`),
  },
  {
    tipo: 'linkedin',
    label: 'LinkedIn',
    normalizar: (valor) => normalizarPerfil(valor, 'LinkedIn', ['linkedin.com', 'linked.in']),
    url: (valor) => (RE_URL.test(valor) ? valor : `https://www.linkedin.com/in/${valor}`),
  },
];

const POR_TIPO = new Map(CATALOGO.map((c) => [c.tipo, c]));

const TIPOS_CONTACTO = CATALOGO.map(({ tipo, label }) => ({ tipo, label }));

// Orden fijo del catálogo, para que el perfil siempre muestre los iconos igual
const ORDEN = new Map(CATALOGO.map((c, i) => [c.tipo, i]));

// Enlace final al que lleva el icono del perfil (se abre en otra pestaña)
function construirUrl(tipo, valor) {
  const def = POR_TIPO.get(tipo);
  return def ? def.url(valor) : null;
}

function aSalida(row) {
  const def = POR_TIPO.get(row.tipo);
  if (!def) return null;
  return {
    tipo: row.tipo,
    label: def.label,
    valor: row.valor,
    url: def.url(row.valor),
    visible: Boolean(row.visible),
  };
}

// Contactos de un usuario, listos para mostrar (con el enlace ya armado).
// soloVisibles = true para el perfil público que ve el cliente.
async function obtenerContactos(usuarioId, { soloVisibles = false } = {}) {
  const query = db(TABLE).where({ usuario_id: usuarioId });
  if (soloVisibles) query.where({ visible: true });
  const rows = await query.orderBy('id').select('tipo', 'valor', 'visible');
  return rows
    .map(aSalida)
    .filter(Boolean)
    .map((salida) => {
      // En el perfil público no se envía el bit de visibilidad
      if (soloVisibles) delete salida.visible;
      return salida;
    })
    .sort((a, b) => ORDEN.get(a.tipo) - ORDEN.get(b.tipo));
}

// Valida y normaliza el payload del formulario. Cada tipo admite varios datos (hasta
// MAX_POR_TIPO). Un tipo que llega sólo con valores vacíos significa "borrar todos los
// datos de ese tipo". Devuelve { error } con el primer problema encontrado.
function validarContactos(contactos) {
  if (!Array.isArray(contactos)) return { error: 'Formato de contactos inválido' };

  const guardar = [];
  const tipos = new Set();
  const vistos = new Set();
  const cantidad = new Map();

  for (const item of contactos) {
    const tipo = String(item?.tipo || '').trim();
    const def = POR_TIPO.get(tipo);
    if (!def) return { error: `Tipo de contacto no permitido: ${tipo || '(vacío)'}` };
    tipos.add(tipo);

    const valor = String(item?.valor ?? '').trim();
    if (!valor) continue;
    if (valor.length > 255) return { error: `${def.label}: el valor es demasiado largo` };

    const resultado = def.normalizar(valor);
    if (resultado.error) return { error: resultado.error };

    const clave = `${tipo}:${resultado.valor.toLowerCase()}`;
    if (vistos.has(clave)) return { error: `${def.label}: "${resultado.valor}" está repetido` };
    vistos.add(clave);
    cantidad.set(tipo, (cantidad.get(tipo) || 0) + 1);
    if (cantidad.get(tipo) > MAX_POR_TIPO) {
      return { error: `${def.label}: se pueden cargar hasta ${MAX_POR_TIPO} datos` };
    }

    guardar.push({ tipo, valor: resultado.valor, visible: item?.visible === true });
  }

  const conValor = new Set(guardar.map((g) => g.tipo));
  const borrar = [...tipos].filter((t) => !conValor.has(t));
  return { guardar, borrar };
}

// Guarda los contactos del usuario en una transacción. Por cada tipo que vino en el
// formulario, el perfil queda exactamente con los datos enviados: se borran los que ya
// no están, se actualiza la visibilidad de los que siguen y se insertan los nuevos.
// Los tipos que no vinieron
// en el formulario no se tocan.
async function guardarContactos(usuarioId, { guardar, borrar }) {
  await db.transaction(async (trx) => {
    if (borrar.length > 0) {
      await trx(TABLE).where({ usuario_id: usuarioId }).whereIn('tipo', borrar).del();
    }
    const tipos = [...new Set(guardar.map((g) => g.tipo))];
    for (const tipo of tipos) {
      const deseados = guardar.filter((g) => g.tipo === tipo);
      const existentes = await trx(TABLE).where({ usuario_id: usuarioId, tipo }).orderBy('id');
      const clave = (v) => String(v).toLowerCase();
      const sobrantes = existentes.filter((e) => !deseados.some((d) => clave(d.valor) === clave(e.valor)));
      if (sobrantes.length > 0) await trx(TABLE).whereIn('id', sobrantes.map((e) => e.id)).del();
      for (const { valor, visible } of deseados) {
        const existente = existentes.find((e) => clave(e.valor) === clave(valor));
        if (existente) {
          await trx(TABLE).where({ id: existente.id }).update({ valor, visible, updated_at: trx.fn.now() });
        } else {
          await trx(TABLE).insert({ usuario_id: usuarioId, tipo, valor, visible });
        }
      }
    }
  });
}

async function borrarContactosUsuario(usuarioId, trx = db) {
  await trx(TABLE).where({ usuario_id: usuarioId }).del();
}

module.exports = { MAX_POR_TIPO, TIPOS_CONTACTO, construirUrl, obtenerContactos, validarContactos, guardarContactos, borrarContactosUsuario }
