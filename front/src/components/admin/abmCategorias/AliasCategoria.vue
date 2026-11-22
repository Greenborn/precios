<template>
  <div>
    <div class="row g-1 mb-2">
      <div class="col">
        <InputText
          class="w-100"
          v-model="nuevo_alias"
          placeholder="Nuevo alias..."
          aria-label="Nuevo alias"
          :disabled="guardando"
          @keyup.enter="crear" />
      </div>
      <div class="col-auto">
        <Button label="Agregar" icon="pi-plus" :disabled="guardando" @click="crear" />
      </div>
    </div>

    <div class="row g-1 mb-1">
      <div class="col">
        <InputText class="w-100" v-model="filtro" placeholder="Filtrar alias..." aria-label="Filtrar alias" @input="on_filtro" />
      </div>
      <div class="col-auto">
        <Button icon="pi pi-refresh" severity="secondary" text ariaLabel="Recargar alias" @click="cargar" />
      </div>
    </div>

    <div class="alias-list">
      <div v-if="cargando" class="p-2">
        <Skeleton :lines="4" />
      </div>
      <EmptyState v-else-if="aliases.length === 0" size="sm" icon="bi-tags"
        title="Sin alias asociados" description="Agregá un alias con el campo de arriba." />
      <div
        v-for="a in aliases"
        :key="a.id"
        class="productos-item d-flex align-items-center justify-content-between py-1 px-2 gap-2">
        <template v-if="editando_id === a.id">
          <InputText
            class="flex-grow-1"
            v-model="alias_edit"
            aria-label="Editar alias"
            :disabled="guardando"
            @keyup.enter="guardar_edicion(a)"
            @keyup.esc="cancelar_edicion" />
          <div class="d-flex gap-1">
            <Button icon="pi pi-check" severity="success" text rounded size="small" :disabled="guardando" ariaLabel="Guardar alias" @click="guardar_edicion(a)" />
            <Button icon="pi pi-times" severity="secondary" text rounded size="small" :disabled="guardando" ariaLabel="Cancelar edición" @click="cancelar_edicion" />
          </div>
        </template>
        <template v-else-if="confirmando_id === a.id">
          <span class="text-danger">¿Eliminar "{{ a.alias }}"?</span>
          <div class="d-flex gap-1">
            <Button label="No" severity="secondary" text size="small" :disabled="guardando" @click="confirmando_id = null" />
            <Button label="Sí" severity="danger" size="small" :disabled="guardando" @click="eliminar(a)" />
          </div>
        </template>
        <template v-else>
          <span class="flex-grow-1">{{ a.alias }}</span>
          <div class="d-flex gap-1">
            <Button icon="pi pi-pencil" severity="warning" text rounded size="small" ariaLabel="Editar alias" @click="editar(a)" />
            <Button icon="pi pi-trash" severity="danger" text rounded size="small" ariaLabel="Eliminar alias" @click="confirmando_id = a.id" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { ref, onMounted } from 'vue'
  import { get_all, add_one, put_one, delete_one } from '@/api/admin/aliasCategorias'
  import { AppStore } from '@/stores/app'

  const props = defineProps(['parametros'])

  const storeApp = AppStore()
  const categoria = props.parametros.categoria

  const aliases = ref([])
  const filtro = ref('')
  const nuevo_alias = ref('')
  const cargando = ref(false)
  const guardando = ref(false)
  const editando_id = ref(null)
  const confirmando_id = ref(null)
  const alias_edit = ref('')

  async function cargar() {
    cargando.value = true
    try {
      const res = await get_all({
        filters: JSON.stringify({ category_id: { op: 'igual', valor: categoria.id } }),
        search: filtro.value,
        pageSize: 100,
      })
      aliases.value = res?.data?.rows || []
    } catch (e) {
      console.error(e)
      aliases.value = []
    }
    cargando.value = false
  }

  async function crear() {
    const alias = nuevo_alias.value.trim()
    if (!alias) {
      storeApp.mostrar_alerta('El alias es obligatorio')
      return
    }
    guardando.value = true
    try {
      await add_one({ category_id: categoria.id, alias })
      guardando.value = false
      storeApp.mostrar_alerta('Alias creado correctamente')
      nuevo_alias.value = ''
      await cargar()
    } catch (e) {
      console.error(e)
      guardando.value = false
      storeApp.mostrar_alerta(e.response?.data?.message || 'Error al crear el alias')
    }
  }

  function editar(a) {
    confirmando_id.value = null
    editando_id.value = a.id
    alias_edit.value = a.alias
  }

  function cancelar_edicion() {
    editando_id.value = null
    alias_edit.value = ''
  }

  async function guardar_edicion(a) {
    const alias = alias_edit.value.trim()
    if (!alias) {
      storeApp.mostrar_alerta('El alias es obligatorio')
      return
    }
    guardando.value = true
    try {
      await put_one(a.id, { category_id: categoria.id, alias })
      guardando.value = false
      storeApp.mostrar_alerta('Alias actualizado correctamente')
      cancelar_edicion()
      await cargar()
    } catch (e) {
      console.error(e)
      guardando.value = false
      storeApp.mostrar_alerta(e.response?.data?.message || 'Error al actualizar el alias')
    }
  }

  async function eliminar(a) {
    guardando.value = true
    try {
      await delete_one(a.id)
      guardando.value = false
      storeApp.mostrar_alerta('Alias eliminado correctamente')
      confirmando_id.value = null
      await cargar()
    } catch (e) {
      console.error(e)
      guardando.value = false
      storeApp.mostrar_alerta(e.response?.data?.message || 'Error al eliminar el alias')
    }
  }

  let timer_filtro = null
  function on_filtro() {
    clearTimeout(timer_filtro)
    timer_filtro = setTimeout(cargar, 400)
  }

  onMounted(() => {
    cargar()
  })
</script>

<style scoped>
  .alias-list {
    max-height: 50vh;
    overflow-y: auto;
  }
</style>
