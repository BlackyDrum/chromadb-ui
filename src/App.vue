<script setup>
import { onBeforeMount, ref } from "vue";

import axios from "axios";

import Toast from "primevue/toast";
import { useToast } from "primevue/usetoast";

import { Button, DataTable, Column } from "primevue";

const toast = useToast();

const url = ref("http://localhost:8080");
const apiUrl = ref("");
const tenant = ref("default_database");
const database = ref("default_tenant");

const connected = ref(false);
const isInitializingConnection = ref(false);

onBeforeMount(() => {
  retrieveConnectionParameters();
});

const handleConnectionInitialization = () => {
  if (!url.value || !tenant.value || !database.value) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Please provide the URL, tenant, and database values",
      life: 5000,
    });

    return;
  }

  if (!isValidURL(url.value)) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Invalid URL provided",
      life: 5000,
    });

    return;
  }

  isInitializingConnection.value = true;

  axios
    .get(`${url.value}/api/v1`)
    .then((response) => {
      storeConnectionParameters(url.value, tenant.value, database.value);

      apiUrl.value = `${url.value}/api/v1`;

      initializeTenantAndDatabase();

      connected.value = true;
    })
    .catch((error) => {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "An unknown error occurred.";

      toast.add({
        severity: "error",
        summary: "Error",
        detail: `Unable to connect to the server. Reason: ${errorMessage}`,
        life: 5000,
      });
    })
    .finally(() => {
      isInitializingConnection.value = false;
    });
};

const isValidURL = (str) => {
  let url;

  try {
    url = new URL(str);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
};

const storeConnectionParameters = (url, tenant, database) => {
  const connection = {
    stored_url: url,
    stored_tenant: tenant,
    stored_database: database,
  };

  localStorage.setItem("connection", JSON.stringify(connection));
};

const retrieveConnectionParameters = () => {
  const connection = localStorage.getItem("connection") ?? null;

  if (connection) {
    const { stored_url, stored_tenant, stored_database } =
      JSON.parse(connection);

    url.value = stored_url;
    tenant.value = stored_tenant;
    database.value = stored_database;
  }
};

const initializeTenantAndDatabase = () => {
  axios.get(`${apiUrl.value}/tenants/${tenant.value}`).catch(() => {
    axios.post(`${apiUrl.value}/tenants`, {
      name: tenant.value,
    });
  });

  axios
    .get(`${apiUrl.value}/databases/${database.value}?tenant=${tenant.value}`)
    .catch(() => {
      axios.post(`${apiUrl.value}/databases?tenant=${tenant.value}`, {
        name: database.value,
      });
    });
};
</script>

<template>
  <Toast />

  <div
    class="flex min-h-screen flex-col items-center bg-black pt-16 text-white sm:justify-center sm:pt-0"
    v-if="!connected"
  >
    <div class="relative mt-12 w-full max-w-lg sm:mt-10">
      <div
        class="relative -mb-px h-px w-full bg-gradient-to-r from-transparent via-sky-300 to-transparent"
      ></div>
      <div
        class="mx-5 rounded-lg border border-white/20 border-b-white/20 border-l-white/20 border-r-white/20 shadow-[20px_0_20px_20px] shadow-slate-500/10 sm:border-t-white/20 sm:shadow-sm lg:rounded-xl lg:shadow-none dark:border-b-white/50 dark:border-t-white/50 dark:shadow-white/20"
      >
        <div class="flex flex-col p-6">
          <h3 class="text-xl font-semibold leading-6 tracking-tighter">
            Connect to ChromaDB
          </h3>
        </div>
        <div class="p-6 pt-0">
          <form @submit.prevent="handleConnectionInitialization">
            <div>
              <div>
                <div
                  class="group relative rounded-lg border px-3 pb-1.5 pt-2.5 duration-200 focus-within:border-sky-200 focus-within:ring focus-within:ring-sky-300/30"
                >
                  <div class="flex justify-between">
                    <label
                      class="text-muted-foreground select-none text-xs font-medium text-gray-400 group-focus-within:text-white"
                      >URL <span class="text-red-500">*</span></label
                    >
                  </div>
                  <input
                    type="text"
                    name="url"
                    autocomplete="off"
                    class="file:bg-accent placeholder:text-muted-foreground/90 text-foreground block w-full border-0 bg-transparent p-0 text-sm file:my-1 file:rounded-full file:border-0 file:px-4 file:py-2 file:font-medium focus:outline-none focus:ring-0 sm:leading-7"
                    v-model="url"
                    :disabled="isInitializingConnection"
                  />
                </div>
              </div>
            </div>
            <div class="mt-4">
              <div>
                <div
                  class="group relative rounded-lg border px-3 pb-1.5 pt-2.5 duration-200 focus-within:border-sky-200 focus-within:ring focus-within:ring-sky-300/30"
                >
                  <div class="flex justify-between">
                    <label
                      class="text-muted-foreground select-none text-xs font-medium text-gray-400 group-focus-within:text-white"
                      >Tenant <span class="text-red-500">*</span></label
                    >
                  </div>
                  <div class="flex items-center">
                    <input
                      type="text"
                      name="tenant"
                      class="placeholder:text-muted-foreground/90 text-foreground block w-full border-0 bg-transparent p-0 text-sm file:my-1 focus:outline-none focus:ring-0 focus:ring-teal-500 sm:leading-7"
                      v-model="tenant"
                      :disabled="isInitializingConnection"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-4">
              <div>
                <div
                  class="group relative rounded-lg border px-3 pb-1.5 pt-2.5 duration-200 focus-within:border-sky-200 focus-within:ring focus-within:ring-sky-300/30"
                >
                  <div class="flex justify-between">
                    <label
                      class="text-muted-foreground select-none text-xs font-medium text-gray-400 group-focus-within:text-white"
                      >Database <span class="text-red-500">*</span></label
                    >
                  </div>
                  <div class="flex items-center">
                    <input
                      type="text"
                      name="database"
                      class="placeholder:text-muted-foreground/90 text-foreground block w-full border-0 bg-transparent p-0 text-sm file:my-1 focus:outline-none focus:ring-0 focus:ring-teal-500 sm:leading-7"
                      v-model="database"
                      :disabled="isInitializingConnection"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-4 flex w-full items-center justify-end gap-x-2">
              <Button
                unstyled
                class="relative inline-flex h-10 w-full items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-black transition duration-300 hover:bg-black hover:text-white hover:ring hover:ring-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                type="submit"
                :disabled="isInitializingConnection"
              >
                Connect
                <i
                  v-if="isInitializingConnection"
                  class="pi pi-spin pi-spinner absolute right-0 mr-4"
                ></i>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
  <div class="min-h-screen bg-black" v-else>
    <Button
      unstyled
      data-drawer-target="default-sidebar"
      data-drawer-toggle="default-sidebar"
      aria-controls="default-sidebar"
      type="button"
      class="ms-3 mt-2 inline-flex items-center rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 sm:hidden dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
    >
      <span class="sr-only">Open sidebar</span>
      <svg
        class="h-6 w-6"
        aria-hidden="true"
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          clip-rule="evenodd"
          fill-rule="evenodd"
          d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z"
        ></path>
      </svg>
    </Button>
    <aside
      id="default-sidebar"
      class="fixed left-0 top-0 z-40 h-screen w-64 -translate-x-full transition-transform sm:translate-x-0"
      aria-label="Sidebar"
    >
      <div
        class="h-full overflow-y-auto border-r-2 border-gray-400 bg-black px-3 py-4"
      >
        <ul class="space-y-2 font-medium">
          <li>
            <a
              href="#"
              class="group flex items-center rounded-lg p-2 text-white hover:bg-gray-900"
            >
              <span class="ms-3">Dashboard</span>
            </a>
          </li>
        </ul>
      </div>
    </aside>

    <div class="p-4 sm:ml-64">
      <div class="rounded-lg border-2 border-gray-400 p-4">
        <DataTable>
          <Column field="id" header="ID"></Column>
          <Column field="document" header="Document"></Column>
          <Column field="metadata" header="Metadata"></Column>
        </DataTable>
      </div>
    </div>
  </div>
</template>
