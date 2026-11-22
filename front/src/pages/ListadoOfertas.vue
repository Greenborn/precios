<template>
    <PublicTopBar @filtros_evnt="desplegar_filtros"/>

    <main class="pub-main" id="ofertas-cnt">
      <div class="pub-container">
        <PageHeader title="Promociones y ofertas" icon="bi-lightning-charge"
                    subtitle="Ofertas vigentes de comercios locales, ordenadas de menor a mayor precio."
                    :breadcrumbs="[{ label: 'Inicio', to: '/' }, { label: 'Ofertas' }]">
            <template #actions>
                <Button label="Filtros avanzados" icon="bi-sliders" variant="outline" @click="desplegar_filtros" />
            </template>
        </PageHeader>

        <button type="button" class="btn btn-outline-secondary w-100 mb-3 pub-filter-toggle"
                :aria-expanded="filtrosAbiertos ? 'true' : 'false'" aria-controls="ofertas-filtros"
                @click="filtrosAbiertos = !filtrosAbiertos">
            <Icon name="bi-funnel" /> {{ filtrosAbiertos ? 'Ocultar filtros' : 'Mostrar filtros' }}
        </button>

        <div id="ofertas-filtros" class="pub-filters mb-4" :class="{ 'is-open': filtrosAbiertos }">
            <form class="pub-search pub-search--inline mb-3" role="search" @submit.prevent="aplicarBusqueda">
                <Icon name="bi-search" class="pub-search__icon" />
                <label for="ofertas-busqueda" class="visually-hidden">Buscar en ofertas</label>
                <input id="ofertas-busqueda" class="pub-search__input" type="search" v-model="busquedaNombre"
                       placeholder="Buscar producto en ofertas" @input="aplicarBusqueda">
            </form>
            <div class="pub-chips" role="group" aria-label="Filtrar por comercio">
                <button type="button" class="pub-chip" :aria-pressed="comercioActivo === null ? 'true' : 'false'"
                        @click="elegirComercio(null)">Todos</button>
                <button v-for="e in listado_empresas" :key="e.id" type="button" class="pub-chip"
                        :aria-pressed="comercioActivo === e.id ? 'true' : 'false'" @click="elegirComercio(e.id)">
                    {{ e?.empresa?.name }}
                </button>
            </div>
        </div>

        <div v-if="cargando" class="pub-grid">
            <div v-for="n in 6" :key="n" class="pub-price-card"><Skeleton width="50%" height="1.4rem" /><Skeleton :lines="5" /></div>
        </div>

        <EmptyState v-else-if="comercios_filtrados.length == 0" icon="bi-tag" size="lg" title="No hay ofertas para mostrar"
                    description="Probá con otro producto o quitá los filtros de comercio.">
            <template #actions><Button label="Quitar filtros" variant="outline" @click="elegirComercio(null, true)" /></template>
        </EmptyState>

        <div v-else class="pub-grid">
            <Card v-for="(comercio, index) in comercios_filtrados" :key="comercio.id" class="card-ofertas" flush>
                <template #header>
                    <div class="d-flex align-items-center justify-content-between gap-2 w-100">
                        <h2 class="fs-6 mb-0 d-flex align-items-center gap-2"><Icon name="bi-shop" /> {{ comercio?.empresa?.name }}</h2>
                        <Badge tone="primary" size="sm" :label="(ofertasDe(comercio).length) + ' ofertas'" />
                    </div>
                </template>
                <ul class="list-unstyled mb-0">
                    <li class="oferta-item" v-for="(oferta, idx) in ofertasDe(comercio).slice(0,5)" :key="idx">
                        <span class="oferta-item__name" v-html="resaltarBusqueda(oferta?.products?.name, params_filtro.nombre_prod)"></span>
                        <span class="oferta-item__price gb-num" v-if="oferta?.price != -1">$ {{ formatMoney(oferta?.price) }}</span>
                        <span class="oferta-item__price" v-if="oferta?.caracteristicas?.promo_cnt && oferta?.price == -1">{{ oferta?.caracteristicas?.promo_cnt }}</span>
                        <a v-if="oferta?.url" :href="oferta?.url" target="_blank" rel="noopener" class="small" :aria-label="'Ver en la web: ' + oferta?.products?.name"><Icon name="bi-box-arrow-up-right" /></a>
                    </li>
                </ul>
                <template #footer>
                    <button class="btn btn-link btn-sm w-100 text-decoration-none" @click="mostrarModalOfertas(comercio, ofertasDe(comercio))">
                        Ver todas las ofertas <Icon name="bi-chevron-right" />
                    </button>
                </template>
            </Card>
        </div>
      </div>

        <!-- Modal de detalle de ofertas -->
        <Dialog :visible="modalOfertas.visible" @update:visible="v => { if (!v) cerrarModalOfertas() }"
                :header="modalOfertas.comercio?.empresa?.name" size="md" modal dismissableMask>
            <ul class="list-unstyled mb-0">
                <li class="oferta-item" v-for="(oferta, idx) in modalOfertas.ofertas" :key="idx">
                    <span class="oferta-item__name" v-html="resaltarBusqueda(oferta?.products?.name, params_filtro.nombre_prod)"></span>
                    <span class="oferta-item__price gb-num" v-if="oferta?.price != -1">$ {{ formatMoney(oferta?.price) }}</span>
                    <span class="oferta-item__price" v-if="oferta?.caracteristicas?.promo_cnt && oferta?.price == -1">{{ oferta?.caracteristicas?.promo_cnt }}</span>
                    <a v-if="oferta?.url" :href="oferta?.url" target="_blank" rel="noopener" class="small" :aria-label="'Ver en la web: ' + oferta?.products?.name"><Icon name="bi-box-arrow-up-right" /></a>
                </li>
            </ul>
        </Dialog>
    </main>
    <PublicFooter />
</template>

<script setup>
    import { ref, onMounted } from 'vue'
    import { AppStore } from '../stores/app'
    import PublicTopBar from "../components/publico/PublicTopBar.vue";
    import PublicFooter from "../components/publico/PublicFooter.vue";
    
    import { formatMoney, fechaDateToString } from '../helpers/formatter'
    import { busqueda_promociones, comercios_promociones } from '../api/public/publicEndpoints'
    import FormularioFiltroOferta from '../components/publico/FormularioFiltroOferta.vue'
    
    const storeApp = AppStore()
    const props = defineProps(['parametros'])
    
    const listado_promo_obtenido = ref([])
    const listado_por_comercio = ref({})
    const listado_empresas = ref([])

    const listado_comercios = ref([])
    const params_filtro = ref({
        comercio: {}, nombre_prod: ""
    })
    const comercios_filtrados = ref([])
    const ofertas_filtradas = ref([])

    const modalOfertas = ref({ visible: false, comercio: null, ofertas: [] })

    // ---- UI: filtros rápidos (chips + búsqueda) sobre filtrar_ofertas ----
    const cargando = ref(true)
    const filtrosAbiertos = ref(false)
    const busquedaNombre = ref('')
    const comercioActivo = ref(null)
    function ofertasDe(comercio){
        return ofertas_filtradas.value[String(comercio.id)]?.ofertas || []
    }
    function aplicarFiltroRapido(){
        const comercio = {}
        if (comercioActivo.value !== null) comercio[comercioActivo.value] = true
        filtrar_ofertas({ ...params_filtro.value, comercio, nombre_prod: busquedaNombre.value })
    }
    function aplicarBusqueda(){ aplicarFiltroRapido() }
    function elegirComercio(id, limpiarTexto = false){
        comercioActivo.value = id
        if (limpiarTexto) busquedaNombre.value = ''
        aplicarFiltroRapido()
    }

    function mostrarModalOfertas(comercio, ofertas) {
        modalOfertas.value = { visible: true, comercio, ofertas }
    }
    function cerrarModalOfertas() {
        modalOfertas.value.visible = false
    }

    function desplegar_filtros(){
        let modal_form = storeApp.mostrar_modal(FormularioFiltroOferta, 'Filtrar por ',
                            {
                                'params_filtro':     params_filtro.value,
                                'listado_comercios': listado_comercios.value,
                                _callback_ok: ( filtro_ ) => {
                                    filtrar_ofertas( filtro_ )
                                    busquedaNombre.value = filtro_?.nombre_prod || ''
                                    const sel = Object.keys(filtro_?.comercio || {})
                                    comercioActivo.value = sel.length == 1 ? (listado_empresas.value.find(e => String(e.id) == sel[0])?.id ?? null) : null
                                    storeApp.ocultar_modal( modal_form.code )
                                    return
                                }
                            },
                        )
    }

    function filtrar_ofertas( filtro_ ){
        params_filtro.value = filtro_

        //Filtrado por comercio
        let keys = Object.keys( params_filtro.value.comercio )
        let aux = []
        for (let i=0; i < keys.length; i++){
            if (params_filtro.value.comercio[keys[i]]){
                
                for (let j=0; j < listado_empresas.value.length; j++){
                    if (keys[i] == listado_empresas.value[j].id){                        
                        aux.push( {...listado_empresas.value[j]} )
                        break
                    }
                }
            }
            
        }

        if (aux.length == 0){ 
            aux = [...listado_empresas.value]
        }

        // filtrado por nombre de oferta (normalizar y evitar undefined)
        const terminoNombre = String(params_filtro.value.nombre_prod || '').trim().toLowerCase()
        for (let i=0; i < aux.length; i++){
            ofertas_filtradas.value[ aux[i].id ].ofertas = []
            let ofertas_comercio = listado_por_comercio.value[ aux[i].id ].ofertas           
            let prd_filtrado = []                     

            for (let k=0; k < ofertas_comercio.length; k++){
                if (!terminoNombre ||
                    encontrado( String(ofertas_comercio[k]?.products?.name || '').toLowerCase(), 
                                terminoNombre )
                ) {
                    prd_filtrado.push( {...ofertas_comercio[k]} )
                }
            }
            ofertas_filtradas.value[ aux[i].id ].ofertas = prd_filtrado
        }

        // no mostrar comercios que quedaron sin ofertas tras el filtrado
        aux = aux.filter(c => (ofertas_filtradas.value[c.id].ofertas || []).length > 0)
        comercios_filtrados.value = aux
    }

    // Clave de agrupación: nombre del comercio sin mayúsculas, tildes ni espacios sobrantes
    function claveComercio(nombre, respaldo){
        const n = String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase().replace(/\s+/g, ' ').trim()
        return n || String(respaldo)
    }

    function encontrado( string1, string2 ){
        if (string2=='') return true

        for (let i=0; i < string1.length; i++){
            if (string1[i] == string2[0]){
                let encontrado = true
                for (let j=0; j < string2.length; j++){
                    if (string1[i+j] != string2[j]){
                        encontrado = false
                        break;
                    }
                }
                if (encontrado) return true
            }
        }
        
        return false
    }

    function escapeRegex(t){ return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

    function resaltarBusqueda(texto, termino) {
        if (!termino || typeof texto !== 'string') return texto;
        const regex = new RegExp('(' + escapeRegex(String(termino)) + ')', 'ig');
        return texto.replace(regex, '<mark>$1</mark>');
    }

    onMounted(async ()=>{
        storeApp.loading = true
        let res_comercios = await comercios_promociones()
        if (res_comercios){
            storeApp.loading = false
            if (!res_comercios.stat){
                cargando.value = false
                storeApp.mostrar_alerta( "No se pudieron obtener los comercios" )
                return false
            }
            // Un comercio con varias sucursales/duplicados se muestra una sola vez (clave = nombre)
            const vistos = new Set()
            listado_comercios.value = (res_comercios?.items || [])
                .map(c => ({ ...c, branch_id: claveComercio(c.name, c.branch_id) }))
                .filter(c => !vistos.has(c.branch_id) && vistos.add(c.branch_id))
            listado_comercios.value.sort( (a, b) => (a?.name > b?.name) ? 1 : -1 )
        }

        storeApp.loading = true
        let res = await busqueda_promociones("cod_todas_las_ofertas")
        if (res){
            storeApp.loading = false
            if (!res.stat){
                cargando.value = false
                storeApp.mostrar_alerta( "No se pudieron obtener las promociones del día" )
                return false
            }
            listado_promo_obtenido.value = res?.items
            for (let i=0; i < listado_promo_obtenido.value.length; i++){
                const oferta_ = listado_promo_obtenido.value[i]
                const ID_COMERCIO = claveComercio(oferta_.empresa?.name, oferta_.branch_id)
                if (listado_por_comercio.value[ID_COMERCIO] === undefined){
                    listado_por_comercio.value[ID_COMERCIO] = {
                        "ofertas": []
                    }
                    listado_empresas.value.push({
                        "id":      ID_COMERCIO,
                        "empresa": oferta_.empresa,
                        "locales": [...(oferta_.locales || [])],
                    })
                    params_filtro.value.comercio[ID_COMERCIO] = true
                } else {
                    // mismo comercio en otra sucursal: se suman sus locales sin repetir
                    const emp = listado_empresas.value.find(e => e.id === ID_COMERCIO)
                    for (const l of (oferta_.locales || [])){
                        if (!emp.locales.some(x => JSON.stringify(x) === JSON.stringify(l))) emp.locales.push(l)
                    }
                }
                listado_por_comercio.value[ID_COMERCIO].ofertas.push(listado_promo_obtenido.value[i])
            }
            listado_empresas.value.sort( (a, b) => (a.empresa?.name > b.empresa?.name) ? 1 : -1 )
            comercios_filtrados.value = listado_empresas.value

            for (let i=0; i < listado_empresas.value.length; i++){
                listado_por_comercio.value[listado_empresas.value[i].id]?.ofertas.sort( (a, b) => (a.price > b.price) ? 1 : -1 )
            }

            ofertas_filtradas.value = JSON.parse(JSON.stringify(listado_por_comercio.value))
            cargando.value = false
        } else
            storeApp.loading = false
        cargando.value = false
    })
</script>

<style scoped>
.card-ofertas { height: 100%; }
.oferta-item {
  display: flex; align-items: center; gap: var(--gb-space-3);
  padding: .625rem var(--gb-space-4);
  border-bottom: 1px solid var(--gb-border);
  transition: background var(--gb-transition-fast);
}
.oferta-item:last-child { border-bottom: 0; }
.oferta-item:hover { background: var(--gb-surface-2); }
.oferta-item__name { flex: 1; min-width: 0; font-size: .875rem; color: var(--gb-text); }
.oferta-item__price { font-weight: 700; color: var(--gb-primary); white-space: nowrap; }
.pub-search--inline { max-width: none; box-shadow: var(--gb-shadow-sm); border: 1px solid var(--gb-border); }
</style>
