<script setup>
import { computed, onBeforeMount, ref } from "vue";

import axios from "axios";

import Toast from "primevue/toast";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { FilterMatchMode } from "@primevue/core/api";
import {
  DataTable,
  Column,
  Dialog,
  OverlayPanel,
  ConfirmDialog,
} from "primevue";

const toast = useToast();
const confirm = useConfirm();

const filters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
});

const url = ref("http://localhost:8080");
const apiUrl = ref("");
const collectionBaseUrl = ref("");
const tenant = ref("default_tenant");
const database = ref("default_database");
const version = ref("");

const collections = ref([]);
const currentCollection = ref(null);
const currentCollectionData = ref([]);
const createCollectionData = ref({ name: null, metadata: null });
const editCollectionData = ref({ name: null, metadata: null });
const selectedCollection = ref(null);

const collectionOverlayPanel = ref();
const embeddingDataTable = ref();

const connected = ref(false);
const isInitializingConnection = ref(false);
const isFetchingCollectionData = ref(false);
const isCreatingCollection = ref(false);
const isDeletingCollection = ref(false);
const isEditingCollection = ref(false);

const showCreateCollectionForm = ref(false);
const showEditCollectionForm = ref(false);
const mobileSidebarOpen = ref(false);
const collectionSearch = ref("");

const entryHighlights = [
  {
    label: "Inline edits",
    value: "Documents and metadata",
    description:
      "Update embeddings directly inside the table and sync changes back to Chroma.",
  },
  {
    label: "Saved context",
    value: "Remembers your last workspace",
    description:
      "Server, tenant, and database settings are restored locally for the next session.",
  },
  {
    label: "Fast exports",
    value: "CSV on demand",
    description:
      "Pull your current table view into downstream analysis without leaving the app.",
  },
];

onBeforeMount(() => {
  retrieveConnectionParameters();
});

const safeStringify = (value, pretty = false) => {
  if (value === null || value === undefined) return "null";

  try {
    return JSON.stringify(value, null, pretty ? 2 : 0);
  } catch (_) {
    return String(value);
  }
};

const formatNumber = (value) => new Intl.NumberFormat().format(value ?? 0);

const getCollectionInitial = (name) =>
  (name?.trim()?.charAt(0) ?? "C").toUpperCase();

const getCollectionMetadataLabel = (collection) => {
  const metadata = collection?.metadata;

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "No metadata";
  }

  const metadataCount = Object.keys(metadata).length;
  return metadataCount === 1
    ? "1 metadata key"
    : `${metadataCount} metadata keys`;
};

const activeEndpoint = computed(() => {
  try {
    return new URL(url.value).host;
  } catch (_) {
    return url.value.replace(/^https?:\/\//, "") || "localhost:8080";
  }
});

const filteredCollections = computed(() => {
  const searchValue = collectionSearch.value.trim().toLowerCase();

  if (!searchValue) return collections.value;

  return collections.value.filter((collection) => {
    return (
      collection.name.toLowerCase().includes(searchValue) ||
      safeStringify(collection.metadata).toLowerCase().includes(searchValue)
    );
  });
});

const workspaceTitle = computed(
  () => currentCollection.value?.name ?? "Choose a collection",
);

const workspaceSubtitle = computed(() => {
  if (!currentCollection.value) {
    return "Pick a collection from the left rail to inspect embeddings, clean up metadata, and export rows without leaving the workspace.";
  }

  return `${formatNumber(currentCollectionData.value.length)} embeddings loaded for live editing in ${currentCollection.value.name}.`;
});

const activeCollectionMetadataLabel = computed(() => {
  return getCollectionMetadataLabel(currentCollection.value);
});

const collectionMetadataPreview = computed(() => {
  if (!currentCollection.value) {
    return "Select a collection to inspect its metadata and review the records it contains.";
  }

  if (!currentCollection.value.metadata) {
    return "This collection does not have metadata attached yet.";
  }

  return safeStringify(currentCollection.value.metadata, true);
});

const dashboardMetrics = computed(() => {
  return [
    {
      label: "Collections",
      value: formatNumber(collections.value.length),
      description: "All namespaces currently available in this workspace.",
    },
    {
      label: "Embeddings",
      value: formatNumber(currentCollectionData.value.length),
      description: currentCollection.value
        ? "Rows loaded from the selected collection."
        : "Select a collection to load its documents and metadata.",
    },
    {
      label: "Version",
      value: version.value || "Pending",
      description: "Detected from the live Chroma instance after connection.",
    },
    {
      label: "Connection",
      value: connected.value ? "Online" : "Offline",
      description: `${tenant.value} / ${database.value}`,
    },
  ];
});

const connectionFacts = computed(() => {
  return [
    {
      label: "Collection ID",
      value: currentCollection.value?.id ?? "Awaiting selection",
    },
    { label: "Endpoint", value: url.value },
    { label: "Tenant", value: tenant.value },
    { label: "Database", value: database.value },
  ];
});

const isValidURL = (value) => {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch (_) {
    return false;
  }
};

const getErrorMessage = (error) => {
  return (
    error.response?.data?.message ||
    error.message ||
    "An unknown error occurred."
  );
};

const storeConnectionParameters = (
  connectionUrl,
  connectionTenant,
  connectionDatabase,
) => {
  localStorage.setItem(
    "connection",
    JSON.stringify({
      stored_url: connectionUrl,
      stored_tenant: connectionTenant,
      stored_database: connectionDatabase,
    }),
  );
};

const retrieveConnectionParameters = () => {
  const storedConnection = localStorage.getItem("connection");
  if (!storedConnection) return;

  const { stored_url, stored_tenant, stored_database } =
    JSON.parse(storedConnection);
  url.value = stored_url;
  tenant.value = stored_tenant;
  database.value = stored_database;
};

const initializeTenantAndDatabase = async () => {
  await Promise.all([
    axios
      .get(`${apiUrl.value}/tenants/${tenant.value}`)
      .catch(() =>
        axios.post(`${apiUrl.value}/tenants`, { name: tenant.value }),
      ),
    axios
      .get(
        `${apiUrl.value}/tenants/${tenant.value}/databases/${database.value}`,
      )
      .catch(() =>
        axios.post(`${apiUrl.value}/tenants/${tenant.value}/databases`, {
          name: database.value,
        }),
      ),
  ]);

  collectionBaseUrl.value = `${apiUrl.value}/tenants/${tenant.value}/databases/${database.value}/collections`;
};

const retrieveCollections = async () => {
  try {
    const response = await axios.get(collectionBaseUrl.value);

    collections.value = response.data.sort((collectionOne, collectionTwo) => {
      return collectionOne.name <= collectionTwo.name ? -1 : 1;
    });

    if (!currentCollection.value) return;

    const refreshedCurrentCollection = collections.value.find(
      (collection) => collection.id === currentCollection.value.id,
    );

    currentCollection.value = refreshedCurrentCollection ?? null;

    if (!refreshedCurrentCollection) {
      currentCollectionData.value = [];
    }
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: `Unable to retrieve collections. Reason: ${getErrorMessage(error)}`,
      life: 5000,
    });
  }
};

const handleConnectionInitialization = async () => {
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

  try {
    await axios.get(`${url.value}/api/v2`);
    storeConnectionParameters(url.value, tenant.value, database.value);
    apiUrl.value = `${url.value}/api/v2`;

    await initializeTenantAndDatabase();
    await retrieveCollections();

    try {
      const versionResponse = await axios.get(`${apiUrl.value}/version`);
      version.value = versionResponse.data;
    } catch (_) {
      version.value = "Unavailable";
    }

    connected.value = true;
    mobileSidebarOpen.value = false;
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: `Unable to connect to the server. Reason: ${getErrorMessage(error)}`,
      life: 5000,
    });
  } finally {
    isInitializingConnection.value = false;
  }
};

const handleDisconnect = () => {
  connected.value = false;
  collections.value = [];
  currentCollection.value = null;
  currentCollectionData.value = [];
  filters.value.global.value = null;
  collectionSearch.value = "";
  mobileSidebarOpen.value = false;
};

const update = async () => {
  await retrieveCollections();

  if (currentCollection.value) {
    await handleCollectionSelection(currentCollection.value, true);
  }
};

const handleCollectionSelection = async (collection, isUpdating = false) => {
  if (
    isFetchingCollectionData.value ||
    (currentCollection.value &&
      currentCollection.value.id === collection.id &&
      !isUpdating)
  ) {
    return;
  }

  currentCollection.value = collection;
  currentCollectionData.value = [];
  mobileSidebarOpen.value = false;
  isFetchingCollectionData.value = true;

  try {
    const response = await axios.post(
      `${collectionBaseUrl.value}/${collection.id}/get`,
      {},
    );
    const { ids = [], documents = [], metadatas = [] } = response.data;

    currentCollectionData.value = ids.map((id, index) => ({
      id,
      document: documents[index] ?? "",
      metadata: safeStringify(metadatas[index]),
    }));
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: `Error fetching collection data. Reason: ${getErrorMessage(error)}`,
      life: 5000,
    });
  } finally {
    isFetchingCollectionData.value = false;
  }
};

const handleCreateCollectionButtonClick = () => {
  createCollectionData.value = { name: null, metadata: null };
  showCreateCollectionForm.value = true;
};

const handleCreateCollection = async () => {
  if (!createCollectionData.value.name || isCreatingCollection.value) return;

  let metadata = null;

  try {
    metadata = createCollectionData.value.metadata
      ? JSON.parse(createCollectionData.value.metadata)
      : null;
  } catch (_) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Metadata must be valid JSON",
      life: 5000,
    });
    return;
  }

  isCreatingCollection.value = true;
  const createdCollectionName = createCollectionData.value.name;

  try {
    await axios.post(collectionBaseUrl.value, {
      name: createCollectionData.value.name,
      metadata,
    });

    toast.add({
      severity: "success",
      summary: "Success",
      detail: `Collection ${createdCollectionName} created`,
      life: 5000,
    });

    await retrieveCollections();

    createCollectionData.value = { name: null, metadata: null };
    showCreateCollectionForm.value = false;

    const createdCollection = collections.value.find(
      (collection) => collection.name === createdCollectionName,
    );

    if (createdCollection) {
      await handleCollectionSelection(createdCollection, true);
    }
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: `Error creating collection. Reason: ${getErrorMessage(error)}`,
      life: 8000,
    });
  } finally {
    isCreatingCollection.value = false;
  }
};

const toggleCollectionOverlayPanel = (event, collection) => {
  if (isDeletingCollection.value) return;

  selectedCollection.value = JSON.parse(JSON.stringify(collection));
  collectionOverlayPanel.value.toggle(event);
};

const handleCollectionDeletion = () => {
  if (isDeletingCollection.value) return;

  collectionOverlayPanel.value.visible = false;

  confirm.require({
    message: `This will delete '${selectedCollection.value.name}'`,
    header: "Delete collection?",
    icon: "pi pi-info-circle",
    rejectLabel: "Cancel",
    acceptLabel: "Delete",
    rejectClass: "p-button-secondary p-button-outlined",
    acceptClass: "p-button-danger",
    acceptIcon: "pi pi-trash",
    accept: async () => {
      isDeletingCollection.value = true;

      try {
        await axios.delete(
          `${collectionBaseUrl.value}/${selectedCollection.value.name}`,
        );

        if (selectedCollection.value.id === currentCollection.value?.id) {
          currentCollection.value = null;
          currentCollectionData.value = [];
        }

        const collectionIndex = collections.value.findIndex(
          (collection) => collection.id === selectedCollection.value.id,
        );

        if (collectionIndex !== -1) {
          collections.value.splice(collectionIndex, 1);
        }
      } catch (error) {
        toast.add({
          severity: "error",
          summary: "Error",
          detail: `Unable to delete collection. Reason: ${getErrorMessage(error)}`,
          life: 5000,
        });
      } finally {
        selectedCollection.value = null;
        isDeletingCollection.value = false;
      }
    },
    reject: () => {
      selectedCollection.value = null;
      isDeletingCollection.value = false;
    },
    onHide: () => {
      selectedCollection.value = null;
      isDeletingCollection.value = false;
    },
  });
};

const handleCollectionEdit = () => {
  showEditCollectionForm.value = true;
  collectionOverlayPanel.value.visible = false;
  editCollectionData.value.name = selectedCollection.value.name;
  editCollectionData.value.metadata =
    selectedCollection.value.metadata === null
      ? null
      : JSON.stringify(selectedCollection.value.metadata, null, 2);
};

const handleEditCollection = async () => {
  if (isEditingCollection.value) return;

  let metadata = null;

  try {
    metadata = editCollectionData.value.metadata
      ? JSON.parse(editCollectionData.value.metadata)
      : null;
  } catch (_) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Metadata must be valid JSON",
      life: 5000,
    });
    return;
  }

  isEditingCollection.value = true;

  try {
    await axios.put(
      `${collectionBaseUrl.value}/${selectedCollection.value.id}`,
      {
        new_name: editCollectionData.value.name,
        new_metadata: metadata,
      },
    );

    const collectionIndex = collections.value.findIndex(
      (collection) => collection.id === selectedCollection.value.id,
    );

    if (collectionIndex !== -1) {
      collections.value[collectionIndex].name = editCollectionData.value.name;
      collections.value[collectionIndex].metadata = metadata;
    }

    toast.add({
      severity: "success",
      summary: "Success",
      detail: "Collection updated",
      life: 5000,
    });

    showEditCollectionForm.value = false;
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: `Unable to edit collection. Reason: ${getErrorMessage(error)}`,
      life: 5000,
    });
  } finally {
    isEditingCollection.value = false;
  }
};

const onEmbeddingCellEditComplete = async (event) => {
  const embedding = currentCollectionData.value.find(
    (item) => item.id === event.data.id,
  );
  if (!embedding) return;

  const oldDocument = embedding.document;
  const oldMetadata = embedding.metadata;

  if (event.field === "document" && oldDocument === event.newValue) return;
  if (event.field === "metadata" && oldMetadata === event.newValue) return;

  if (event.field === "document") {
    embedding.document = event.newValue;
  } else if (event.field === "metadata") {
    try {
      JSON.parse(event.newValue);
    } catch (_) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "Metadata must be valid JSON",
        life: 5000,
      });
      return;
    }

    embedding.metadata = event.newValue;
  }

  try {
    await axios.post(
      `${collectionBaseUrl.value}/${currentCollection.value.id}/update`,
      {
        documents: [embedding.document],
        ids: [embedding.id],
        metadatas: [JSON.parse(embedding.metadata)],
      },
    );
  } catch (error) {
    embedding.document = oldDocument;
    embedding.metadata = oldMetadata;

    toast.add({
      severity: "error",
      summary: "Error",
      detail: `Unable to edit embedding. Reason: ${getErrorMessage(error)}`,
      life: 5000,
    });
  }
};

const deleteEmbedding = async (id) => {
  try {
    await axios.post(
      `${collectionBaseUrl.value}/${currentCollection.value.id}/delete`,
      {
        ids: [id],
      },
    );

    const embeddingIndex = currentCollectionData.value.findIndex(
      (embedding) => embedding.id === id,
    );

    if (embeddingIndex !== -1) {
      currentCollectionData.value.splice(embeddingIndex, 1);
    }
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: `Unable to delete embedding. Reason: ${getErrorMessage(error)}`,
      life: 5000,
    });
  }
};

const exportCSV = () => {
  embeddingDataTable.value?.exportCSV();
};
</script>

<template>
  <Toast />
  <ConfirmDialog />

  <div v-if="!connected" class="entry-view">
    <div class="backdrop-orb backdrop-orb--mint"></div>
    <div class="backdrop-orb backdrop-orb--amber"></div>
    <div class="backdrop-grid"></div>

    <section class="entry-layout">
      <div class="hero-copy">
        <div class="brand-pill">
          <img src="/chroma.png" alt="ChromaDB logo" />
          <span>ChromaDB UI</span>
        </div>

        <p class="section-kicker">Vector database cockpit</p>
        <p class="text-4xl font-bold">
          Give your Chroma workspace a cleaner, sharper control room.
        </p>
        <p class="hero-copy__text">
          Browse collections, inspect metadata, edit embeddings inline, and
          export the view you need without feeling stuck in a bare-bones admin
          screen.
        </p>

        <div class="hero-highlight-grid">
          <article
            v-for="highlight in entryHighlights"
            :key="highlight.label"
            class="hero-highlight glass-panel"
          >
            <p class="section-kicker">{{ highlight.label }}</p>
            <h2>{{ highlight.value }}</h2>
            <p>{{ highlight.description }}</p>
          </article>
        </div>
      </div>

      <div class="connect-card glass-panel">
        <div class="connect-card__header">
          <div>
            <p class="section-kicker">Connection</p>
            <h2>Launch your workspace</h2>
            <p>
              Saved values are prefilled from your last session so you can
              reconnect quickly.
            </p>
          </div>

          <div class="status-chip">
            <span class="status-dot status-dot--warm"></span>
            Ready to connect
          </div>
        </div>

        <form
          class="connect-form"
          @submit.prevent="handleConnectionInitialization"
        >
          <label class="field">
            <span class="field__label">Server URL</span>
            <span class="field__hint"
              >HTTP or HTTPS endpoint for the Chroma API.</span
            >
            <input
              v-model="url"
              type="text"
              name="url"
              autocomplete="off"
              :disabled="isInitializingConnection"
              placeholder="http://localhost:8080"
            />
          </label>

          <label class="field">
            <span class="field__label">Tenant</span>
            <span class="field__hint"
              >Workspace tenant to connect or create.</span
            >
            <input
              v-model="tenant"
              type="text"
              name="tenant"
              :disabled="isInitializingConnection"
              placeholder="default_tenant"
            />
          </label>

          <label class="field">
            <span class="field__label">Database</span>
            <span class="field__hint"
              >Database inside the selected tenant.</span
            >
            <input
              v-model="database"
              type="text"
              name="database"
              :disabled="isInitializingConnection"
              placeholder="default_database"
            />
          </label>

          <div class="connect-card__footer">
            <div class="connect-preview">
              <span>Endpoint preview</span>
              <strong>{{ activeEndpoint }}</strong>
            </div>

            <button
              class="ui-button ui-button--primary"
              type="submit"
              :disabled="isInitializingConnection"
            >
              <span>Connect to Chroma</span>
              <i
                :class="
                  isInitializingConnection
                    ? 'pi pi-spin pi-spinner'
                    : 'pi pi-arrow-right'
                "
              ></i>
            </button>
          </div>
        </form>
      </div>
    </section>
  </div>

  <div v-else class="workspace-view">
    <div class="backdrop-orb backdrop-orb--mint"></div>
    <div class="backdrop-orb backdrop-orb--amber"></div>
    <div class="backdrop-grid"></div>

    <div
      v-if="mobileSidebarOpen"
      class="sidebar-backdrop"
      @click="mobileSidebarOpen = false"
    ></div>

    <aside
      class="workspace-sidebar glass-panel"
      :class="{ 'workspace-sidebar--open': mobileSidebarOpen }"
    >
      <div class="sidebar-top">
        <div class="brand-lockup">
          <div class="brand-lockup__logo">
            <img src="/chroma.png" alt="ChromaDB logo" />
          </div>

          <div>
            <p class="section-kicker">ChromaDB UI</p>
            <h2>Control room</h2>
          </div>
        </div>

        <button
          class="icon-button sidebar-close"
          type="button"
          @click="mobileSidebarOpen = false"
        >
          <i class="pi pi-times"></i>
        </button>
      </div>

      <div class="sidebar-connection">
        <div class="sidebar-connection__status">
          <span class="status-dot status-dot--live"></span>
          <span>Live workspace</span>
        </div>

        <p class="sidebar-connection__endpoint">{{ activeEndpoint }}</p>

        <div class="sidebar-connection__meta">
          <div>
            <span>Tenant</span>
            <strong>{{ tenant }}</strong>
          </div>
          <div>
            <span>Database</span>
            <strong>{{ database }}</strong>
          </div>
        </div>
      </div>

      <div class="sidebar-actions">
        <button
          class="ui-button ui-button--secondary"
          type="button"
          :disabled="isFetchingCollectionData"
          @click="update"
        >
          <i
            :class="
              isFetchingCollectionData
                ? 'pi pi-spin pi-spinner'
                : 'pi pi-refresh'
            "
          ></i>
          <span>Refresh</span>
        </button>

        <button
          class="ui-button ui-button--primary"
          type="button"
          @click="handleCreateCollectionButtonClick"
        >
          <i class="pi pi-plus"></i>
          <span>Create collection</span>
        </button>
      </div>

      <label class="field field--compact">
        <span class="field__label">Search collections</span>
        <div class="search-shell">
          <i class="pi pi-search"></i>
          <input
            v-model="collectionSearch"
            type="text"
            placeholder="Filter by name or metadata"
          />
        </div>
      </label>

      <div class="sidebar-section">
        <div class="sidebar-section__header">
          <div>
            <p class="section-kicker">Collections</p>
            <h3>{{ filteredCollections.length }} visible</h3>
          </div>

          <span class="sidebar-count">{{ collections.length }}</span>
        </div>

        <div class="collection-list scroll-container">
          <div
            v-for="collection in filteredCollections"
            :key="collection.id"
            class="collection-card"
            :class="{
              'collection-card--active':
                currentCollection && currentCollection.id === collection.id,
            }"
          >
            <button
              class="collection-card__main"
              type="button"
              :disabled="isFetchingCollectionData"
              @click="handleCollectionSelection(collection)"
            >
              <span class="collection-card__avatar">{{
                getCollectionInitial(collection.name)
              }}</span>

              <span class="collection-card__copy">
                <strong>{{ collection.name }}</strong>
                <small>{{ getCollectionMetadataLabel(collection) }}</small>
              </span>
            </button>

            <button
              class="collection-card__menu"
              type="button"
              :disabled="isDeletingCollection || isFetchingCollectionData"
              @click.stop="toggleCollectionOverlayPanel($event, collection)"
            >
              <i
                :class="
                  isDeletingCollection || isFetchingCollectionData
                    ? 'pi pi-spin pi-spinner'
                    : 'pi pi-ellipsis-h'
                "
              ></i>
            </button>
          </div>

          <div v-if="!filteredCollections.length" class="sidebar-empty">
            No collections match the current search.
          </div>
        </div>
      </div>

      <div class="sidebar-footer">
        <span class="sidebar-footer__version"
          >Chroma {{ version || "unknown" }}</span
        >

        <button
          class="ui-button ui-button--ghost"
          type="button"
          @click="handleDisconnect"
        >
          <i class="pi pi-sign-out"></i>
          <span>Disconnect</span>
        </button>
      </div>
    </aside>

    <main class="workspace-main">
      <header class="workspace-header glass-panel">
        <div class="workspace-header__intro">
          <button
            class="icon-button mobile-menu"
            type="button"
            @click="mobileSidebarOpen = true"
          >
            <i class="pi pi-bars"></i>
          </button>

          <div>
            <p class="section-kicker">Vector workspace</p>
            <h1>{{ workspaceTitle }}</h1>
            <p>{{ workspaceSubtitle }}</p>
          </div>
        </div>

        <div class="workspace-header__context">
          <div class="info-pill">
            <span>Endpoint</span>
            <strong>{{ activeEndpoint }}</strong>
          </div>
          <div class="info-pill">
            <span>Database</span>
            <strong>{{ database }}</strong>
          </div>
        </div>
      </header>

      <section class="metric-grid">
        <article
          v-for="metric in dashboardMetrics"
          :key="metric.label"
          class="metric-card glass-panel"
        >
          <p class="section-kicker">{{ metric.label }}</p>
          <h2>{{ metric.value }}</h2>
          <p>{{ metric.description }}</p>
        </article>
      </section>

      <section class="content-grid">
        <article class="insight-panel glass-panel">
          <div class="panel-heading">
            <div>
              <p class="section-kicker">Collection brief</p>
              <h2>
                {{
                  currentCollection
                    ? "Metadata and context"
                    : "Nothing selected yet"
                }}
              </h2>
            </div>

            <span class="tag-chip">
              {{
                currentCollection
                  ? activeCollectionMetadataLabel
                  : "Browse collections"
              }}
            </span>
          </div>

          <div class="detail-list">
            <div
              v-for="fact in connectionFacts"
              :key="fact.label"
              class="detail-row"
            >
              <span>{{ fact.label }}</span>
              <strong>{{ fact.value }}</strong>
            </div>
          </div>

          <div class="code-block">
            <div class="code-block__label">Metadata preview</div>
            <pre>{{ collectionMetadataPreview }}</pre>
          </div>
        </article>

        <article class="table-panel glass-panel">
          <DataTable
            ref="embeddingDataTable"
            class="embedding-table"
            showGridlines
            editMode="cell"
            paginator
            scrollable
            :rows="10"
            :rowsPerPageOptions="[5, 10, 20, 50, 100]"
            :loading="isFetchingCollectionData"
            resizableColumns
            columnResizeMode="fit"
            stateStorage="local"
            stateKey="dt-state-chromadb-ui"
            v-model:filters="filters"
            :value="currentCollectionData"
            @cell-edit-complete="onEmbeddingCellEditComplete"
          >
            <template #header>
              <div class="table-toolbar">
                <div class="table-toolbar__copy">
                  <p class="section-kicker">Embedding explorer</p>
                  <h2>Documents and metadata</h2>
                  <p>
                    Search, edit, and export the rows loaded from the active
                    collection.
                  </p>
                </div>

                <div class="table-toolbar__actions">
                  <button
                    class="ui-button ui-button--secondary"
                    type="button"
                    :disabled="!currentCollectionData.length"
                    @click="exportCSV"
                  >
                    <i class="pi pi-download"></i>
                    <span>Export CSV</span>
                  </button>

                  <label class="search-shell search-shell--table">
                    <i class="pi pi-search"></i>
                    <input
                      v-model="filters.global.value"
                      type="text"
                      placeholder="Search the current table"
                    />
                  </label>
                </div>
              </div>
            </template>

            <template #empty>
              <div class="table-empty-state">
                <div class="table-empty-state__icon">
                  <i class="pi pi-database"></i>
                </div>
                <h3>
                  {{
                    currentCollection
                      ? "This collection is empty"
                      : "Select a collection to begin"
                  }}
                </h3>
                <p>
                  {{
                    currentCollection
                      ? "Embeddings will appear here once documents are stored in the selected collection."
                      : "Use the sidebar to pick a collection or create a fresh one."
                  }}
                </p>
              </div>
            </template>

            <Column field="id" header="ID" sortable headerStyle="width: 12rem">
              <template #body="slotProps">
                <div class="cell-id">{{ slotProps.data.id }}</div>
              </template>
            </Column>

            <Column field="document" header="Document" sortable>
              <template #body="slotProps">
                <div class="cell-document">{{ slotProps.data.document }}</div>
              </template>

              <template #editor="{ data, field }">
                <textarea
                  v-model="data[field]"
                  class="table-editor"
                  rows="4"
                  autofocus
                ></textarea>
              </template>
            </Column>

            <Column field="metadata" header="Metadata" sortable>
              <template #body="slotProps">
                <code class="cell-json">{{
                  slotProps.data.metadata ?? "null"
                }}</code>
              </template>

              <template #editor="{ data, field }">
                <textarea
                  v-model="data[field]"
                  class="table-editor table-editor--json"
                  rows="4"
                  autofocus
                ></textarea>
              </template>
            </Column>

            <Column header="" headerStyle="width: 4.5rem">
              <template #body="slotProps">
                <button
                  class="row-action row-action--danger"
                  type="button"
                  aria-label="Delete embedding"
                  @click="deleteEmbedding(slotProps.data.id)"
                >
                  <i class="pi pi-trash"></i>
                </button>
              </template>
            </Column>
          </DataTable>
        </article>
      </section>
    </main>
  </div>

  <Dialog
    v-model:visible="showCreateCollectionForm"
    modal
    :draggable="false"
    class="collection-dialog"
  >
    <template #header>
      <div class="dialog-heading">
        <p class="section-kicker">Create collection</p>
        <h2>Start a new namespace</h2>
      </div>
    </template>

    <div class="dialog-body">
      <label class="field">
        <span class="field__label">Collection name</span>
        <span class="field__hint"
          >Use a stable name that is easy to scan in the sidebar.</span
        >
        <input
          v-model="createCollectionData.name"
          type="text"
          placeholder="customer-support"
        />
      </label>

      <label class="field">
        <span class="field__label">Metadata</span>
        <span class="field__hint"
          >Optional JSON object stored with the collection.</span
        >
        <textarea
          v-model="createCollectionData.metadata"
          rows="8"
          placeholder='{"domain":"support","owner":"ops"}'
        ></textarea>
      </label>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <button
          class="ui-button ui-button--ghost"
          type="button"
          @click="showCreateCollectionForm = false"
        >
          Cancel
        </button>

        <button
          class="ui-button ui-button--primary"
          type="button"
          :disabled="isCreatingCollection"
          @click="handleCreateCollection"
        >
          <span>Create collection</span>
          <i
            :class="
              isCreatingCollection ? 'pi pi-spin pi-spinner' : 'pi pi-plus'
            "
          ></i>
        </button>
      </div>
    </template>
  </Dialog>

  <Dialog
    v-model:visible="showEditCollectionForm"
    modal
    :draggable="false"
    class="collection-dialog"
  >
    <template #header>
      <div class="dialog-heading">
        <p class="section-kicker">Edit collection</p>
        <h2>Update the current namespace</h2>
      </div>
    </template>

    <div class="dialog-body">
      <label class="field">
        <span class="field__label">Collection name</span>
        <span class="field__hint"
          >Rename the collection without leaving the dashboard.</span
        >
        <input
          v-model="editCollectionData.name"
          type="text"
          placeholder="customer-support"
        />
      </label>

      <label class="field">
        <span class="field__label">Metadata</span>
        <span class="field__hint"
          >Provide valid JSON to replace the collection metadata.</span
        >
        <textarea
          v-model="editCollectionData.metadata"
          rows="8"
          placeholder='{"domain":"support","owner":"ops"}'
        ></textarea>
      </label>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <button
          class="ui-button ui-button--ghost"
          type="button"
          @click="showEditCollectionForm = false"
        >
          Cancel
        </button>

        <button
          class="ui-button ui-button--primary"
          type="button"
          :disabled="isEditingCollection"
          @click="handleEditCollection"
        >
          <span>Save changes</span>
          <i
            :class="
              isEditingCollection ? 'pi pi-spin pi-spinner' : 'pi pi-check'
            "
          ></i>
        </button>
      </div>
    </template>
  </Dialog>

  <OverlayPanel ref="collectionOverlayPanel" class="collection-menu-panel">
    <div class="collection-menu">
      <button class="menu-action" type="button" @click="handleCollectionEdit">
        <i class="pi pi-pencil"></i>
        <span>Edit collection</span>
      </button>

      <button
        class="menu-action menu-action--danger"
        type="button"
        @click="handleCollectionDeletion"
      >
        <i class="pi pi-trash"></i>
        <span>Delete collection</span>
      </button>
    </div>
  </OverlayPanel>
</template>
