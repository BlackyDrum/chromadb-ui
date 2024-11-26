<script setup>
import { onBeforeMount, ref } from "vue";

import axios from "axios";

import Toast from "primevue/toast";
import { useToast } from "primevue/usetoast";

import {
  Button,
  DataTable,
  Column,
  Dialog,
  InputText,
  FloatLabel,
  Textarea,
} from "primevue";

const toast = useToast();

const url = ref("http://localhost:8080");
const apiUrl = ref("");
const collectionBaseUrl = ref("");
const tenant = ref("default_database");
const database = ref("default_tenant");

const collections = ref([]);
const currentCollection = ref(null);
const currentCollectionData = ref(null);
const createCollectionData = ref({ name: null, metadata: null });

const connected = ref(false);
const isInitializingConnection = ref(false);
const isFetchingCollectionData = ref(false);
const isCreatingCollection = ref(false);

const showCreateCollectionForm = ref(false);

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
    .get(`${url.value}/api/v2`)
    .then((response) => {
      storeConnectionParameters(url.value, tenant.value, database.value);

      apiUrl.value = `${url.value}/api/v2`;

      initializeTenantAndDatabase();

      retrieveCollections();

      connected.value = true;
    })
    .catch((error) => {
      const errorMessage = getErrorMessage(error);

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

const handleDisconnect = () => {
  connected.value = false;
  collections.value = [];
  currentCollection.value = null;
  currentCollectionData.value = null;
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
    .get(`${apiUrl.value}/tenants/${tenant.value}/databases/${database.value}`)
    .catch(() => {
      axios.post(`${apiUrl.value}/tenants/${tenant.value}/databases`, {
        name: database.value,
      });
    });

  collectionBaseUrl.value = `${apiUrl.value}/tenants/${tenant.value}/databases/${database.value}/collections`;
};

const retrieveCollections = () => {
  axios.get(collectionBaseUrl.value).then((response) => {
    collections.value = response.data.sort((col1, col2) => {
      return col1.name <= col2.name ? -1 : 1;
    });
  });
};

const handleCollectionSelection = (collection) => {
  if (
    isFetchingCollectionData.value ||
    (currentCollection.value && currentCollection.value.id === collection.id)
  )
    return;

  currentCollection.value = collection;
  currentCollectionData.value = [];

  isFetchingCollectionData.value = true;

  axios
    .post(`${collectionBaseUrl.value}/${collection.id}/get`, {
      // Empty body to get all data for a collection
    })
    .then((response) => {
      const { ids, documents, metadatas } = response.data;

      ids.forEach((id, index) => {
        currentCollectionData.value.push({
          id,
          document: documents[index],
          metadata: metadatas[index],
        });
      });
    })
    .catch((error) => {
      const errorMessage = getErrorMessage(error);

      toast.add({
        severity: "error",
        summary: "Error",
        detail: `Error fetching collection data. Reason: ${errorMessage}`,
        life: 5000,
      });
    })
    .finally(() => {
      isFetchingCollectionData.value = false;
    });
};

const getErrorMessage = (error) => {
  return (
    error.response?.data?.message ||
    error.message ||
    "An unknown error occurred."
  );
};

const handleCreateCollectionButtonClick = () => {
  showCreateCollectionForm.value = true;
};

const handleCreateCollection = () => {
  if (!createCollectionData.value.name || isCreatingCollection.value) return;

  let metadata;
  try {
    metadata = createCollectionData.value.metadata
      ? JSON.parse(createCollectionData.value.metadata)
      : null;
  } catch (_) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: `Metadata must be valid JSON`,
      life: 5000,
    });

    return;
  }

  isCreatingCollection.value = true;

  axios
    .post(collectionBaseUrl.value, {
      name: createCollectionData.value.name,
      metadata: metadata,
    })
    .then((response) => {
      toast.add({
        severity: "success",
        summary: "Success",
        detail: `Collection ${createCollectionData.value.name} created`,
        life: 5000,
      });

      retrieveCollections();

      createCollectionData.value.name = null;
      createCollectionData.value.metadata = null;
    })
    .catch((error) => {
      const errorMessage = getErrorMessage(error);

      toast.add({
        severity: "error",
        summary: "Error",
        detail: `Error creating Collection. Reason: ${errorMessage}`,
        life: 8000,
      });
    })
    .finally(() => {
      isCreatingCollection.value = false;
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
      class="scroll-container fixed left-0 top-0 z-40 flex h-screen w-64 -translate-x-full flex-col border-r-2 border-gray-400 transition-transform sm:translate-x-0"
      aria-label="Sidebar"
    >
      <div class="ml-4 flex select-none px-3 py-4">
        <div>
          <img src="/chroma.png" class="w-12" alt="Logo" />
        </div>
        <div class="ml-4 self-center font-semibold">ChromaDB UI</div>
      </div>
      <div class="ml-4 flex select-none px-3 py-4">
        <Button
          class="w-full"
          label="Create Collection"
          icon="pi pi-plus"
          @click="handleCreateCollectionButtonClick"
        />
      </div>
      <div class="h-full overflow-y-auto bg-black px-3 py-2">
        <ul class="space-y-2 font-medium">
          <li v-for="collection in collections" :key="collection.id">
            <Button
              unstyled
              class="group flex w-full items-center rounded-lg p-2 text-white hover:bg-gray-900"
              :class="{
                'bg-gray-900':
                  currentCollection && currentCollection.id === collection.id,
              }"
              :disabled="isFetchingCollectionData"
              v-tooltip="{
                value: collection.name,
                showDelay: 500,
              }"
              @click="handleCollectionSelection(collection)"
            >
              <span class="ms-3 truncate">{{ collection.name }}</span>
              <i
                class="pi pi-spin pi-spinner ml-auto"
                v-if="
                  isFetchingCollectionData &&
                  currentCollection &&
                  currentCollection.id === collection.id
                "
              ></i>
            </Button>
          </li>
        </ul>
      </div>
      <div class="w-full px-3 py-4 text-center">
        <Button
          severity="info"
          class="w-full"
          label="Disconnect"
          icon="pi pi-sign-out"
          @click="handleDisconnect"
        />
      </div>
    </aside>

    <div class="p-4 sm:ml-64">
      <div class="rounded-lg p-4">
        <DataTable showGridlines :value="currentCollectionData">
          <template #empty>
            {{
              currentCollection
                ? "No entries for this collection"
                : "Please select a collection"
            }}
          </template>
          <Column field="id" header="ID" headerStyle="width: 10rem"></Column>
          <Column field="document" header="Document"></Column>
          <Column field="metadata" header="Metadata">
            <template #body="slotProps">
              {{ JSON.stringify(slotProps.data.metadata) }}
            </template>
          </Column>
          <Column header="Action" headerStyle="width: 10rem"></Column>
        </DataTable>
      </div>
    </div>
  </div>

  <Dialog
    class="w-[90%] lg:w-1/2"
    v-model:visible="showCreateCollectionForm"
    :draggable="false"
    modal
    header="Create Collection"
  >
    <div class="flex w-full flex-col gap-4">
      <FloatLabel variant="in" class="w-full">
        <InputText
          id="collection_name"
          class="w-full"
          v-model="createCollectionData.name"
          variant="filled"
        />
        <label for="collection_name">Name</label>
      </FloatLabel>
      <div class="w-full">
        <FloatLabel variant="in" class="w-full">
          <Textarea
            id="collection_metadata"
            class="w-full"
            placeholder='{"key": "value"}'
            v-model="createCollectionData.metadata"
            style="resize: none"
          />
          <label for="collection_metadata">Metadata (optional)</label>
        </FloatLabel>
      </div>
    </div>
    <div class="mt-6">
      <Button
        class="w-full"
        :icon="isCreatingCollection ? 'pi pi-spin pi-spinner' : ''"
        label="Create Collection"
        @click="handleCreateCollection"
      />
    </div>
  </Dialog>
</template>

<style>
.scroll-container {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.scroll-container:hover {
  scrollbar-color: #ffffff transparent;
}
</style>
