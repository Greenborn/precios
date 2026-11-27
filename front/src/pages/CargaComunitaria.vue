<template>
    <PublicTopBar @agregar_evnt="agregar"/>

    <main class="pub-main" id="form_carga-cnt">
      <div class="pub-container pub-container--md">
        <PageHeader title="Carga colaborativa de precios" icon="bi-cloud-upload"
                    subtitle="Los precios se publican inmediatamente en el buscador, asociados a tu usuario."
                    :breadcrumbs="[{ label: 'Inicio', to: '/' }, { label: 'Carga de precios' }]" />

        <ol class="pub-steps" aria-label="Pasos">
            <li :class="datos_formulario.comercio.trim() ? 'is-done' : 'is-active'">Comercio y fecha</li>
            <li :class="cantValidos ? 'is-done' : (datos_formulario.comercio.trim() ? 'is-active' : '')">Productos</li>
            <li :class="datos_formulario.comercio.trim() && cantValidos ? 'is-active' : ''">Enviar</li>
        </ol>

        <div v-if="mensajeExito" class="alert alert-success d-flex align-items-center gap-2" role="status">
            <Icon name="bi-check-circle-fill" /> <span class="flex-grow-1">{{ mensajeExito }}</span>
            <button type="button" class="btn-close" aria-label="Cerrar" @click="mensajeExito = ''"></button>
        </div>

        <div class="alert alert-info d-flex align-items-center gap-2 py-2" role="note" v-if="nombre_completo">
            <Icon name="bi-person-check" />
            <span>Cargando como: <b>{{ nombre_completo }}</b> <span class="gb-text-muted">({{ storeApp.userInfo?.email }})</span></span>
        </div>

        <form @submit.prevent="enviar()" novalidate>
            <Card title="1. Comercio y fecha" icon="bi-shop" class="mb-4">
                <div class="row g-3">
                    <div class="col-12 col-md-7">
                        <label for="name_enterprise" class="form-label fw-semibold">Nombre del comercio <span class="text-danger" aria-hidden="true">*</span></label>
                        <input type="text" class="form-control" v-model="datos_formulario.comercio" id="name_enterprise" aria-describedby="nameEnterpriseHelp" placeholder="Supermercado ..." required>
                        <small id="nameEnterpriseHelp" class="form-text gb-text-muted">Si el comercio no existe se creará automáticamente</small>
                    </div>
                    <div class="col-12 col-md-5">
                        <label for="fecha_carga" class="form-label fw-semibold">Fecha</label>
                        <input type="date" class="form-control" v-model="datos_formulario.fecha" id="fecha_carga" :max="dia_desde_hoy(1)" aria-describedby="fechaHelp">
                        <small id="fechaHelp" class="form-text gb-text-muted">Solo las fechas de hoy y ayer se muestran en el buscador</small>
                    </div>
                </div>
            </Card>

            <Card icon="bi-basket" class="mb-4">
                <template #header>
                    <div class="d-flex align-items-center justify-content-between w-100 gap-2">
                        <h2 class="fs-6 mb-0 d-flex align-items-center gap-2"><Icon name="bi-basket" /> 2. Productos
                            <Badge size="sm" tone="primary" :label="cantValidos + ' / ' + datos_formulario.productos.length + ' completos'" />
                        </h2>
                        <Button size="sm" variant="outline" icon="bi-plus-lg" label="Agregar producto" @click="agregar()" />
                    </div>
                </template>

                <EmptyState v-if="!datos_formulario.productos.length" size="sm" icon="bi-basket" title="Sin productos"
                            description="Agregá al menos un producto con nombre y precio." />

                <div v-for="(product, index) in datos_formulario.productos" :key="index" class="producto-row">
                    <span class="producto-row__num gb-num" aria-hidden="true">{{ index + 1 }}</span>
                    <div class="row g-2 flex-grow-1">
                        <div class="col-12 col-sm-6 col-lg-4">
                            <label :for="'product_name' + index" class="form-label small mb-1">Producto</label>
                            <input type="text" class="form-control" :id="'product_name' + index" v-model="product.nombre" placeholder="Arroz"
                                   :class="{ 'is-invalid': errores_filas[index]?.nombre }" :aria-invalid="errores_filas[index]?.nombre ? 'true' : 'false'"
                                   @input="delete errores_filas[index]">
                            <div v-if="errores_filas[index]?.nombre" class="invalid-feedback d-block">{{ errores_filas[index].nombre }}</div>
                        </div>
                        <div class="col-6 col-sm-6 col-lg-3">
                            <label :for="'product_vendor' + index" class="form-label small mb-1">Marca</label>
                            <input type="text" class="form-control" :id="'product_vendor' + index" v-model="product.marca" placeholder="Marolio">
                        </div>
                        <div class="col-6 col-sm-6 col-lg-2">
                            <label :for="'product_size' + index" class="form-label small mb-1">Presentación</label>
                            <input type="text" class="form-control" :id="'product_size' + index" v-model="product.presentacion" placeholder="1Kg">
                        </div>
                        <div class="col-12 col-sm-6 col-lg-3">
                            <label :for="'product_price' + index" class="form-label small mb-1">Precio</label>
                            <div class="input-group">
                                <span class="input-group-text">$</span>
                                <input type="text" inputmode="decimal" class="form-control gb-num" :id="'product_price' + index" v-model="product.precio" placeholder="1000"
                                       :class="{ 'is-invalid': errores_filas[index]?.precio }" :aria-invalid="errores_filas[index]?.precio ? 'true' : 'false'"
                                       @input="delete errores_filas[index]">
                            </div>
                            <div v-if="errores_filas[index]?.precio" class="invalid-feedback d-block">{{ errores_filas[index].precio }}</div>
                        </div>
                    </div>
                    <Button variant="ghost" severity="danger" icon="bi-trash" :ariaLabel="'Quitar producto ' + (index + 1)" @click="quitar(index)" />
                </div>
            </Card>

            <div class="d-flex flex-wrap justify-content-end gap-2">
                <Button variant="outline" icon="bi-plus-lg" label="Agregar otro" @click="agregar()" />
                <Button type="submit" icon="bi-send" label="Enviar precios" :loading="enviando" />
            </div>
        </form>
      </div>
    </main>
    <PublicFooter />
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PublicTopBar from "../components/publico/PublicTopBar.vue";
import PublicFooter from "../components/publico/PublicFooter.vue";
import { cargar_precios_formulario } from '../api/public/publicEndpoints'
import { getToken, getUserInfo, setUserInfo } from '../utils/auth'
import { validar_precio } from '../utils/precio'
import { dia_desde_hoy, es_fecha_futura, MENSAJE_FECHA_FUTURA } from '../utils/fecha'

import { AppStore } from "../stores/app"
const storeApp = AppStore()
const router = useRouter()

const datos_formulario = ref({
    "comercio":"",
    "fecha": dia_desde_hoy(),
    "productos": [
        { nombre: "", marca: "", presentacion: "", precio: "" }
    ]
})

// ---- UI ----
const enviando = ref(false)
const mensajeExito = ref('')
const cantValidos = computed(() => datos_formulario.value.productos.filter(p => p.nombre.trim() && validar_precio(p.precio).ok).length)

// Errores por fila: índice -> { nombre?, precio? }. Se limpian al escribir en la fila.
const errores_filas = ref({})
const fila_vacia = (p) => ['nombre', 'marca', 'presentacion', 'precio'].every(c => !String(p[c] ?? '').trim())
function validar_filas(){
    const errores = {}
    datos_formulario.value.productos.forEach((p, i) => {
        if (fila_vacia(p)) return
        const e = {}
        if (!p.nombre.trim()) e.nombre = 'El nombre del artículo es obligatorio'
        const precio = validar_precio(p.precio)
        if (!precio.ok) e.precio = precio.mensaje
        if (e.nombre || e.precio) errores[i] = e
    })
    return errores
}

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
    errores_filas.value = {}
}

async function enviar(){
    if (!datos_formulario.value.comercio.trim()){
        storeApp.mostrar_alerta("Debe indicar el nombre del comercio")
        return
    }

    if (es_fecha_futura(datos_formulario.value.fecha)){
        storeApp.mostrar_alerta(MENSAJE_FECHA_FUTURA)
        return
    }

    errores_filas.value = validar_filas()
    const con_errores = Object.entries(errores_filas.value)
    if (con_errores.length){
        storeApp.mostrar_alerta(con_errores
            .map(([i, e]) => `Fila ${Number(i) + 1}: ${[e.nombre, e.precio].filter(Boolean).join('. ')}`)
            .join('; '))
        return
    }

    // origen[k] = posición en el formulario de la fila k enviada
    const origen = datos_formulario.value.productos.map((_, i) => i)
        .filter(i => !fila_vacia(datos_formulario.value.productos[i]))
    const productos_validos = origen.map(i => {
        const p = datos_formulario.value.productos[i]
        return { ...p, precio: validar_precio(p.precio).precio }
    })
    if (productos_validos.length == 0){
        storeApp.mostrar_alerta("Debe cargar al menos un producto con nombre y precio")
        return
    }

    storeApp.loading = true
    enviando.value = true
    mensajeExito.value = ''
    let res = await cargar_precios_formulario({
        comercio: datos_formulario.value.comercio.trim(),
        fecha: datos_formulario.value.fecha,
        productos: productos_validos
    })

    storeApp.loading = false
    enviando.value = false
    if (res && res.stat){
        let mensaje = "¡Gracias por colaborar!"
        if (res.items?.cargados != undefined)
            mensaje = `¡Gracias por colaborar! Se cargaron ${res.items.cargados} precio(s)`
        if (res.items?.con_error > 0)
            mensaje += ` (${res.items.con_error} con error)`

        datos_formulario.value = {
            "comercio":"",
            "fecha": dia_desde_hoy(),
            "productos": [
                { nombre: "", marca: "", presentacion: "", precio: "" }
            ]
        }
        mensajeExito.value = mensaje
        storeApp.mostrar_alerta(mensaje)
    } else {
        for (const e of (Array.isArray(res?.errores) ? res.errores : [])){
            if (!e.fila) continue
            const i = origen[e.fila - 1]
            errores_filas.value[i] = { ...errores_filas.value[i], [e.campo]: e.mensaje }
        }
        storeApp.mostrar_alerta((typeof res?.error === 'string' && res.error) || res?.text || "Ocurrió un error al guardar los datos")
    }
}
</script>

<style scoped>
.producto-row { display: flex; align-items: flex-end; gap: var(--gb-space-3); padding: var(--gb-space-3) 0; border-bottom: 1px solid var(--gb-border); }
.producto-row:last-child { border-bottom: 0; }
.producto-row__num { flex: none; width: 1.75rem; height: 1.75rem; border-radius: 50%; display: grid; place-items: center;
  background: var(--gb-surface-2); color: var(--gb-text-muted); font-size: .8125rem; font-weight: 600; margin-bottom: .4rem; }
@media (max-width: 575.98px) { .producto-row__num { display: none; } }
</style>
