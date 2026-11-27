const { obtener_token, verificar_token, cargar_usuario } = require("./auth")

// Express (por defecto) no distingue mayusculas y tolera la barra final: la comparacion
// contra `paths` debe aplicar el mismo criterio que el router.
function normalizar_path(path) {
  return String(path).toLowerCase().replace(/\/+$/, "") || "/"
}

// `declarado` ya normalizado; un segmento ":param" admite cualquier segmento no vacio
function coincide_patron(declarado, path) {
  const esperado = declarado.split("/")
  const recibido = path.split("/")
  return esperado.length === recibido.length &&
    esperado.every((s, i) => s.startsWith(":") ? recibido[i] !== "" : s === recibido[i])
}

// Rol administrador del usuario de la sesion (la deja check_roles en request.session)
exports.es_admin = function (request) {
  return Boolean(request.session?.u_data?.roles?.includes("administrador"))
}

// Devuelve la declaracion aplicable: primero la ruta literal, luego las rutas con parametros
function buscar_ruta(paths, path) {
  const buscado = normalizar_path(path)
  return paths.find((r) => normalizar_path(r.path) === buscado) ||
    paths.find((r) => r.path.includes("/:") && coincide_patron(normalizar_path(r.path), buscado))
}

// Controla el acceso por rol/permiso. `paths` es un arreglo de:
//   { path: "/user/info", permisos: ["usuarios.ver"], public: false }
// - public:true  -> no exige autenticacion
// - sin permisos -> solo exige sesion valida
// - con permisos -> exige sesion valida y que el usuario tenga al menos uno
// - no declarada -> se rechaza (403)
exports.check_roles = async function (request, response, next, paths) {
  console.log(`Check roles path: ${request.path} method: ${request.method} `)

  const ruta = buscar_ruta(paths, request.path)
  if (!ruta) {
    const text = "Ruta no permitida"
    return response.status(403).send({ stat: false, status: false, code: "FORBIDDEN_ROUTE", text, message: text })
  }

  if (ruta.public) {
    next()
    return
  }

  const token = obtener_token(request)
  if (!token) {
    return response.send({ stat: false, code: "DO_LOGIN", text: "No hay sesion activa" })
  }

  let payload
  try {
    payload = verificar_token(token)
  } catch (err) {
    return response.send({ stat: false, code: "DO_LOGIN", text: "Token invalido o expirado" })
  }

  const usuario = await cargar_usuario(payload.id)
  if (!usuario) {
    return response.send({ stat: false, code: "DO_LOGIN", text: "Usuario no encontrado" })
  }

  // Sesion disponible para handlers posteriores
  request.session = { isLogged: true, u_data: usuario }

  if (ruta.permisos && ruta.permisos.length > 0) {
    const tiene_permiso = ruta.permisos.some((p) => usuario.permisos.includes(p))
    if (!tiene_permiso) {
      return response.send({ stat: false, code: "DO_LOGIN", text: "Permisos insuficientes" })
    }
  }

  next()
}
