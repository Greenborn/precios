<template>
  <div>
    <div class="row mb-2">
      <div class="col-12">
        <AutoComplete
          :modelValue="producto_sel"
          :search="buscar_productos"
          optionLabel="name"
          optionValue="id"
          placeholder="Buscar producto por nombre para agregar..."
          @update:modelValue="seleccionar_producto" />
      </div>
    </div>

    <div class="row mb-1">
      <div class="col-8">
        <InputText class="w-100" v-model="filtro" placeholder="Filtrar productos de la categoría..." aria-label="Filtrar productos de la categoría" @input="on_filtro" />
      </div>
      <div class="col-4 text-end">
        <Button icon="pi pi-refresh" severity="secondary" text ariaLabel="Recargar productos" @click="cargar" />
      </div>
    </div>

    <div class="productos-list">
      <div v-if="cargando" class="p-2">
        <Skeleton :lines="4" />
      </div>
      <EmptyState v-else-if="productos.length === 0" size="sm" icon="bi-box-seam"
        title="Sin productos asociados" description="Buscá un producto arriba para agregarlo a la categoría." />
      <div v-for="(p, i) in productos" :key="p.id" class="productos-item d-flex align-items-center justify-content-between py-1 px-2">
        <span>{{ p.name }}</span>
        <Button icon="pi pi-times" severity="danger" text rounded size="small" :ariaLabel="'Quitar ' + p.name" @click="quitar(p, i)" />
      </div>
    </div>
  </div>
</template>

<script setup>
  import { ref, onMounted } from 'vue'
  import { productos_categoria, productos_disponibles, add_producto, remove_producto } from '@/api/admin/categorias'
  import { AppStore } from '@/stores/app'

  const props = defineProps(['parametros'])

  const storeApp = AppStore()
  const productos = ref([])
  const filtro = ref('')
  const cargando = ref(false)

  async function cargar() {
    cargando.value = true
    try {
      const res = await productos_categoria({
        category_id: props.parametros.categoria.id,
        search: filtro.value,
        pageSize: 100,
      })
      productos.value = (res && res.stat && res.data?.rows) || []
    } catch (e) {
      console.error(e)
      productos.value = []
    }
    cargando.value = false
  }

  async function buscar_productos(q) {
    const res = await productos_disponibles({ search: q, limit: 20 })
    return (res && res.stat && res.data?.rows) || []
  }

  async function seleccionar_producto(product_id) {
    if (!product_id) return
    storeApp.loading = true
    try {
      const res = await add_producto({
        category_id: props.parametros.categoria.id,
        product_id,
      })
      storeApp.loading = false
      if (res?.stat) {
        storeApp.mostrar_alerta('Producto agregado a la categoría')
        if (props.parametros.guardado) props.parametros.guardado()
        filtro.value = ''
        await cargar()
      } else {
        storeApp.mostrar_alerta(res?.text || 'Error al agregar el producto')
      }
    } catch (e) {
      console.error(e)
      storeApp.loading = false
      storeApp.mostrar_alerta('Error al realizar petición')
    }
  }

  async function quitar(p, i) {
    storeApp.loading = true
    try {
      const res = await remove_producto({
        category_id: props.parametros.categoria.id,
        product_id: p.id,
      })
      storeApp.loading = false
      if (res?.stat) {
        storeApp.mostrar_alerta('Producto quitado de la categoría')
        if (props.parametros.guardado) props.parametros.guardado()
        productos.value.splice(i, 1)
      } else {
        storeApp.mostrar_alerta(res?.text || 'Error al quitar el producto')
      }
    } catch (e) {
      console.error(e)
      storeApp.loading = false
      storeApp.mostrar_alerta('Error al realizar petición')
    }
  }

  let timer_filtro = null
  onMounted(() => {
    cargar()
  })

  function on_filtro() {
    clearTimeout(timer_filtro)
    timer_filtro = setTimeout(cargar, 400)
  }
</script>

<style scoped>
  .productos-list {
    max-height: 50vh;
    overflow-y: auto;
  }
</style>
