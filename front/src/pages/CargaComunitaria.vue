<template>
    <PublicTopBar @agregar_evnt="agregar"/>

    <div class="container-fluid" id="form_carga-cnt">

        <div class="row align-items-center justify-content-center">
            <div class="col-12 col-md-10 col-lg-8 ">

                <div class="card rounded-0 mt-1 mb-1 p-0">
                    <div class="card-header p-4">
                        <h4>Carga Colaborativa de Precios</h4>
                        <p>Este formulario está pensado para que los usuarios registrados puedan cargar sus propios precios <br>
                        Los precios se publican inmediatamente en el buscador, quedando asociados a tu usuario</p>
                    </div>

                    <div class="card-body p-4">

                        <div class="row mb-3" v-if="nombre_completo">
                            <div class="col-12">
                                <div class="alert alert-info py-2 mb-0" role="alert">
                                    <i class="bi bi-person-check me-2"></i>
                                    Cargando como: <b>{{ nombre_completo }}</b>
                                    <span class="text-muted ms-1">({{ storeApp.userInfo?.email }})</span>
                                </div>
                            </div>
                        </div>

                        <div class="row justify-content-center">

                            <div class="col-12 col-md-6 col-lg-6">
                                <div class="form-group">
                                    <label for="name_enterprise">Nombre del Comercio</label>
                                    <input type="text" class="form-control"  v-model="datos_formulario.comercio" id="name_enterprise" aria-describedby="name_enterprise" placeholder="Supermercado ...">
                                    <small id="nameEnterpriseHelp" class="form-text text-muted">Si el comercio no existe se creará automáticamente</small>
                                </div>
                            </div>

                            <div class="col-12 col-md-6 col-lg-6">
                                <div class="form-group">
                                    <label for="fecha_carga">Fecha</label>
                                    <input type="date" class="form-control"  v-model="datos_formulario.fecha" id="fecha_carga" aria-describedby="fecha_carga">
                                    <small id="fechaHelp" class="form-text text-muted">Solo las fechas de hoy y ayer se muestran en el buscador</small>
                                </div>
                            </div>

                        </div>

                        <div class="row border-top">
                            <div class="col"></div>
                            <div class="col-auto m-2 mt-2">
                                <button type="button" class="btn btn-success" @click="agregar()">Agregar producto</button>
                            </div>
                            <div class="col"></div>
                        </div>

                        <div class="row border-top align-items-center border-top border-bottom" v-for="(product, index) in datos_formulario.productos" :key="product">
                            <div class="col">
                                <div class="row">
                                    <div class="col-12 col-md-3">
                                        <div class="form-group">
                                            <label for="product_name">Nombre del Producto</label>
                                            <input type="text" class="form-control" id="product_name" v-model="product.nombre" aria-describedby="product_name" placeholder="Arroz">
                                        </div>
                                    </div>

                                    <div class="col-12 col-md-3">
                                        <div class="form-group">
                                            <label for="product_vendor">Marca</label>
                                            <input type="text" class="form-control" id="product_vendor" v-model="product.marca" aria-describedby="product_vendor" placeholder="Marolio">
                                        </div>
                                    </div>

                                    <div class="col-12 col-md-3">
                                        <div class="form-group">
                                            <label for="product_size">Presentación</label>
                                            <input type="text" class="form-control" id="product_size" v-model="product.presentacion" aria-describedby="product_size" placeholder="1Kg">
                                        </div>
                                    </div>

                                    <div class="col-12 col-md-3">
                                        <div class="form-group">
                                            <label for="product_price">Precio</label>
                                            <input type="text" class="form-control" id="product_price" v-model="product.precio" aria-describedby="product_price" placeholder="1000">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="col-auto">
                                <button type="button" class="btn btn-danger" @click="quitar(index)">Quitar</button>
                            </div>
                        </div>

                        <div class="row border-top">
                            <div class="col"></div>
                            <div class="col-auto m-2 mt-2">
                                <button type="button" class="btn btn-primary" @click="enviar()">Enviar</button>
                            </div>
                            <div class="col"></div>
                        </div>
                    </div>

                </div>

            </div>
        </div>

    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PublicTopBar from "../components/publico/PublicTopBar.vue";
import { cargar_precios_formulario } from '../api/public/publicEndpoints'
import { getToken, getUserInfo, setUserInfo } from '../utils/auth'

import { AppStore } from "../stores/app"
const storeApp = AppStore()
const router = useRouter()

const datos_formulario = ref({
    "comercio":"",
    "fecha": new Date().toISOString().split('T')[0],
    "productos": [
        { nombre: "", marca: "", presentacion: "", precio: "" }
    ]
})

const nombre_completo = computed(() => {
    const u = storeApp.userInfo
    if (!u) return ''
    return [u.name, u.apellido].filter(Boolean).join(' ')
})

// Si se llega directo por URL con token (sin pasar por /admin), se restaura la
// sesión para mostrar nombre y apellido del usuario que está cargando
onMounted(async () => {
    if (!storeApp.userInfo && getToken()){
        const userInfo = await getUserInfo('admin')
        if (userInfo && userInfo.stat){
            setUserInfo('admin', storeApp, userInfo.data, router, getToken())
        }
    }
})

function agregar(){
    datos_formulario.value.productos.push({
        nombre: "", marca: "", presentacion: "", precio: ""
    })
}

function quitar(index){
    datos_formulario.value.productos.splice(index, 1)
}

async function enviar(){
    if (!datos_formulario.value.comercio.trim()){
        storeApp.mostrar_alerta("Debe indicar el nombre del comercio")
        return
    }

    const productos_validos = datos_formulario.value.productos.filter(
        p => p.nombre.trim() && Number(p.precio) > 0
    )
    if (productos_validos.length == 0){
        storeApp.mostrar_alerta("Debe cargar al menos un producto con nombre y precio")
        return
    }

    storeApp.loading = true
    let res = await cargar_precios_formulario({
        comercio: datos_formulario.value.comercio.trim(),
        fecha: datos_formulario.value.fecha,
        productos: productos_validos
    })

    storeApp.loading = false
    if (res && res.stat){
        let mensaje = "¡Gracias por colaborar!"
        if (res.items?.cargados != undefined)
            mensaje = `¡Gracias por colaborar! Se cargaron ${res.items.cargados} precio(s)`
        if (res.items?.con_error > 0)
            mensaje += ` (${res.items.con_error} con error)`

        datos_formulario.value = {
            "comercio":"",
            "fecha": new Date().toISOString().split('T')[0],
            "productos": [
                { nombre: "", marca: "", presentacion: "", precio: "" }
            ]
        }
        storeApp.mostrar_alerta(mensaje)
    } else {
        storeApp.mostrar_alerta(res?.error || res?.text || "Ocurrió un error al guardar los datos")
    }
}
</script>

<style>
#form_carga-cnt{
    margin-top: 5rem;
}
</style>
