<template>
    <PublicTopBar />

    <main class="pub-main" id="calcula-trueque-cnt">
      <div class="pub-container">
        <PageHeader title="Calculadora de trueque" icon="bi-arrow-left-right"
                    subtitle="Elegí dos productos y descubrí cuántas unidades de uno equivalen al otro."
                    :breadcrumbs="[{ label: 'Inicio', to: '/' }, { label: 'Calculadora' }]" />

        <ol class="pub-steps" aria-label="Pasos">
            <li :class="elegidos[0] ? 'is-done' : 'is-active'">Producto 1</li>
            <li :class="elegidos[1] ? 'is-done' : (elegidos[0] ? 'is-active' : '')">Producto 2</li>
            <li :class="elegidos[0] && elegidos[1] ? 'is-active' : ''">Resultado</li>
        </ol>

        <div class="row g-4">
            <div class="col-12 col-md-6" v-for="idx in [0, 1]" :key="idx">
                <Card :title="'Producto ' + (idx + 1)" :icon="idx == 0 ? 'bi-1-circle' : 'bi-2-circle'" class="h-100">
                    <form class="pub-search pub-search--inline mb-3" role="search" @submit.prevent="buscar(idx)">
                        <Icon name="bi-search" class="pub-search__icon" />
                        <label :for="'termino' + idx" class="visually-hidden">Producto {{ idx + 1 }}</label>
                        <input :id="'termino' + idx" class="pub-search__input" v-model="terminos[idx]" type="search" placeholder="Por ej: Manzana">
                        <button class="btn btn-primary btn-sm" type="submit">Buscar</button>
                    </form>

                    <div v-if="elegidos[idx] !== undefined" class="elegido mb-3" role="status">
                        <Icon name="bi-check-circle-fill" class="text-primary" />
                        <div class="flex-grow-1 min-w-0">
                            <div class="fw-semibold gb-truncate">{{ elegidos[idx]?.products?.name }}</div>
                            <small class="gb-text-muted">{{ elegidos[idx]?.empresa?.name }}</small>
                        </div>
                        <b class="gb-num">$ {{ formatMoney(elegidos[idx]?.price) }}</b>
                    </div>

                    <EmptyState v-if="!resultados[idx]?.length" size="sm" icon="bi-search"
                                title="Buscá un producto" description="Los resultados aparecerán acá." />
                    <ul v-else class="list-unstyled mb-0 cont-results">
                        <li v-for="(precio, k) in resultados[idx]" :key="k">
                            <button type="button" class="opcion" :class="{ 'is-selected': elegidos[idx] === precio }"
                                    :aria-pressed="elegidos[idx] === precio ? 'true' : 'false'" @click="selecciona(idx, precio)">
                                <span class="flex-grow-1 min-w-0 text-start">
                                    <span class="d-block fw-semibold small">{{ precio?.products?.name }}</span>
                                    <small class="gb-text-muted">{{ precio?.empresa?.name }} · {{ formateaFecha(precio?.date_time) }}</small>
                                </span>
                                <b class="gb-num">$ {{ formatMoney(precio?.price) }}</b>
                            </button>
                        </li>
                    </ul>
                </Card>
            </div>
        </div>

        <Card title="Resultado" icon="bi-calculator" class="mt-4">
            <div v-if="elegidos[0] != undefined && elegidos[1] != undefined" class="resultado" aria-live="polite">
                <div class="resultado__lado">
                    <label for="cantidad1" class="small gb-text-muted">Cantidad</label>
                    <input id="cantidad1" class="form-control form-control-lg text-center gb-num" v-model="cantidad_prod1" type="number" min="1" placeholder="1" step="1">
                    <div class="small mt-1">{{ elegidos[0].products?.name }}</div>
                </div>
                <div class="resultado__eq" aria-hidden="true"><Icon name="bi-arrow-left-right" size="1.5rem" /></div>
                <div class="resultado__lado">
                    <span class="small gb-text-muted">equivale a</span>
                    <strong class="cont-cant gb-num">{{ formatMoney((cantidad_prod1*elegidos[0].price) / elegidos[1].price) }}</strong>
                    <div class="small mt-1">{{ elegidos[1].products?.name }}</div>
                </div>
            </div>
            <EmptyState v-else size="sm" icon="bi-calculator" title="Elegí los dos productos"
                        description="Seleccioná un precio en cada columna para ver la equivalencia." />
        </Card>
      </div>
    </main>
    <PublicFooter />
</template>

<script setup>
import { ref } from 'vue'
import PublicTopBar from "../components/publico/PublicTopBar.vue";
import PublicFooter from "../components/publico/PublicFooter.vue";
import { AppStore } from "../stores/app"

import { formatMoney, fechaDateToString } from '../helpers/formatter'
import { busqueda } from '../api/public/publicEndpoints'
const storeApp = AppStore()

const terminos = ref(["", ""])
const resultados = ref([ [], [] ])
const elegidos = ref([ undefined, undefined ])
const cantidad_prod1 = ref(1)

function selecciona( indice, item ){
    elegidos.value[indice] = item
}

async function buscar( indice ){
    if (terminos.value[indice] === '') {
        storeApp.mostrar_alerta( "Por favor, ingrese el nombre del producto." )
        return false
    }

    if (terminos.value[indice].length < 3) {
        storeApp.mostrar_alerta( "El nombre del producto debe tener al menos 3 caracteres." )
        return false
    }

    resultados.value[indice] = []
    storeApp.loading = true
    let res = await busqueda(terminos.value[indice]);
    if (res) {
        storeApp.loading = false
        if (res?.error){
            storeApp.mostrar_alerta( "Ocurrio un error, re-intente más tarde." )
            return false
        }

        resultados.value[indice] = res?.items ? res.items: [];
        return true
    } else {
        storeApp.loading = false
        return false
    }
}

function formateaFecha( fecha ){
    fecha = new Date(fecha)
    fecha.setHours(fecha.getHours() - 3)
    
    return fechaDateToString(fecha,"/")
}
</script>

<style scoped>
.cont-results { max-height: 18rem; overflow-y: auto; display: grid; gap: .375rem; }
.opcion {
  width: 100%; display: flex; align-items: center; gap: .75rem;
  padding: .5rem .75rem; border: 1px solid var(--gb-border); border-radius: var(--gb-radius-sm);
  background: var(--gb-surface); color: var(--gb-text);
  transition: border-color var(--gb-transition-fast), background var(--gb-transition-fast);
}
.opcion:hover { border-color: var(--gb-primary); }
.opcion:focus-visible { outline: 0; box-shadow: var(--gb-focus-ring); }
.opcion.is-selected { border-color: var(--gb-primary); background: var(--gb-primary-soft); }
.elegido { display: flex; align-items: center; gap: .75rem; padding: .75rem; border-radius: var(--gb-radius-sm);
  background: var(--gb-primary-soft); border: 1px solid var(--gb-primary-soft-2); }
.min-w-0 { min-width: 0; }
.resultado { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--gb-space-5); text-align: center; }
.resultado__lado { flex: 1 1 14rem; max-width: 20rem; display: flex; flex-direction: column; align-items: center; }
.resultado__eq { color: var(--gb-primary); }
.cont-cant { font-size: 2.25rem; font-weight: 700; color: var(--gb-heading); line-height: 1.2; }
.pub-search--inline { max-width: none; box-shadow: none; border: 1px solid var(--gb-border); }
</style>
