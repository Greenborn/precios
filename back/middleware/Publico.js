
let express = require('express')
let _ = require("lodash")
let router = express.Router()
const { check_roles } = require("../helpers/authorization")

module.exports = router

router.use(function (request, response, next) {
  console.log("Precios middleware", request.path)
  check_roles(request, response, next, paths)
})


router.use("/busqueda", require("../routes/busqueda"))
router.use("/estadistica", require("../routes/estadistica"))
router.use("/categorias", require("../routes/categorias"))
router.use("/productos", require("../routes/productos"))
router.use("/chatbot", require("../routes/chatbot"))

var paths = [
  { path: "/busqueda/precios", public: true },
  { path: "/busqueda/promociones", public: true },
  { path: "/chatbot/chat_bot_rsp", public: true },
  { path: "/busqueda/comercios_promociones", public: true },
  { path: "/busqueda/info_comercio", public: true },
  { path: "/estadistica/data", public: true },
  { path: "/estadistica/precios_usuarios", public: true },
  { path: "/categorias/all", public: true },
  { path: "/categorias/get_empresas_categoria", public: true },
  { path: "/categorias/get_categoria_empresa", public: true },
  { path: "/categorias/get_sub_categorias", public: true },
  { path: "/productos/all", public: true },
  { path: "/productos/importar", public: true },
  { path: "/productos/importar_alquiler", public: true },
  { path: "/productos/importar_oferta", public: true },
  // Solo sesion
  { path: "/busqueda/sugerencias", public: true },
  { path: "/productos/regenerar_price_today" },
  { path: "/productos/cargar_nuevo_precio" },
  { path: "/productos/cargar_precios_formulario" },
  { path: "/productos/cargar_precios_negocio" },
]