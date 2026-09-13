
let express = require('express')
let _ = require("lodash")
let router = express.Router()
const { check_roles } = require("../helpers/authorization")
module.exports = router

router.use(function (request, response, next) {
  console.log("Admin middleware", request.path)
  check_roles(request, response, next, paths)
})


router.use("/user", require("../routes/userAdmin"))
router.use("/comercios", require("../routes/comercios"))
router.use("/rbac", require("../routes/rbac"))
router.use("/alias", require("../routes/alias"))

var paths = [
  { path: "/user/login", public: true },
  { path: "/user/logout" },
  { path: "/user/info" },
  { path: "/user/guardar_config" },
  { path: "/user/get_all", permisos: ["usuarios.ver"] },
  { path: "/user/add_one", permisos: ["usuarios.crear"] },
  { path: "/user/put_one", permisos: ["usuarios.editar"] },
  { path: "/user/delete_one", permisos: ["usuarios.eliminar"] },
  { path: "/alias", permisos: ["productos.editar"] },
  { path: "/alias/recargar", permisos: ["productos.editar"] },
  { path: "/rbac/get_roles", permisos: ["roles.ver"] },
  { path: "/rbac/nuevo_rol", permisos: ["roles.crear"] },
  { path: "/rbac/editar_rol", permisos: ["roles.editar"] },
  { path: "/rbac/eliminar_rol", permisos: ["roles.eliminar"] },
  { path: "/rbac/asignar_permiso_rol", permisos: ["roles.editar"] },
  { path: "/rbac/asignar_usuario_rol", permisos: ["usuarios.editar"] },
  { path: "/rbac/get_permisos", permisos: ["permisos.ver"] },
  { path: "/rbac/nuevo_permiso", permisos: ["permisos.crear"] },
  { path: "/rbac/editar_permiso", permisos: ["permisos.editar"] },
  { path: "/rbac/eliminar_permiso", permisos: ["permisos.eliminar"] },
  { path: "/rbac/get_rutas", permisos: ["rutas.ver"] },
  { path: "/rbac/nueva_ruta", permisos: ["rutas.crear"] },
  { path: "/rbac/editar_ruta", permisos: ["rutas.editar"] },
  { path: "/rbac/eliminar_ruta", permisos: ["rutas.eliminar"] },
  { path: "/comercios", public: true },
]
