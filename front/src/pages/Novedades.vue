<template>
<PublicTopBar />

<main class="pub-main" id="novedades-cnt">
  <div class="pub-container pub-container--narrow">
    <PageHeader title="Novedades" icon="bi-megaphone" subtitle="Cambios y anuncios del sitio."
                :breadcrumbs="[{ label: 'Inicio', to: '/' }, { label: 'Novedades' }]" />

    <EmptyState v-if="novedades.length == 0" icon="bi-megaphone" title="Sin novedades por ahora"
                description="Cuando haya anuncios los vas a ver acá." />

    <ol v-else class="list-unstyled d-grid gap-3 mb-0">
      <li v-for="(novedad, i) in novedades" :key="i">
        <Card>
          <div class="d-flex gap-3">
            <span class="pub-quick__icon flex-none" aria-hidden="true"><Icon name="bi-bell" /></span>
            <div>
              <p class="small gb-text-muted mb-1 gb-num">{{ novedad.datetime }}</p>
              <p class="mb-0">{{ novedad.text }}</p>
            </div>
          </div>
        </Card>
      </li>
    </ol>
  </div>
</main>
<PublicFooter />
</template>

<script setup>
    import { ref, onMounted } from 'vue'
    import { public_news } from '../api/public/publicEndpoints'
    import { AppStore } from "../stores/app"
    import PublicTopBar from '../components/publico/PublicTopBar.vue';
    import PublicFooter from '../components/publico/PublicFooter.vue';

    const storeApp = AppStore()
  
    const novedades = ref([])

    onMounted(async ()=>{
        storeApp.loading = true
        let res = await public_news()
        if (res){
            storeApp.loading = false
            if (res?.error){
                storeApp.mostrar_alerta( "Ocurrio un error al cargar las novedades" )
                return false
            }
            novedades.value = res?.items
        } else
            storeApp.loading = false
    })
</script>
  
