<template>
  <div>
    <div class="row g-1 mb-2">
      <div class="col">
        <InputText
          class="w-100"
          v-model="nuevo_alias"
          placeholder="Nuevo alias..."
          :disabled="guardando"
          @keyup.enter="crear" />
      </div>
      <div class="col-auto">
        <Button label="Agregar" icon="pi-plus" :disabled="guardando" @click="crear" />
      </div>
    </div>

    <div class="row g-1 mb-1">
      <div class="col">
        <InputText class="w-100" v-model="filtro" placeholder="Filtrar alias..." @input="on_filtro" />
      </div>
      <div class="col-auto">
        <Button icon="pi pi-refresh" severity="secondary" text @click="cargar" />
      </div>
    </div>

    <div class="alias-list">
      <div v-if="cargando" class="text-center p-2">
        <i class="pi pi-spinner pi-spin"></i>
      </div>
      <div v-else-if="aliases.length === 0" class="text-center p-2 text-muted">
        Sin alias asociados
      </div>
      <div
        v-for="a in aliases"
        :key="a.id"
        class="d-flex align-items-center justify-content-between border-bottom py-1 gap-2">
        <template v-if="editando_id === a.id">
          <InputText
            class="flex-grow-1"
            v-model="alias_edit"
            :disabled="guardando"
            @keyup.enter="guardar_edicion(a)"
            @keyup.esc="cancelar_edicion" />
          <div class="d-flex gap-1">
            <Button icon="pi pi-check" severity="success" text rounded size="small" :disabled="guardando" @click="guardar_edicion(a)" />
            <Button icon="pi pi-times" severity="secondary" text rounded size="small" :disabled="guardando" @click="cancelar_edicion" />
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
            <Button icon="pi pi-pencil" severity="warning" text rounded size="small" @click="editar(a)" />
            <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="confirmando_id = a.id" />
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
        category_id: categoria.id,
        search: filtro.value,
        pageSize: 100,
      })
      aliases.value = (res && res.stat && res.data?.rows) || []
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
      const res = await add_one({ category_id: categoria.id, alias })
      guardando.value = false
      if (res?.stat) {
        storeApp.mostrar_alerta('Alias creado correctamente')
        nuevo_alias.value = ''
        await cargar()
      } else {
        storeApp.mostrar_alerta(res?.text || 'Error al crear el alias')
      }
    } catch (e) {
      console.error(e)
      guardando.value = false
      storeApp.mostrar_alerta('Error al realizar petición')
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
      const res = await put_one({ id: a.id, category_id: categoria.id, alias })
      guardando.value = false
      if (res?.stat) {
        storeApp.mostrar_alerta('Alias actualizado correctamente')
        cancelar_edicion()
        await cargar()
      } else {
        storeApp.mostrar_alerta(res?.text || 'Error al actualizar el alias')
      }
    } catch (e) {
      console.error(e)
      guardando.value = false
      storeApp.mostrar_alerta('Error al realizar petición')
    }
  }

  async function eliminar(a) {
    guardando.value = true
    try {
      const res = await delete_one({ id: a.id })
      guardando.value = false
      if (res?.stat) {
        storeApp.mostrar_alerta('Alias eliminado correctamente')
        confirmando_id.value = null
        await cargar()
      } else {
        storeApp.mostrar_alerta(res?.text || 'Error al eliminar el alias')
      }
    } catch (e) {
      console.error(e)
      guardando.value = false
      storeApp.mostrar_alerta('Error al realizar petición')
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
