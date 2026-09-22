import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap"
import "bootstrap-icons/font/bootstrap-icons.css"

import "./assets/styles/layout.scss";
import "vue-table-editor/style.css";
import "@greenborn/vue-side-menu/style.css";

import { createApp, reactive } from "vue";
import { getRouterConRutas } from './utils/auth'
import { routerBeforeEach } from './utils/routes'
import { router } from "./router";

import Button from "./components/ui/Button.vue";
import InputText from "./components/ui/InputText.vue";
import InputPassword from "./components/ui/InputPassword.vue";
import Checkbox from "./components/ui/Checkbox.vue";
import MultiSelect from "./components/ui/MultiSelect.vue";
import RadioButton from "./components/ui/RadioButton.vue";
import DataTable from "./components/ui/DataTable.vue";
import Dialog from "./components/ui/Dialog.vue";
import Select from "./components/ui/Select.vue";
import AutoComplete from "./components/ui/AutoComplete.vue";
import Editor from "./components/ui/Editor.vue";
import DatePicker from "./components/ui/DatePicker.vue";
import Chart from "./components/ui/Chart.vue";

import { createPinia } from "pinia";
import { AppStore } from "./stores/app";
import App from './App.vue'

const app = createApp(App);
app.use(createPinia());

app.component("Button", Button);
app.component("InputText", InputText);
app.component("Checkbox", Checkbox);
app.component("InputPassword", InputPassword);
app.component("MultiSelect", MultiSelect);
app.component("RadioButton", RadioButton);
app.component("DataTable", DataTable);
app.component("Dialog", Dialog);
app.component("Select", Select);
app.component("AutoComplete", AutoComplete);
app.component("Editor", Editor);
app.component("DatePicker", DatePicker);
app.component("Chart", Chart);

async function init() {
  const storeApp = AppStore()
  storeApp.inic_modals()
  await getRouterConRutas(router, storeApp)
  routerBeforeEach(router, storeApp)
  app.use(router)
  await router.isReady()
  app.mount("#app")
}

init()