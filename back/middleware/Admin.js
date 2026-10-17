
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
router.use("/alias_productos", require("../routes/alias_productos"))
router.use("/categorias", require("../routes/categoriasAdmin"))
router.use("/alias_categorias", require("../routes/aliasCategorias"))
router.use("/indices_precios", require("../routes/indicesPreciosAdmin"))
router.use("/precios_comunitarios", require("../routes/preciosComunitarios"))

var paths = [
  { path: "/user/login", public: true },
  { path: "/user/sso_login", public: true },
  { path: "/user/logout" },
  { path: "/user/info" },
  { path: "/user/guardar_config" },
  { path: "/user/get_all", permisos: ["usuarios.ver"] },
  { path: "/user/add_one", permisos: ["usuarios.crear"] },
  { path: "/user/put_one", permisos: ["usuarios.editar"] },
  { path: "/user/delete_one", permisos: ["usuarios.eliminar"] },
  { path: "/alias", permisos: ["productos.editar"] },
  { path: "/alias/recargar", permisos: ["productos.editar"] },
  { path: "/alias_productos/get_all", permisos: ["alias.ver"] },
  { path: "/alias_productos/productos", permisos: ["alias.ver"] },
  { path: "/alias_productos/add_one", permisos: ["alias.crear"] },
  { path: "/alias_productos/put_one", permisos: ["alias.editar"] },
  { path: "/alias_productos/delete_one", permisos: ["alias.eliminar"] },
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
  { path: "/categorias/get_all", permisos: ["categorias.ver"] },
  { path: "/categorias/productos_categoria", permisos: ["categorias.ver"] },
  { path: "/categorias/productos_disponibles", permisos: ["categorias.ver"] },
  { path: "/categorias/categorias_disponibles", permisos: ["categorias.ver"] },
  { path: "/categorias/arbol", permisos: ["categorias.ver"] },
  { path: "/categorias/add_one", permisos: ["categorias.crear"] },
  { path: "/categorias/put_one", permisos: ["categorias.editar"] },
  { path: "/categorias/delete_one", permisos: ["categorias.eliminar"] },
  { path: "/categorias/add_producto", permisos: ["categorias.editar"] },
  { path: "/categorias/remove_producto", permisos: ["categorias.editar"] },
  { path: "/alias_categorias/get_all", permisos: ["alias_categorias.ver"] },
  { path: "/alias_categorias/categorias_disponibles", permisos: ["alias_categorias.ver"] },
  { path: "/alias_categorias/add_one", permisos: ["alias_categorias.crear"] },
  { path: "/alias_categorias/put_one", permisos: ["alias_categorias.editar"] },
  { path: "/alias_categorias/delete_one", permisos: ["alias_categorias.eliminar"] },
  { path: "/indices_precios/get_all", permisos: ["indices_precios.ver"] },
  { path: "/indices_precios/alias_categoria_disponibles", permisos: ["indices_precios.ver"] },
  { path: "/indices_precios/add_one", permisos: ["indices_precios.crear"] },
  { path: "/indices_precios/put_one", permisos: ["indices_precios.editar"] },
  { path: "/indices_precios/delete_one", permisos: ["indices_precios.eliminar"] },
  { path: "/precios_comunitarios/get_all", permisos: ["precios.ver"] },
  { path: "/precios_comunitarios/delete_one", permisos: ["precios.eliminar"] },
  { path: "/comercios", public: true },
]
