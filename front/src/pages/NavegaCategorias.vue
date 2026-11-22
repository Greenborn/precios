<template>
    <PublicTopBar @filtrar_evnt="filtrar" />

    <main class="pub-main" id="categorias-cnt">
      <div class="pub-container">
        <nav aria-label="breadcrumb" class="mb-2">
            <ol class="cat-breadcrumbs">
                <li><router-link to="/">Inicio</router-link><Icon name="bi-chevron-right" class="cat-breadcrumbs__sep" /></li>
                <template v-for="bc in bread_crumbs" :key="bc.visible">
                    <li v-if="bc.visible <= fase" :aria-current="bc.visible == fase ? 'page' : null">
                        <a href="#/categorias" v-if="bc.visible < fase" @click.prevent="breadcrumb_click(bc)">{{ bc.label }}</a>
                        <span v-else>{{ bc.label }}</span>
                        <Icon v-if="bc.visible < fase" name="bi-chevron-right" class="cat-breadcrumbs__sep" />
                    </li>
                </template>
            </ol>
        </nav>

        <PageHeader :title="titulos[fase]" icon="bi-diagram-3"
                    :subtitle="fase < 2 ? 'Elegí una opción para seguir navegando.' : 'Últimos precios registrados por producto.'" />

        <div class="d-md-none mb-3">
            <label for="cat-filtro" class="visually-hidden">Filtrar</label>
            <input id="cat-filtro" type="search" class="form-control" placeholder="Filtrar…" :value="filtro"
                   @input="filtrar($event.target.value)">
        </div>

        <EmptyState v-if="menu_lst.length == 0" icon="bi-search" title="No hay resultados"
                    description="Probá con otro filtro o volvé al nivel anterior." />

        <div v-else-if="fase < 2" class="pub-grid pub-grid--4">
            <button v-for="cat in menu_lst" :key="cat.id ?? cat.nombre" type="button" class="pub-quick text-start category_btn"
                    @click="categoria_click(cat)">
                <span class="pub-quick__icon" aria-hidden="true"><Icon :name="fase == 0 ? 'bi-shop-window' : 'bi-tags'" /></span>
                <h2 class="pub-quick__title">{{ cat.nombre }}</h2>
                <span class="pub-quick__desc">Ver {{ fase == 0 ? 'categorías' : 'productos' }} <Icon name="bi-arrow-right" /></span>
            </button>
        </div>

        <div v-else class="pub-grid">
            <Card v-for="cat in menu_lst" :key="cat.id ?? cat.name" :title="cat.name" flush>
                <ul class="list-unstyled mb-0 cat-precios">
                    <li v-for="(precio, k) in cat.precios" :key="k" class="cat-precio">
                        <div>
                            <div class="fw-semibold">{{ precio?.branch?.enterprise?.name }}</div>
                            <small class="gb-text-muted"><Icon name="bi-clock" /> {{ formateaFecha(precio?.date_time) }}</small>
                        </div>
                        <span class="cat-precio__valor gb-num">${{ formatMoney(precio?.price) }}</span>
                    </li>
                    <li v-if="!cat.precios?.length" class="cat-precio gb-text-muted small">Sin precios registrados</li>
                </ul>
            </Card>
        </div>
      </div>
    </main>
    <PublicFooter />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { AppStore } from "../stores/app"
import PublicTopBar from "../components/publico/PublicTopBar.vue";
import PublicFooter from "../components/publico/PublicFooter.vue";
const titulos = ['Tipos de comercios', 'Categorías', 'Productos']

import { get_categorias, get_empresas_categoria, get_sub_categorias, get_categorias_empresa, get_productos } from '../api/public/publicEndpoints'
import { formatMoney, fechaDateToString } from '../helpers/formatter'
const storeApp = AppStore()

const bread_crumbs = ref([
    { label: 'Tipos de Comercios', label_bk: 'Tipos de Comercios', visible:0, tipo_cat: "category" },
    //{ label: 'Comercios', label_bk: 'Tipos de Comercios', visible:1, tipo_cat: "enterprice" },
    { label: 'Categorías', label_bk: 'Categorías',  visible:1, tipo_cat: "category_prod" },
    { label: 'Productos', label_bk: 'Productos',  visible:2, tipo_cat: "product" },
])
const fase = ref(0)

const listados = ref({
    "category": [],
    //"enterprice": [],
    "category_prod": [],
    "product": []
})
const tipo_categoria = ref("category")
const menu_lst = ref([])

const filtro = ref("")


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

function filtrar( termino_filtro ){
    filtro.value = termino_filtro
    filtrador()
}

function filtrador(){
    let aux = []

    for (let c=0; c < listados.value[tipo_categoria.value].length; c++){
        let producto = listados.value[tipo_categoria.value][c]
        let insertar    = false

        insertar = encontrado( String(producto.nombre).toLowerCase(), String(filtro.value).toLowerCase() )
        if (insertar) aux.push(producto)
    }
    
    menu_lst.value = aux
}

onMounted(async ()=>{
    storeApp.loading = true
    let res = await get_categorias()
    if (res){
        storeApp.loading = false
        if (!res.stat){
            storeApp.mostrar_alerta( "Ocurrió un error al cargar el listado de categorías" )
            return false
        }
        listados.value[tipo_categoria.value] = res?.items
        menu_lst.value = res?.items
    } else
        storeApp.loading = false
})

function breadcrumb_click( bc ){
    menu_lst.value       = listados.value[ bc.tipo_cat ]
    tipo_categoria.value = bc.tipo_cat
    fase.value           = bc.visible
    bc.label             = bc.label_bk
}

function formateaFecha( fecha ){
    fecha = new Date(fecha)
    fecha.setHours(fecha.getHours() - 3)
    
    return fechaDateToString(fecha,"/")
}


async function categoria_click( cat ){
    filtro.value = ""
    if (tipo_categoria.value == "category"){
        storeApp.loading = true
        let res = await get_sub_categorias( cat.id )
        if (res){
            storeApp.loading = false
            if (!res.stat){
                storeApp.mostrar_alerta( "Ocurrió un error al cargar el listado de comercios" )
                return false
            }
            let enterprise_lst = res?.items
            for ( let i = 0; i < enterprise_lst.length; i++ )
                enterprise_lst[i]['nombre'] = enterprise_lst[i]['category']['name']
            
            tipo_categoria.value = "category_prod"
            fase.value = 1
            
            bread_crumbs.value[fase.value-1].label = cat.nombre
            listados.value[tipo_categoria.value] = enterprise_lst
            menu_lst.value = enterprise_lst
        } else
            storeApp.loading = false
    } 
    /*
    else if (tipo_categoria.value == "enterprice"){
        storeApp.loading = true
        let res = await get_categorias_empresa( cat?.enterprice?.id )
        if (res){
            storeApp.loading = false
            if (!res.stat){
                storeApp.mostrar_alerta( "Ocurrió un error al cargar el listado de comercios" )
                return false
            }
            let enter_cat_lst = res?.items
            for ( let i = 0; i < enter_cat_lst.length; i++ )
                enter_cat_lst[i]['nombre'] = enter_cat_lst[i]['category']['name']
            
            tipo_categoria.value = "category_prod"
            fase.value = 2
            menu_lst.value = enter_cat_lst
            bread_crumbs.value[fase.value-1].label = cat.nombre
            listados.value[tipo_categoria.value] = enter_cat_lst
        } else
            storeApp.loading = false
    } */

    else if (tipo_categoria.value == "category_prod"){
        storeApp.loading = true
        let res = await get_productos( cat?.category?.id )
        if (res){
            storeApp.loading = false
            if (!res.stat){
                storeApp.mostrar_alerta( "Ocurrió un error al cargar el listado de comercios" )
                return false
            }
            let products_lst = []
            
            let keys = Object.keys(res?.items)
            for (let i=0; i < keys.length; i++){
                let item = res?.items[keys[i]]
                item["nombre"] = item["name"]
                products_lst.push(item)
            }

            tipo_categoria.value = "product"
            fase.value = 2
            menu_lst.value = products_lst
            bread_crumbs.value[fase.value-1].label = cat.nombre
            listados.value[tipo_categoria.value] = products_lst
        } else
            storeApp.loading = false
    }
}

</script>

<style scoped>
.category_btn { cursor: pointer; user-select: none; width: 100%; }
.cat-breadcrumbs { list-style: none; display: flex; flex-wrap: wrap; gap: .25rem; padding: 0; margin: 0; font-size: .875rem; }
.cat-breadcrumbs li { display: inline-flex; align-items: center; gap: .25rem; color: var(--gb-text-muted); }
.cat-breadcrumbs a { color: var(--gb-primary); text-decoration: none; }
.cat-breadcrumbs a:hover { text-decoration: underline; }
.cat-breadcrumbs [aria-current] span { color: var(--gb-heading); font-weight: 600; }
.cat-breadcrumbs__sep { font-size: .7rem; }
.cat-precios { max-height: 18rem; overflow-y: auto; }
.cat-precio { display: flex; justify-content: space-between; align-items: center; gap: .75rem;
  padding: .625rem var(--gb-space-4); border-bottom: 1px solid var(--gb-border); }
.cat-precio:last-child { border-bottom: 0; }
.cat-precio__valor { font-weight: 700; color: var(--gb-primary); white-space: nowrap; }
</style>
