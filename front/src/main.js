import "@fontsource/inter/400.css"
import "@fontsource/inter/500.css"
import "@fontsource/inter/600.css"
import "@fontsource/inter/700.css"
import "./assets/styles/_bootstrap-custom.scss"
import "bootstrap"
import "bootstrap-icons/font/bootstrap-icons.css"

import "./assets/styles/layout.scss";
import "@greenborn/vue-table-editor/style.css";
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
import Card from "./components/ui/Card.vue";
import Badge from "./components/ui/Badge.vue";
import EmptyState from "./components/ui/EmptyState.vue";
import Skeleton from "./components/ui/Skeleton.vue";
import PageHeader from "./components/ui/PageHeader.vue";
import StatCard from "./components/ui/StatCard.vue";
import Icon from "./components/ui/Icon.vue";

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
app.component("Card", Card);
app.component("Badge", Badge);
app.component("EmptyState", EmptyState);
app.component("Skeleton", Skeleton);
app.component("PageHeader", PageHeader);
app.component("StatCard", StatCard);
app.component("Icon", Icon);

async function init() {
  const storeApp = AppStore()
  await getRouterConRutas(router, storeApp)
  routerBeforeEach(router, storeApp)
  app.use(router)
  await router.isReady()
  app.mount("#app")
}

init()