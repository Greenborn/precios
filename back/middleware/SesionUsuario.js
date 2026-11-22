// Autenticación para el área privada del negocio (paquetes de Greenborn).
// Usa el mismo token que el resto del sistema (x-api-key o Bearer) y deja
// req.user.id disponible para los routers inyectados.
const { obtener_token, verificar_token, cargar_usuario } = require('../helpers/auth')

module.exports = async function sesionUsuario(req, res, next) {
  try {
    const token = obtener_token(req)
    if (!token) {
      return res.status(401).json({ error: 'No hay sesión activa', code: 'DO_LOGIN' })
    }
    let payload
    try {
      payload = verificar_token(token)
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido o expirado', code: 'DO_LOGIN' })
    }
    const usuario = await cargar_usuario(payload.id)
    if (!usuario) {
      return res.status(401).json({ error: 'Usuario no encontrado', code: 'DO_LOGIN' })
    }
    req.user = { id: usuario.id }
    req.session = { isLogged: true, u_data: usuario }
    next()
  } catch (err) {
    next(err)
  }
}
