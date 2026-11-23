// Catálogo de datos de contacto que un negocio puede publicar en su perfil.
// El backend (back/helpers/contactos.js) valida los mismos `tipo` y es el
// que arma la URL final; acá vive sólo la presentación: icono oficial de la
// marca (Bootstrap Icons), color de marca y ayuda del formulario.
export const TIPOS_CONTACTO = [
  {
    tipo: 'telefono',
    label: 'Teléfono',
    icono: 'bi-telephone-fill',
    color: '#495057',
    placeholder: '+54 9 2494 123456',
    ayuda: 'Con código de país y característica.',
  },
  {
    tipo: 'whatsapp',
    label: 'WhatsApp',
    icono: 'bi-whatsapp',
    color: '#25D366',
    placeholder: '+54 9 2494 123456',
    ayuda: 'Con código de país, sin el 15. Abre el chat en wa.me.',
  },
  {
    tipo: 'email',
    label: 'Email',
    icono: 'bi-envelope-fill',
    color: '#6F42C1',
    placeholder: 'contacto@minegocio.com',
    ayuda: 'Correo de contacto para tus clientes. No cambia el correo de tu cuenta.',
  },
  {
    tipo: 'facebook',
    label: 'Facebook',
    icono: 'bi-facebook',
    color: '#1877F2',
    placeholder: 'tu.usuario  o  https://facebook.com/tu.usuario',
    ayuda: 'Usuario de tu página o perfil, o el enlace completo.',
  },
  {
    tipo: 'instagram',
    label: 'Instagram',
    icono: 'bi-instagram',
    color: '#E4405F',
    // Instagram usa un degradado como identidad de marca
    degradado: 'linear-gradient(45deg, #FFDC80, #F77737, #E4405F, #C13584, #833AB4)',
    placeholder: '@tu.usuario',
    ayuda: 'Tu usuario de Instagram, con o sin @.',
  },
  {
    tipo: 'google',
    label: 'Google',
    icono: 'bi-google',
    color: '#4285F4',
    placeholder: 'tucorreo@gmail.com  o  enlace a tu ficha de Google',
    ayuda: 'Correo de Google (se abre como mail) o enlace a tu ficha de Google Business/Maps.',
  },
  {
    tipo: 'tiktok',
    label: 'TikTok',
    icono: 'bi-tiktok',
    color: '#010101',
    placeholder: '@tu.usuario',
    ayuda: 'Tu usuario de TikTok, con o sin @.',
  },
  {
    tipo: 'linkedin',
    label: 'LinkedIn',
    icono: 'bi-linkedin',
    color: '#0A66C2',
    placeholder: 'tu-usuario  o  https://linkedin.com/in/tu-usuario',
    ayuda: 'Tu usuario de LinkedIn o el enlace completo a tu perfil.',
  },
]

const POR_TIPO = new Map(TIPOS_CONTACTO.map((t) => [t.tipo, t]))

export function definicionContacto(tipo) {
  return POR_TIPO.get(tipo) || null
}

// Sólo estos esquemas se aceptan en un href: el backend ya normaliza los
// valores, esto es la última barrera contra una URL rara guardada en la base.
const ESQUEMAS_PERMITIDOS = ['https:', 'http:', 'tel:', 'mailto:']

export function urlSegura(url) {
  if (!url) return null
  try {
    return ESQUEMAS_PERMITIDOS.includes(new URL(url).protocol) ? url : null
  } catch {
    return null
  }
}
