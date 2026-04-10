<script setup>
import {
  computed,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  ref,
  watch,
} from "vue";

import axios from "axios";
import hljs from "highlight.js/lib/core";
import jsonLanguage from "highlight.js/lib/languages/json";

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
hljs.registerLanguage("json", jsonLanguage);

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
const selectedTableRows = ref([]);
const createCollectionData = ref({ name: null, metadata: null });
const editCollectionData = ref({ name: null, metadata: null });
const cloneCollectionData = ref({
  name: "",
  metadata: "",
  includeRecords: true,
});
const createRecordData = ref({
  id: "",
  document: "",
  metadata: "",
  embedding: "",
});
const selectedCollection = ref(null);
const embeddingPreviewCache = ref({});
const embeddingVectorCache = ref({});
const loadingEmbeddingPreviewIds = ref({});
const savingEmbeddingIds = ref({});
const embeddingEditorDrafts = ref({});
const editingEmbeddingIds = ref({});
const embeddingDialog = ref({ visible: false, id: null });
const embeddingDialogOffset = ref(0);
const expandedEmbeddingRows = ref({});
const documentEditorDialog = ref({ visible: false, id: null, draft: "" });
const metadataEditorDialog = ref({
  visible: false,
  id: null,
  entries: [],
  mode: "fields",
  rawValue: "null",
});

const collectionOverlayPanel = ref();
const exportOverlayPanel = ref();
const metadataFilterOverlayPanel = ref();
const importFileInput = ref();
const embeddingDataTable = ref();
const queryResultsSection = ref(null);

const connected = ref(false);
const workspaceHealthStatus = ref("offline");
const isInitializingConnection = ref(false);
const isFetchingCollectionData = ref(false);
const isCreatingCollection = ref(false);
const isDeletingCollection = ref(false);
const isEditingCollection = ref(false);
const isQueryingCollection = ref(false);
const isExportingCsv = ref(false);
const isImportingRecords = ref(false);
const isCreatingRecord = ref(false);
const isCheckingWorkspaceHealth = ref(false);
const isDeletingRows = ref(false);
const isApplyingBulkMetadata = ref(false);
const isCloningCollection = ref(false);
const isSavingDocumentEditor = ref(false);
const isSavingMetadataEditor = ref(false);

const showCreateCollectionForm = ref(false);
const showEditCollectionForm = ref(false);
const showCloneCollectionForm = ref(false);
const showCreateRecordForm = ref(false);
const showBulkMetadataDialog = ref(false);
const mobileSidebarOpen = ref(false);
const collectionSearch = ref("");
const showQueryViewer = ref(false);
const showImportViewer = ref(false);
const showMetricsViewer = ref(false);
const showActivityLogViewer = ref(false);
const expandedActivityEntries = ref({});
const showImportAutoEmbedSettings = ref(false);
const showQueryAutoEmbedSettings = ref(false);
const showCreateRecordAutoEmbedSettings = ref(false);
const bulkMetadataMode = ref("merge");
const bulkMetadataValue = ref("");
const metadataFilterMode = ref("all");
const metadataFilterRules = ref([]);
const metadataFilterFocusedRuleId = ref(null);
const queryMode = ref("semantic");
const queryText = ref("");
const queryEmbedding = ref("");
const showQueryFilters = ref(false);
const queryWhereMode = ref("all");
const queryWhereRules = ref([]);
const queryWhereFocusedRuleId = ref(null);
const queryWhereDocumentMode = ref("all");
const queryWhereDocumentRules = ref([]);
const queryResultCount = ref(5);
const queryResults = ref([]);
const lastQuerySummary = ref("");
const hasCompletedQuery = ref(false);
const queryHistory = ref([]);
const semanticQuerySettings = ref({
  provider: "openai",
  openaiBaseUrl: "https://api.openai.com/v1",
  openaiModel: "text-embedding-3-small",
  openaiDimensions: "",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaModel: "embeddinggemma",
});
const semanticQueryApiKey = ref("");
const collectionEmbeddingDimensions = ref({});
const isResolvingCollectionEmbeddingDimension = ref(false);
const importMode = ref("upsert");
const importPayload = ref("");
const importFileName = ref("");
const isLoadingMetricsEmbeddings = ref(false);
const metricsEmbeddingSummary = ref(null);
const activityLog = ref([]);

const chromaLogoUrl = `${import.meta.env.BASE_URL}chroma.png`;

const entryHighlights = [
  {
    label: "Query workflows",
    value: "Semantic and vector search",
    description:
      "Turn text into embeddings or paste vectors directly to query the active collection.",
  },
  {
    label: "Paste-first imports",
    value: "Import JSON records",
    description:
      "Paste JSON, then add or upsert records into the active collection.",
  },
  {
    label: "Inline control",
    value: "Edit data in place",
    description:
      "Update documents, metadata, and embeddings directly inside the dashboard.",
  },
];

onBeforeMount(() => {
  retrieveConnectionParameters();
  retrieveSemanticQuerySettings();
  retrieveQueryHistory();
  retrieveActivityLog();
});

const EMBEDDING_PREVIEW_SAMPLE_COUNT = 6;
const EMBEDDING_DIALOG_WINDOW_SIZE = 120;
const EMBEDDING_DIALOG_CHUNK_SIZE = 12;
const METRICS_EMBEDDING_SAMPLE_SIZE = 24;
const QUERY_HISTORY_LIMIT = 10;
const ACTIVITY_LOG_LIMIT = 50;
const ACTIVITY_LOG_ID_PREVIEW_LIMIT = 20;
const ACTIVITY_LOG_DETAIL_SECTION_LIMIT = 8;
const ACTIVITY_LOG_DETAIL_VALUE_LIMIT = 1800;
const ACTIVITY_LOG_EMBEDDING_PREVIEW_COUNT = 12;
const ACTIVITY_LOG_STORAGE_KEY = "activity_log";
const SEMANTIC_QUERY_SETTINGS_STORAGE_KEY = "semantic_query_settings";
const WORKSPACE_HEALTH_CHECK_INTERVAL = 15000;
const WORKSPACE_HEALTH_CHECK_TIMEOUT = 5000;
const AUDIT_ZERO_NORM_THRESHOLD = 1e-9;
const METADATA_FILTER_OPERATORS = [
  { label: "Equals", value: "equals" },
  { label: "Contains", value: "contains" },
  { label: "Exists", value: "exists" },
  { label: "Missing", value: "missing" },
];
const QUERY_WHERE_OPERATORS = [
  { label: "Equals", value: "eq" },
  { label: "Not equal", value: "ne" },
  { label: "Greater than", value: "gt" },
  { label: "Greater or equal", value: "gte" },
  { label: "Less than", value: "lt" },
  { label: "Less or equal", value: "lte" },
];
const QUERY_FILTER_VALUE_TYPES = [
  { label: "Text", value: "text" },
  { label: "Number", value: "number" },
  { label: "True / false", value: "boolean" },
];
const METADATA_EDITOR_VALUE_TYPES = [
  { label: "Text", value: "text" },
  { label: "Number", value: "number" },
  { label: "True / false", value: "boolean" },
];
const QUERY_WHERE_DOCUMENT_OPERATORS = [
  { label: "Contains text", value: "contains" },
  { label: "Does not contain", value: "not_contains" },
  { label: "Matches regex", value: "regex" },
  { label: "Does not match regex", value: "not_regex" },
];
const IMPORT_EXAMPLE_PAYLOAD = `[
  {
    "id": "support-001",
    "document": "How to reset a password in the admin portal.",
    "embedding": [0.12, -0.44, 0.87, 0.03],
    "metadata": {
      "topic": "auth",
      "lang": "en"
    }
  },
  {
    "id": "support-002",
    "document": "Refund requests must be reviewed by billing.",
    "embedding": [0.31, 0.08, -0.22, 0.91],
    "metadata": {
      "topic": "billing",
      "priority": 2
    }
  }
]`;

let metadataFilterRuleSequence = 0;
let metadataEditorEntrySequence = 0;
let workspaceHealthCheckTimer = null;
let activityLogSequence = 0;
const highlightedJsonCache = new Map();

const safeStringify = (value, pretty = false) => {
  if (value === null || value === undefined) return "null";

  try {
    return JSON.stringify(value, null, pretty ? 2 : 0);
  } catch (_) {
    return String(value);
  }
};

const highlightJsonValue = (value, pretty = false) => {
  const source =
    typeof value === "string" ? value : safeStringify(value, pretty);
  const normalizedSource = source || "null";
  const cacheKey = `${pretty ? "pretty" : "raw"}:${normalizedSource}`;

  if (highlightedJsonCache.has(cacheKey)) {
    return highlightedJsonCache.get(cacheKey);
  }

  const highlightedValue = hljs.highlight(normalizedSource, {
    language: "json",
  }).value;

  if (highlightedJsonCache.size >= 300) {
    highlightedJsonCache.clear();
  }

  highlightedJsonCache.set(cacheKey, highlightedValue);
  return highlightedValue;
};

const formatNumber = (value) => new Intl.NumberFormat().format(value ?? 0);

const formatPercentage = (value, total) => {
  if (!total) return "0%";

  return `${Math.round((value / total) * 100)}%`;
};

const createEmptyRecordDraft = () => ({
  id: "",
  document: "",
  metadata: "",
  embedding: "",
});

const createEmptyCloneCollectionDraft = () => ({
  name: "",
  metadata: "",
  includeRecords: true,
});

const resetCloneCollectionState = (force = false) => {
  if (isCloningCollection.value && !force) return;

  showCloneCollectionForm.value = false;
  isCloningCollection.value = false;
  cloneCollectionData.value = createEmptyCloneCollectionDraft();
};

const resetCreateRecordState = () => {
  showCreateRecordForm.value = false;
  showCreateRecordAutoEmbedSettings.value = false;
  createRecordData.value = createEmptyRecordDraft();
};

const resetBulkMetadataState = () => {
  showBulkMetadataDialog.value = false;
  bulkMetadataMode.value = "merge";
  bulkMetadataValue.value = "";
};

const resetBulkSelectionState = () => {
  selectedTableRows.value = [];
  resetBulkMetadataState();
};

const resetImportState = () => {
  showImportViewer.value = false;
  showImportAutoEmbedSettings.value = false;
  importMode.value = "upsert";
  importPayload.value = "";
  importFileName.value = "";

  if (importFileInput.value) {
    importFileInput.value.value = "";
  }
};

const hasRecordField = (record, field) =>
  Object.prototype.hasOwnProperty.call(record, field);

const parseMetadataValue = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "null"
  ) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
};

const isPlainMetadataObject = (value) => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};

const normalizeMetadataEditorValueType = (valueType) => {
  return METADATA_EDITOR_VALUE_TYPES.some((entry) => entry.value === valueType)
    ? valueType
    : "text";
};

const getMetadataEditorValueType = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return "number";
  if (typeof value === "boolean") return "boolean";
  return "text";
};

const normalizeMetadataEditorValue = (value, valueType = "text") => {
  if (normalizeMetadataEditorValueType(valueType) === "boolean") {
    return `${value}` === "false" ? "false" : "true";
  }

  return value === null || value === undefined ? "" : `${value}`;
};

const createMetadataEditorEntry = (overrides = {}) => {
  const valueType = normalizeMetadataEditorValueType(
    overrides?.valueType ?? getMetadataEditorValueType(overrides?.value),
  );

  return {
    id:
      overrides?.id ?? `metadata-editor-${(metadataEditorEntrySequence += 1)}`,
    key: `${overrides?.key ?? ""}`,
    valueType,
    value: normalizeMetadataEditorValue(overrides?.value, valueType),
  };
};

const buildMetadataEditorEntries = (metadataValue) => {
  if (!isPlainMetadataObject(metadataValue)) {
    return [];
  }

  return Object.entries(metadataValue).map(([key, value]) =>
    createMetadataEditorEntry({ key, value }),
  );
};

const buildMetadataFromEditorEntries = (entries) => {
  if (!Array.isArray(entries) || !entries.length) {
    return null;
  }

  const metadata = {};
  const seenKeys = new Set();

  for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
    const entry = entries[entryIndex];
    const key = `${entry?.key ?? ""}`.trim();

    if (!key) {
      throw new Error(`Metadata key ${entryIndex + 1} cannot be empty.`);
    }

    if (seenKeys.has(key)) {
      throw new Error(`Duplicate metadata key '${key}'.`);
    }

    const valueType = normalizeMetadataEditorValueType(entry?.valueType);
    let value;

    if (valueType === "number") {
      const normalizedValue = `${entry?.value ?? ""}`.trim();

      if (!normalizedValue.length) {
        throw new Error(`Metadata value for '${key}' must be a number.`);
      }

      value = Number(normalizedValue);

      if (!Number.isFinite(value)) {
        throw new Error(`Metadata value for '${key}' must be a finite number.`);
      }
    } else if (valueType === "boolean") {
      value = `${entry?.value}` === "false" ? false : true;
    } else {
      value = `${entry?.value ?? ""}`;
    }

    metadata[key] = value;
    seenKeys.add(key);
  }

  return metadata;
};

const handleMetadataEditorValueTypeChange = (entry) => {
  if (!entry) return;

  entry.valueType = normalizeMetadataEditorValueType(entry.valueType);

  if (entry.valueType === "boolean") {
    entry.value = normalizeMetadataEditorValue(entry.value, "boolean");
  }
};

const canMetadataEditorUseFieldMode = (metadataValue) => {
  if (metadataValue === null) return true;
  if (!isPlainMetadataObject(metadataValue)) return false;

  return Object.values(metadataValue).every((value) => {
    return (
      (typeof value === "string" && value !== undefined) ||
      (typeof value === "number" && Number.isFinite(value)) ||
      typeof value === "boolean"
    );
  });
};

const parseMetadataEditorRawValue = (value) => {
  const trimmedValue = `${value ?? ""}`.trim();

  if (!trimmedValue) {
    throw new Error("Enter a JSON object or null.");
  }

  let parsedValue;

  try {
    parsedValue = JSON.parse(trimmedValue);
  } catch (_) {
    throw new Error("Metadata JSON must be valid JSON.");
  }

  if (parsedValue !== null && !isPlainMetadataObject(parsedValue)) {
    throw new Error("Metadata JSON must be a JSON object or null.");
  }

  return parsedValue;
};

const createMetadataFilterRule = (overrides = {}) => ({
  id: `metadata-filter-${(metadataFilterRuleSequence += 1)}`,
  key: "",
  operator: "equals",
  value: "",
  ...overrides,
});

const getQueryWhereForcedValueType = (operator) => {
  return ["gt", "gte", "lt", "lte"].includes(operator) ? "number" : null;
};

const normalizeQueryWhereValueType = (valueType, operator = "eq") => {
  const forcedValueType = getQueryWhereForcedValueType(operator);

  if (forcedValueType) {
    return forcedValueType;
  }

  return QUERY_FILTER_VALUE_TYPES.some((entry) => entry.value === valueType)
    ? valueType
    : "text";
};

const normalizeQueryWhereValue = (value, valueType) => {
  if (valueType === "boolean") {
    return `${value}` === "false" ? "false" : "true";
  }

  return value === null || value === undefined ? "" : `${value}`;
};

const createQueryWhereRule = (overrides = {}) => {
  const operator = QUERY_WHERE_OPERATORS.some(
    (entry) => entry.value === overrides?.operator,
  )
    ? overrides.operator
    : "eq";
  const valueType = normalizeQueryWhereValueType(
    overrides?.valueType,
    operator,
  );

  return {
    id: overrides?.id ?? `query-where-${(metadataFilterRuleSequence += 1)}`,
    key: `${overrides?.key ?? ""}`,
    operator,
    valueType,
    value: normalizeQueryWhereValue(overrides?.value, valueType),
  };
};

const createQueryWhereDocumentRule = (overrides = {}) => ({
  id:
    overrides?.id ??
    `query-where-document-${(metadataFilterRuleSequence += 1)}`,
  operator: QUERY_WHERE_DOCUMENT_OPERATORS.some(
    (entry) => entry.value === overrides?.operator,
  )
    ? overrides.operator
    : "contains",
  value: `${overrides?.value ?? ""}`,
});

const doesMetadataFilterOperatorNeedValue = (operator) => {
  return operator !== "exists" && operator !== "missing";
};

const isQueryWhereRuleComplete = (rule) => {
  const normalizedKey = `${rule?.key ?? ""}`.trim();

  if (!normalizedKey) return false;

  if (
    normalizeQueryWhereValueType(rule?.valueType, rule?.operator) === "boolean"
  ) {
    return true;
  }

  return `${rule?.value ?? ""}`.trim().length > 0;
};

const isQueryWhereDocumentRuleComplete = (rule) => {
  return `${rule?.value ?? ""}`.trim().length > 0;
};

const normalizeMetadataFilterValue = (value) => {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase();
  }

  return safeStringify(value).trim().toLowerCase();
};

const getRowMetadataObject = (row) => {
  const metadata = parseMetadataValue(row?.metadata);

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return metadata;
};

const isMetadataFilterRuleComplete = (rule) => {
  const normalizedKey = `${rule?.key ?? ""}`.trim();

  if (!normalizedKey) return false;

  if (!doesMetadataFilterOperatorNeedValue(rule?.operator)) {
    return true;
  }

  return `${rule?.value ?? ""}`.trim().length > 0;
};

const getMetadataFilterOperatorLabel = (operator) => {
  return (
    METADATA_FILTER_OPERATORS.find((entry) => entry.value === operator)
      ?.label ?? operator
  );
};

const formatMetadataFilterRule = (rule) => {
  const normalizedKey = `${rule?.key ?? ""}`.trim();

  if (!normalizedKey) return "Incomplete filter";

  const operatorLabel = getMetadataFilterOperatorLabel(rule?.operator);

  if (!doesMetadataFilterOperatorNeedValue(rule?.operator)) {
    return `${normalizedKey} ${operatorLabel.toLowerCase()}`;
  }

  return `${normalizedKey} ${operatorLabel.toLowerCase()} ${`${rule?.value ?? ""}`.trim()}`;
};

const doesMetadataFilterRuleMatch = (row, rule) => {
  const normalizedKey = `${rule?.key ?? ""}`.trim();

  if (!normalizedKey) return true;

  const metadataObject = getRowMetadataObject(row);
  const hasKey = Boolean(
    metadataObject &&
      Object.prototype.hasOwnProperty.call(metadataObject, normalizedKey),
  );

  if (rule?.operator === "exists") {
    return hasKey;
  }

  if (rule?.operator === "missing") {
    return !hasKey;
  }

  if (!hasKey) {
    return false;
  }

  const metadataValue = metadataObject[normalizedKey];
  const normalizedMetadataValue = normalizeMetadataFilterValue(metadataValue);
  const normalizedRuleValue = normalizeMetadataFilterValue(rule?.value);

  if (rule?.operator === "contains") {
    return normalizedMetadataValue.includes(normalizedRuleValue);
  }

  return normalizedMetadataValue === normalizedRuleValue;
};

const addQueryWhereRule = () => {
  queryWhereRules.value = [...queryWhereRules.value, createQueryWhereRule()];
};

const clearQueryWhereRules = () => {
  queryWhereMode.value = "all";
  queryWhereRules.value = [];
  queryWhereFocusedRuleId.value = null;
};

const removeQueryWhereRule = (ruleId) => {
  queryWhereRules.value = queryWhereRules.value.filter(
    (rule) => rule.id !== ruleId,
  );
};

const addQueryWhereDocumentRule = () => {
  queryWhereDocumentRules.value = [
    ...queryWhereDocumentRules.value,
    createQueryWhereDocumentRule(),
  ];
};

const clearQueryWhereDocumentRules = () => {
  queryWhereDocumentMode.value = "all";
  queryWhereDocumentRules.value = [];
};

const removeQueryWhereDocumentRule = (ruleId) => {
  queryWhereDocumentRules.value = queryWhereDocumentRules.value.filter(
    (rule) => rule.id !== ruleId,
  );
};

const handleQueryWhereOperatorChange = (rule) => {
  Object.assign(rule, createQueryWhereRule(rule));
};

const handleQueryWhereValueTypeChange = (rule) => {
  Object.assign(rule, createQueryWhereRule(rule));
};

const getQueryWhereKeySuggestions = (rule) => {
  const normalizedKey = `${rule?.key ?? ""}`.trim().toLowerCase();

  if (!normalizedKey) {
    return metadataFilterKeyOptions.value.slice(0, 8);
  }

  return metadataFilterKeyOptions.value
    .filter((key) => key.toLowerCase().includes(normalizedKey))
    .slice(0, 8);
};

const shouldShowQueryWhereKeySuggestions = (rule) => {
  return (
    queryWhereFocusedRuleId.value === rule.id &&
    getQueryWhereKeySuggestions(rule).length > 0
  );
};

const handleQueryWhereKeyFocus = (ruleId) => {
  queryWhereFocusedRuleId.value = ruleId;
};

const handleQueryWhereKeyBlur = () => {
  window.setTimeout(() => {
    queryWhereFocusedRuleId.value = null;
  }, 80);
};

const selectQueryWhereKey = (rule, key) => {
  rule.key = key;
  queryWhereFocusedRuleId.value = null;
};

const parseStoredQueryFilterObject = (value) => {
  const trimmedValue = `${value ?? ""}`.trim();

  if (!trimmedValue || trimmedValue === "null") {
    return null;
  }

  try {
    const parsedValue = JSON.parse(trimmedValue);

    return parsedValue &&
      typeof parsedValue === "object" &&
      !Array.isArray(parsedValue)
      ? parsedValue
      : null;
  } catch (_) {
    return null;
  }
};

const inferQueryWhereValueType = (value, operator = "eq") => {
  const forcedValueType = getQueryWhereForcedValueType(operator);

  if (forcedValueType) {
    return forcedValueType;
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return "number";
  }

  return "text";
};

const formatStoredQueryWhereValue = (value, valueType) => {
  if (valueType === "boolean") {
    return value ? "true" : "false";
  }

  return value === null || value === undefined ? "" : `${value}`;
};

const normalizeStoredQueryWhereRules = (rules) => {
  return Array.isArray(rules)
    ? rules.map((rule) => createQueryWhereRule(rule))
    : [];
};

const normalizeStoredQueryWhereDocumentRules = (rules) => {
  return Array.isArray(rules)
    ? rules.map((rule) => createQueryWhereDocumentRule(rule))
    : [];
};

const parseLegacyQueryWhereState = (value) => {
  const parsedValue = parseStoredQueryFilterObject(value);

  if (!parsedValue) {
    return {
      mode: "all",
      rules: [],
    };
  }

  const normalizedMode = Array.isArray(parsedValue.$or) ? "any" : "all";
  const clauses = Array.isArray(parsedValue.$and)
    ? parsedValue.$and
    : Array.isArray(parsedValue.$or)
      ? parsedValue.$or
      : [parsedValue];

  const rules = clauses
    .map((clause) => {
      if (!isPlainMetadataObject(clause)) return null;

      const clauseEntries = Object.entries(clause);

      if (clauseEntries.length !== 1) return null;

      const [key, rawCondition] = clauseEntries[0];

      if (!`${key ?? ""}`.trim()) return null;

      if (isPlainMetadataObject(rawCondition)) {
        const conditionEntries = Object.entries(rawCondition);

        if (conditionEntries.length !== 1) return null;

        const [operatorToken, operatorValue] = conditionEntries[0];
        const operatorMap = {
          $eq: "eq",
          $ne: "ne",
          $gt: "gt",
          $gte: "gte",
          $lt: "lt",
          $lte: "lte",
        };
        const operator = operatorMap[operatorToken];

        if (!operator) return null;

        const valueType = inferQueryWhereValueType(operatorValue, operator);

        return createQueryWhereRule({
          key,
          operator,
          valueType,
          value: formatStoredQueryWhereValue(operatorValue, valueType),
        });
      }

      const valueType = inferQueryWhereValueType(rawCondition, "eq");

      return createQueryWhereRule({
        key,
        operator: "eq",
        valueType,
        value: formatStoredQueryWhereValue(rawCondition, valueType),
      });
    })
    .filter(Boolean);

  return {
    mode: normalizedMode,
    rules,
  };
};

const parseLegacyQueryWhereDocumentState = (value) => {
  const parsedValue = parseStoredQueryFilterObject(value);

  if (!parsedValue) {
    return {
      mode: "all",
      rules: [],
    };
  }

  const normalizedMode = Array.isArray(parsedValue.$or) ? "any" : "all";
  const clauses = Array.isArray(parsedValue.$and)
    ? parsedValue.$and
    : Array.isArray(parsedValue.$or)
      ? parsedValue.$or
      : [parsedValue];

  const operatorMap = {
    $contains: "contains",
    $not_contains: "not_contains",
    $regex: "regex",
    $not_regex: "not_regex",
  };

  const rules = clauses
    .map((clause) => {
      if (!isPlainMetadataObject(clause)) return null;

      const clauseEntries = Object.entries(clause);

      if (clauseEntries.length !== 1) return null;

      const [operatorToken, operatorValue] = clauseEntries[0];
      const operator = operatorMap[operatorToken];

      if (!operator || typeof operatorValue !== "string") return null;

      return createQueryWhereDocumentRule({
        operator,
        value: operatorValue,
      });
    })
    .filter(Boolean);

  return {
    mode: normalizedMode,
    rules,
  };
};

const countWords = (value) => {
  const normalizedValue = `${value ?? ""}`.trim();

  if (!normalizedValue) return 0;

  return normalizedValue.split(/\s+/).length;
};

const pluralize = (count, singular, plural = `${singular}s`) => {
  return count === 1 ? singular : plural;
};

const getMetadataValueType = (value) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";

  return typeof value;
};

const normalizeDocumentFingerprint = (value) => {
  return `${value ?? ""}`.trim().replace(/\s+/g, " ").toLowerCase();
};

const truncateText = (value, limit = 80) => {
  const normalizedValue = `${value ?? ""}`.trim();

  if (normalizedValue.length <= limit) return normalizedValue;

  return `${normalizedValue.slice(0, Math.max(0, limit - 1))}…`;
};

const formatQueryHistoryTimestamp = (value) => {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (_) {
    return String(value);
  }
};

const sampleRows = (rows, sampleSize) => {
  if (!Array.isArray(rows) || !rows.length) return [];
  if (rows.length <= sampleSize) return rows;

  const step = (rows.length - 1) / (sampleSize - 1);
  const sampledRows = [];
  const seenIndexes = new Set();

  for (let sampleIndex = 0; sampleIndex < sampleSize; sampleIndex += 1) {
    const rowIndex = Math.min(rows.length - 1, Math.round(sampleIndex * step));

    if (seenIndexes.has(rowIndex)) continue;

    sampledRows.push(rows[rowIndex]);
    seenIndexes.add(rowIndex);
  }

  return sampledRows;
};

const formatEmbeddingNumber = (value) => {
  if (!Number.isFinite(value)) return String(value);

  if (value === 0) return "0";
  if (Math.abs(value) >= 1000 || Math.abs(value) < 0.001) {
    return value.toExponential(2);
  }

  return value.toFixed(4).replace(/\.?0+$/, "");
};

const getCollectionInitial = (name) =>
  (name?.trim()?.charAt(0) ?? "C").toUpperCase();

const buildSuggestedCollectionCloneName = (sourceName) => {
  const normalizedSourceName = `${sourceName ?? ""}`.trim() || "collection";
  const baseName = `${normalizedSourceName}-copy`;
  const existingCollectionNames = new Set(
    collections.value.map((collection) => `${collection?.name ?? ""}`.trim()),
  );

  if (!existingCollectionNames.has(baseName)) {
    return baseName;
  }

  let duplicateIndex = 2;

  while (existingCollectionNames.has(`${baseName}-${duplicateIndex}`)) {
    duplicateIndex += 1;
  }

  return `${baseName}-${duplicateIndex}`;
};

const resetEmbeddingViews = () => {
  embeddingPreviewCache.value = {};
  embeddingVectorCache.value = {};
  loadingEmbeddingPreviewIds.value = {};
  savingEmbeddingIds.value = {};
  embeddingEditorDrafts.value = {};
  editingEmbeddingIds.value = {};
  embeddingDialog.value = { visible: false, id: null };
  embeddingDialogOffset.value = 0;
  expandedEmbeddingRows.value = {};
  documentEditorDialog.value = { visible: false, id: null, draft: "" };
  isSavingDocumentEditor.value = false;
  metadataEditorDialog.value = {
    visible: false,
    id: null,
    entries: [],
    mode: "fields",
    rawValue: "null",
  };
  isSavingMetadataEditor.value = false;
};

const getEmbeddingPreview = (id) => {
  return embeddingPreviewCache.value[id] ?? null;
};

const isEmbeddingPreviewLoading = (id) => {
  return Boolean(loadingEmbeddingPreviewIds.value[id]);
};

const buildEmbeddingSparkline = (values) => {
  if (!values.length) return "";

  const width = 132;
  const height = 40;
  const padding = 4;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  return values
    .map((value, index) => {
      const x =
        values.length === 1
          ? width / 2
          : padding + (index * (width - padding * 2)) / (values.length - 1);
      const y =
        height -
        padding -
        ((value - minValue) / range) * (height - padding * 2);

      return `${x},${y}`;
    })
    .join(" ");
};

const sampleEmbeddingValues = (
  vector,
  sampleCount = EMBEDDING_PREVIEW_SAMPLE_COUNT,
) => {
  if (!Array.isArray(vector) || !vector.length) return [];

  if (vector.length <= sampleCount) {
    return vector.map((value, index) => ({ index, value }));
  }

  const step = (vector.length - 1) / (sampleCount - 1);

  return Array.from({ length: sampleCount }, (_, sampleIndex) => {
    const index = Math.min(vector.length - 1, Math.round(sampleIndex * step));

    return {
      index,
      value: vector[index],
    };
  });
};

const buildEmbeddingPreview = (vector) => {
  if (!Array.isArray(vector) || !vector.length) {
    return {
      dimensions: 0,
      min: null,
      max: null,
      norm: null,
      sampleValues: [],
      sparklinePoints: "",
    };
  }

  let min = Infinity;
  let max = -Infinity;
  let normSquareSum = 0;

  for (const value of vector) {
    if (!Number.isFinite(value)) continue;

    min = Math.min(min, value);
    max = Math.max(max, value);
    normSquareSum += value * value;
  }

  const sampleValues = sampleEmbeddingValues(vector).map(
    ({ index, value }) => ({
      index,
      value,
      label: formatEmbeddingNumber(value),
    }),
  );

  return {
    dimensions: vector.length,
    min,
    minLabel: Number.isFinite(min) ? formatEmbeddingNumber(min) : "n/a",
    max,
    maxLabel: Number.isFinite(max) ? formatEmbeddingNumber(max) : "n/a",
    norm: Math.sqrt(normSquareSum),
    normLabel: formatEmbeddingNumber(Math.sqrt(normSquareSum)),
    sampleValues,
    sparklinePoints: buildEmbeddingSparkline(
      sampleValues.map((sample) => sample.value),
    ),
  };
};

const getEmbeddingSummaryText = (id) => {
  const preview = getEmbeddingPreview(id);

  if (!preview) return "Vector preview available on demand";

  return `${formatNumber(preview.dimensions)} dims • norm ${preview.normLabel}`;
};

const getEmbeddingDraft = (id) => {
  return embeddingEditorDrafts.value[id] ?? "";
};

const updateEmbeddingDraft = (id, value) => {
  embeddingEditorDrafts.value = {
    ...embeddingEditorDrafts.value,
    [id]: value,
  };
};

const isEmbeddingEditing = (id) => {
  return Boolean(editingEmbeddingIds.value[id]);
};

const isSavingEmbedding = (id) => {
  return Boolean(savingEmbeddingIds.value[id]);
};

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

const workspaceStatusLabel = computed(() => {
  if (!connected.value) return "Workspace offline";

  if (workspaceHealthStatus.value === "unreachable") {
    return "Workspace unavailable";
  }

  if (workspaceHealthStatus.value === "checking") {
    return "Checking workspace";
  }

  return "Live workspace";
});

const workspaceStatusDotClass = computed(() => {
  if (!connected.value) return "status-dot--offline";

  if (workspaceHealthStatus.value === "unreachable") {
    return "status-dot--offline";
  }

  if (workspaceHealthStatus.value === "checking") {
    return "status-dot--warm";
  }

  return "status-dot--live";
});

const workspaceConnectionMetricLabel = computed(() => {
  if (!connected.value) return "Offline";

  if (workspaceHealthStatus.value === "unreachable") {
    return "Unavailable";
  }

  if (workspaceHealthStatus.value === "checking") {
    return "Checking";
  }

  return "Online";
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

  return `${formatNumber(currentCollectionData.value.length)} records loaded in ${currentCollection.value.name}.`;
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

const collectionMetadataPreviewHtml = computed(() => {
  if (
    !currentCollection.value ||
    currentCollection.value.metadata === null ||
    currentCollection.value.metadata === undefined
  ) {
    return "";
  }

  return highlightJsonValue(currentCollection.value.metadata, true);
});

const collectionMetrics = computed(() => {
  const totalRows = currentCollectionData.value.length;
  const metadataKeyCounts = {};
  let rowsWithDocuments = 0;
  let rowsWithMetadata = 0;
  let totalDocumentWords = 0;
  let totalDocumentCharacters = 0;
  let longestDocumentWords = 0;

  for (const row of currentCollectionData.value) {
    const documentText = `${row.document ?? ""}`.trim();
    const metadataValue = parseMetadataValue(row.metadata);
    const wordCount = countWords(documentText);

    if (documentText) {
      rowsWithDocuments += 1;
    }

    if (metadataValue !== null) {
      rowsWithMetadata += 1;
    }

    totalDocumentWords += wordCount;
    totalDocumentCharacters += documentText.length;
    longestDocumentWords = Math.max(longestDocumentWords, wordCount);

    if (
      metadataValue &&
      typeof metadataValue === "object" &&
      !Array.isArray(metadataValue)
    ) {
      for (const key of Object.keys(metadataValue)) {
        metadataKeyCounts[key] = (metadataKeyCounts[key] ?? 0) + 1;
      }
    }
  }

  const metadataKeyStats = Object.entries(metadataKeyCounts)
    .sort((leftEntry, rightEntry) => {
      if (rightEntry[1] === leftEntry[1]) {
        return leftEntry[0].localeCompare(rightEntry[0]);
      }

      return rightEntry[1] - leftEntry[1];
    })
    .map(([key, count]) => ({
      key,
      count,
      coverageLabel: formatPercentage(count, totalRows),
    }));

  return {
    totalRows,
    rowsWithDocuments,
    rowsWithMetadata,
    documentCoverageLabel: formatPercentage(rowsWithDocuments, totalRows),
    metadataCoverageLabel: formatPercentage(rowsWithMetadata, totalRows),
    averageWordCountLabel: totalRows
      ? formatNumber(Math.round(totalDocumentWords / totalRows))
      : "0",
    averageCharacterCountLabel: totalRows
      ? formatNumber(Math.round(totalDocumentCharacters / totalRows))
      : "0",
    longestDocumentWordsLabel: formatNumber(longestDocumentWords),
    metadataKeyCountLabel: formatNumber(metadataKeyStats.length),
    topMetadataKeys: metadataKeyStats.slice(0, 8),
  };
});

const collectionMetricCards = computed(() => {
  return [
    {
      label: "Loaded rows",
      value: formatNumber(collectionMetrics.value.totalRows),
      description: "Records currently loaded from the selected collection.",
    },
    {
      label: "Document coverage",
      value: collectionMetrics.value.documentCoverageLabel,
      description: `${formatNumber(collectionMetrics.value.rowsWithDocuments)} rows include document text.`,
    },
    {
      label: "Metadata coverage",
      value: collectionMetrics.value.metadataCoverageLabel,
      description: `${formatNumber(collectionMetrics.value.rowsWithMetadata)} rows include metadata.`,
    },
    {
      label: "Avg document",
      value: `${collectionMetrics.value.averageWordCountLabel} words`,
      description: `${collectionMetrics.value.averageCharacterCountLabel} characters on average.`,
    },
  ];
});

const collectionQualityAudit = computed(() => {
  const totalRows = currentCollectionData.value.length;
  const findings = [];
  const severityRank = {
    high: 0,
    medium: 1,
    low: 2,
    info: 3,
  };
  const addFinding = ({
    severity,
    category,
    title,
    description,
    hint = "",
    count = 0,
  }) => {
    findings.push({
      severity,
      severityLabel:
        severity === "high"
          ? "High"
          : severity === "medium"
            ? "Review"
            : severity === "low"
              ? "Watch"
              : "Info",
      category,
      title,
      description,
      hint,
      count,
    });
  };

  if (!totalRows) {
    return {
      statusLabel: "Awaiting rows",
      statusTone: "idle",
      summaryCards: [
        {
          label: "Audit status",
          value: "Awaiting rows",
          description:
            "Open a non-empty collection to audit content, metadata, and embeddings.",
          valueClass: "quality-audit-status quality-audit-status--idle",
        },
        {
          label: "Findings",
          value: "0",
          description: "No rows are loaded yet.",
        },
        {
          label: "Rows checked",
          value: "0",
          description: "Content and metadata checks use all loaded rows.",
        },
        {
          label: "Embedding sample",
          value: "Pending",
          description: "Embedding checks start after the metrics sample loads.",
        },
      ],
      findings: [],
      emptyStateMessage:
        "Open a collection with rows to audit content, metadata, and embeddings.",
      pendingEmbeddingChecks: false,
      pendingMessage: "",
    };
  }

  let rowsWithoutDocuments = 0;
  let rowsWithoutMetadata = 0;
  let rowsWithNonObjectMetadata = 0;
  let rowsWithEmptyMetadataObjects = 0;
  const documentGroups = new Map();
  const metadataTypeGroups = new Map();

  for (const row of currentCollectionData.value) {
    const documentText = `${row.document ?? ""}`.trim();
    const metadataValue = parseMetadataValue(row.metadata);

    if (!documentText) {
      rowsWithoutDocuments += 1;
    } else {
      const documentFingerprint = normalizeDocumentFingerprint(documentText);
      const existingDocumentGroup = documentGroups.get(documentFingerprint) ?? {
        preview: documentText,
        ids: [],
      };

      existingDocumentGroup.ids.push(row.id);
      documentGroups.set(documentFingerprint, existingDocumentGroup);
    }

    if (metadataValue === null) {
      rowsWithoutMetadata += 1;
      continue;
    }

    if (typeof metadataValue !== "object" || Array.isArray(metadataValue)) {
      rowsWithNonObjectMetadata += 1;
      continue;
    }

    const metadataKeys = Object.keys(metadataValue);

    if (!metadataKeys.length) {
      rowsWithEmptyMetadataObjects += 1;
      continue;
    }

    for (const key of metadataKeys) {
      const existingTypeGroup = metadataTypeGroups.get(key) ?? {
        count: 0,
        types: new Set(),
      };

      existingTypeGroup.count += 1;
      existingTypeGroup.types.add(getMetadataValueType(metadataValue[key]));
      metadataTypeGroups.set(key, existingTypeGroup);
    }
  }

  const duplicateDocumentGroups = Array.from(documentGroups.values())
    .filter((group) => group.ids.length > 1)
    .map((group) => ({
      ...group,
      count: group.ids.length,
    }))
    .sort((leftGroup, rightGroup) => rightGroup.count - leftGroup.count);
  const duplicateDocumentRows = duplicateDocumentGroups.reduce(
    (total, group) => total + group.count,
    0,
  );
  const metadataTypeConflicts = Array.from(metadataTypeGroups.entries())
    .map(([key, group]) => ({
      key,
      count: group.count,
      types: Array.from(group.types).sort(),
    }))
    .filter((group) => group.types.length > 1)
    .sort((leftGroup, rightGroup) => {
      if (rightGroup.types.length !== leftGroup.types.length) {
        return rightGroup.types.length - leftGroup.types.length;
      }

      if (rightGroup.count !== leftGroup.count) {
        return rightGroup.count - leftGroup.count;
      }

      return leftGroup.key.localeCompare(rightGroup.key);
    });

  if (rowsWithoutDocuments === totalRows) {
    addFinding({
      severity: "high",
      category: "Content coverage",
      title: "No document text stored",
      description: `All ${formatNumber(totalRows)} loaded ${pluralize(totalRows, "row")} are missing document text. Working only from vectors makes manual inspection and retrieval debugging much harder.`,
      hint: "Add document text to make the collection easier to validate and debug.",
      count: rowsWithoutDocuments,
    });
  } else if (rowsWithoutDocuments > 0) {
    addFinding({
      severity: rowsWithoutDocuments / totalRows >= 0.3 ? "medium" : "low",
      category: "Content coverage",
      title: "Some rows are missing documents",
      description: `${formatNumber(rowsWithoutDocuments)} of ${formatNumber(totalRows)} loaded rows (${formatPercentage(rowsWithoutDocuments, totalRows)}) have no document text.`,
      hint: "Rows without documents are harder to validate manually and harder to compare during retrieval review.",
      count: rowsWithoutDocuments,
    });
  }

  if (rowsWithNonObjectMetadata > 0) {
    addFinding({
      severity: rowsWithNonObjectMetadata / totalRows >= 0.2 ? "medium" : "low",
      category: "Metadata shape",
      title: "Non-object metadata values detected",
      description: `${formatNumber(rowsWithNonObjectMetadata)} ${pluralize(rowsWithNonObjectMetadata, "row")} store metadata as arrays or primitive values instead of JSON objects.`,
      hint: "Metadata filters and schema expectations work best when rows use JSON-shaped metadata or null.",
      count: rowsWithNonObjectMetadata,
    });
  }

  if (rowsWithoutMetadata === totalRows) {
    addFinding({
      severity: "medium",
      category: "Metadata coverage",
      title: "No metadata stored",
      description: `None of the ${formatNumber(totalRows)} loaded rows include metadata. That limits filtering, faceting, and operational tracing.`,
      hint: "Even a few stable metadata fields can make filtering, exports, and audits much easier.",
      count: rowsWithoutMetadata,
    });
  } else if (rowsWithoutMetadata / totalRows >= 0.25) {
    addFinding({
      severity: "low",
      category: "Metadata coverage",
      title: "Metadata is sparse",
      description: `${formatNumber(rowsWithoutMetadata)} of ${formatNumber(totalRows)} loaded rows (${formatPercentage(rowsWithoutMetadata, totalRows)}) have no metadata at all.`,
      hint: "Even a few stable metadata fields can make filtering, exports, and audits much easier.",
      count: rowsWithoutMetadata,
    });
  }

  if (rowsWithEmptyMetadataObjects > 0) {
    addFinding({
      severity: "low",
      category: "Metadata coverage",
      title: "Empty metadata objects are present",
      description: `${formatNumber(rowsWithEmptyMetadataObjects)} ${pluralize(rowsWithEmptyMetadataObjects, "row")} store empty metadata objects with no keys.`,
      hint: "Use null when metadata is intentionally absent.",
      count: rowsWithEmptyMetadataObjects,
    });
  }

  if (duplicateDocumentGroups.length) {
    const duplicatePreview = duplicateDocumentGroups
      .slice(0, 2)
      .map(
        (group) =>
          `"${truncateText(group.preview, 38)}" (${formatNumber(group.count)} ${pluralize(group.count, "row")})`,
      )
      .join(" · ");

    addFinding({
      severity: duplicateDocumentRows / totalRows >= 0.15 ? "medium" : "low",
      category: "Content duplication",
      title: "Possible duplicate document chunks",
      description: `${formatNumber(duplicateDocumentRows)} rows fall into ${formatNumber(duplicateDocumentGroups.length)} exact-text duplicate ${pluralize(duplicateDocumentGroups.length, "group")}. Example: ${duplicatePreview}.`,
      hint: "If these rows are meant to be separate, consider adding distinguishing metadata or document text. If they are duplicates, consider deduplication to save storage and improve retrieval quality.",
      count: duplicateDocumentRows,
    });
  }

  if (metadataTypeConflicts.length) {
    const conflictPreview = metadataTypeConflicts
      .slice(0, 3)
      .map((group) => `${group.key} (${group.types.join(", ")})`)
      .join("; ");

    addFinding({
      severity: metadataTypeConflicts.length >= 3 ? "medium" : "low",
      category: "Metadata consistency",
      title: "Metadata type drift detected",
      description: `${formatNumber(metadataTypeConflicts.length)} metadata ${pluralize(metadataTypeConflicts.length, "key")} use mixed value types across rows. Examples: ${conflictPreview}.`,
      hint: "Keep each metadata key stable across the collection, such as always string, always number, or always boolean.",
      count: metadataTypeConflicts.length,
    });
  }

  const embeddingSummary = metricsEmbeddingSummary.value;
  const pendingEmbeddingChecks = Boolean(
    totalRows && isLoadingMetricsEmbeddings.value,
  );

  if (embeddingSummary) {
    if (!embeddingSummary.returnedVectors) {
      addFinding({
        severity: "high",
        category: "Embedding coverage",
        title: "Sample returned no embeddings",
        description: `None of the ${formatNumber(embeddingSummary.sampleSize)} sampled rows returned an embedding vector.`,
        hint: "Backfill embeddings for existing rows or verify whether the collection is meant to store document-only records.",
        count: embeddingSummary.sampleSize,
      });
    } else {
      if (embeddingSummary.missingVectors > 0) {
        addFinding({
          severity:
            embeddingSummary.missingVectors / embeddingSummary.sampleSize >=
            0.25
              ? "high"
              : "medium",
          category: "Embedding coverage",
          title: "Sampled rows are missing embeddings",
          description: `${formatNumber(embeddingSummary.missingVectors)} of ${formatNumber(embeddingSummary.sampleSize)} sampled rows (${formatPercentage(embeddingSummary.missingVectors, embeddingSummary.sampleSize)}) returned no embedding vector.`,
          hint: "Backfill missing embeddings or verify whether some rows are intentionally document-only.",
          count: embeddingSummary.missingVectors,
        });
      }

      if (embeddingSummary.dimensionBreakdown.length > 1) {
        const dimensionPreview = embeddingSummary.dimensionBreakdown
          .slice(0, 3)
          .map(
            (dimensionStat) =>
              `${formatNumber(dimensionStat.dimension)} dims (${dimensionStat.coverageLabel})`,
          )
          .join(" · ");

        addFinding({
          severity: "high",
          category: "Embedding consistency",
          title: "Mixed embedding dimensions in sample",
          description: `The sampled embeddings do not share one vector size. Observed dimensions: ${dimensionPreview}.`,
          hint: "A single collection should usually use one embedding model and one dimension size.",
          count: embeddingSummary.dimensionBreakdown.length,
        });
      }

      if (embeddingSummary.zeroNormVectors > 0) {
        addFinding({
          severity:
            embeddingSummary.zeroNormVectors /
              embeddingSummary.returnedVectors >=
            0.25
              ? "medium"
              : "low",
          category: "Embedding health",
          title: "Zero-norm embeddings detected",
          description: `${formatNumber(embeddingSummary.zeroNormVectors)} sampled ${pluralize(embeddingSummary.zeroNormVectors, "vector")} ${embeddingSummary.zeroNormVectors === 1 ? "has" : "have"} a norm of 0.`,
          hint: "Zero-norm vectors have no direction and may indicate issues with the embedding model or the input data.",
          count: embeddingSummary.zeroNormVectors,
        });
      }
    }
  }

  findings.sort((leftFinding, rightFinding) => {
    if (
      severityRank[leftFinding.severity] !== severityRank[rightFinding.severity]
    ) {
      return (
        severityRank[leftFinding.severity] - severityRank[rightFinding.severity]
      );
    }

    if ((rightFinding.count ?? 0) !== (leftFinding.count ?? 0)) {
      return (rightFinding.count ?? 0) - (leftFinding.count ?? 0);
    }

    return leftFinding.title.localeCompare(rightFinding.title);
  });

  const highFindings = findings.filter(
    (finding) => finding.severity === "high",
  ).length;
  const reviewFindings = findings.filter(
    (finding) => finding.severity === "medium",
  ).length;
  const watchFindings = findings.filter(
    (finding) => finding.severity === "low",
  ).length;

  let statusLabel = "Healthy";
  let statusTone = "healthy";
  let statusDescription =
    "No issues were detected in the loaded rows and sampled embeddings.";

  if (pendingEmbeddingChecks && !findings.length) {
    statusLabel = "Auditing";
    statusTone = "idle";
    statusDescription = `Content and metadata checks are ready while embeddings sample up to ${formatNumber(METRICS_EMBEDDING_SAMPLE_SIZE)} rows.`;
  } else if (highFindings > 0) {
    statusLabel = "Needs attention";
    statusTone = "high";
    statusDescription = `${formatNumber(highFindings)} high-severity ${pluralize(highFindings, "issue")} should be fixed first.`;
  } else if (findings.length > 0) {
    statusLabel = "Needs review";
    statusTone = "medium";
    statusDescription = `${formatNumber(findings.length)} ${pluralize(findings.length, "finding")} were detected across content, metadata, or sampled embeddings.`;
  }

  return {
    statusLabel,
    statusTone,
    summaryCards: [
      {
        label: "Audit status",
        value: statusLabel,
        description: statusDescription,
        valueClass: `quality-audit-status quality-audit-status--${statusTone}`,
      },
      {
        label: "Findings",
        value: formatNumber(findings.length),
        description: findings.length
          ? `${formatNumber(highFindings)} high, ${formatNumber(reviewFindings)} review, ${formatNumber(watchFindings)} watch ${pluralize(watchFindings, "item")}.`
          : "No findings have been detected so far.",
      },
      {
        label: "Rows checked",
        value: formatNumber(totalRows),
        description:
          "Content and metadata checks use every loaded row in the current collection.",
      },
      {
        label: "Embedding sample",
        value: pendingEmbeddingChecks
          ? "Sampling"
          : embeddingSummary
            ? formatNumber(embeddingSummary.sampleSize)
            : "Pending",
        description: pendingEmbeddingChecks
          ? `Checking up to ${formatNumber(METRICS_EMBEDDING_SAMPLE_SIZE)} rows for missing or inconsistent vectors.`
          : embeddingSummary
            ? `${formatNumber(embeddingSummary.returnedVectors)} vectors returned in the sample.`
            : "Embedding checks start after the metrics sample loads.",
      },
    ],
    findings,
    emptyStateMessage: findings.length
      ? ""
      : "No audit findings detected in the loaded rows and sampled embeddings.",
    pendingEmbeddingChecks,
    pendingMessage: pendingEmbeddingChecks
      ? "Embedding checks are still running and may add more findings when the sample finishes loading."
      : "",
  };
});

const dashboardMetrics = computed(() => {
  return [
    {
      label: "Collections",
      value: formatNumber(collections.value.length),
      description: "All namespaces currently available in this workspace.",
    },
    {
      label: "Loaded rows",
      value: formatNumber(collectionMetrics.value.totalRows),
      description: currentCollection.value
        ? `Records currently loaded from ${currentCollection.value.name}.`
        : "Select a collection to load its records.",
    },
    {
      label: "Version",
      value: version.value || "Pending",
      description: "Detected from the live Chroma instance after connection.",
    },
    {
      label: "Connection",
      value: workspaceConnectionMetricLabel.value,
      description: `${tenant.value} / ${database.value}`,
    },
  ];
});

const hasQueryResults = computed(() => queryResults.value.length > 0);

const activeQueryWhereRules = computed(() => {
  return queryWhereRules.value.filter(isQueryWhereRuleComplete);
});

const activeQueryWhereDocumentRules = computed(() => {
  return queryWhereDocumentRules.value.filter(isQueryWhereDocumentRuleComplete);
});

const activeQueryFilterCount = computed(() => {
  return (
    activeQueryWhereRules.value.length +
    activeQueryWhereDocumentRules.value.length
  );
});

const queryFilterStatusLabel = computed(() => {
  return activeQueryFilterCount.value
    ? `${formatNumber(activeQueryFilterCount.value)} active`
    : "Optional";
});

const queryFilterStatusCopy = computed(() => {
  const activeFilterSections = [];

  if (activeQueryWhereRules.value.length) {
    activeFilterSections.push(
      `${formatNumber(activeQueryWhereRules.value.length)} where ${pluralize(activeQueryWhereRules.value.length, "rule")}`,
    );
  }

  if (activeQueryWhereDocumentRules.value.length) {
    activeFilterSections.push(
      `${formatNumber(activeQueryWhereDocumentRules.value.length)} where_document ${pluralize(activeQueryWhereDocumentRules.value.length, "rule")}`,
    );
  }

  if (!activeFilterSections.length) {
    return "Add metadata or document filters to narrow the candidate set before Chroma ranks results.";
  }

  return `Active query filters: ${activeFilterSections.join(" and ")}.`;
});

const currentCollectionEmbeddingDimension = computed(() => {
  if (!currentCollection.value) return null;

  return (
    collectionEmbeddingDimensions.value[currentCollection.value.id] ?? null
  );
});

const semanticProviderLabel = computed(() => {
  return semanticQuerySettings.value.provider === "ollama"
    ? "Ollama"
    : "OpenAI";
});

const semanticProviderModelLabel = computed(() => {
  return semanticQuerySettings.value.provider === "ollama"
    ? `${semanticQuerySettings.value.ollamaModel ?? ""}`.trim() ||
        "embeddinggemma"
    : `${semanticQuerySettings.value.openaiModel ?? ""}`.trim() ||
        "text-embedding-3-small";
});

const semanticProviderDimensionLabel = computed(() => {
  if (isResolvingCollectionEmbeddingDimension.value) {
    return "Detecting collection size";
  }

  if (currentCollectionEmbeddingDimension.value) {
    return `${formatNumber(currentCollectionEmbeddingDimension.value)} dims in collection`;
  }

  return "Collection size not detected yet";
});

const semanticProviderDimensionNote = computed(() => {
  if (isResolvingCollectionEmbeddingDimension.value) {
    return "Sampling stored embeddings from the active collection.";
  }

  if (currentCollectionEmbeddingDimension.value) {
    return "Detected automatically from sampled collection embeddings.";
  }

  return "This is detected automatically when the semantic query panel opens.";
});

const importActionLabel = computed(() => {
  return importMode.value === "upsert" ? "Run upsert" : "Add records";
});

const importSourceLabel = computed(() => {
  if (!importPayload.value.trim()) return "Paste a payload or upload a file.";

  return importFileName.value
    ? `Loaded from ${importFileName.value}`
    : "Using the current editor content.";
});

const currentCollectionQueryHistory = computed(() => {
  if (!currentCollection.value) return [];

  return queryHistory.value.filter(
    (entry) => entry.collectionId === currentCollection.value.id,
  );
});

const metadataFilterKeyOptions = computed(() => {
  const keySet = new Set();

  for (const row of currentCollectionData.value) {
    const metadataObject = getRowMetadataObject(row);

    if (!metadataObject) continue;

    for (const key of Object.keys(metadataObject)) {
      keySet.add(key);
    }
  }

  return Array.from(keySet).sort((leftKey, rightKey) =>
    leftKey.localeCompare(rightKey),
  );
});

const activeMetadataFilterRules = computed(() => {
  return metadataFilterRules.value.filter(isMetadataFilterRuleComplete);
});

const hasMetadataFilters = computed(
  () => activeMetadataFilterRules.value.length > 0,
);

const hasTableSearchFilter = computed(() => {
  return `${filters.value?.global?.value ?? ""}`.trim().length > 0;
});

const hasActiveTableFilters = computed(() => {
  return hasTableSearchFilter.value || hasMetadataFilters.value;
});

const filteredCollectionData = computed(() => {
  const globalFilterValue = `${filters.value?.global?.value ?? ""}`
    .trim()
    .toLowerCase();
  const activeMetadataRules = activeMetadataFilterRules.value;

  if (!globalFilterValue && !activeMetadataRules.length) {
    return currentCollectionData.value;
  }

  return currentCollectionData.value.filter((row) => {
    const matchesSearch =
      !globalFilterValue ||
      [row.id, row.document, row.metadata]
        .map((value) => `${value ?? ""}`.toLowerCase())
        .join(" ")
        .includes(globalFilterValue);

    if (!matchesSearch) {
      return false;
    }

    if (!activeMetadataRules.length) {
      return true;
    }

    const matchedRules = activeMetadataRules.filter((rule) =>
      doesMetadataFilterRuleMatch(row, rule),
    ).length;

    return metadataFilterMode.value === "any"
      ? matchedRules > 0
      : matchedRules === activeMetadataRules.length;
  });
});

const visibleTableRows = computed(() => {
  const processedRows = embeddingDataTable.value?.processedData;

  if (Array.isArray(processedRows) && processedRows.length) {
    return processedRows;
  }

  return filteredCollectionData.value;
});

const selectedTableRowIds = computed(() => {
  return selectedTableRows.value
    .map((row) => row?.id)
    .filter((id) => Boolean(id));
});

const selectedRows = computed(() => {
  if (!selectedTableRowIds.value.length) {
    return [];
  }

  const selectedIdSet = new Set(selectedTableRowIds.value);

  return currentCollectionData.value.filter((row) => selectedIdSet.has(row.id));
});

const selectedRowsCount = computed(() => selectedRows.value.length);

const selectedRowsLabel = computed(() => {
  return `${formatNumber(selectedRowsCount.value)} ${pluralize(selectedRowsCount.value, "row")} selected`;
});

const hasSelectedRows = computed(() => selectedRowsCount.value > 0);

const visibleRowsCount = computed(() => visibleTableRows.value.length);

const areAllVisibleRowsSelected = computed(() => {
  if (!visibleTableRows.value.length) {
    return false;
  }

  const selectedIdSet = new Set(selectedTableRowIds.value);

  return visibleTableRows.value.every((row) => selectedIdSet.has(row.id));
});

const canApplyBulkMetadata = computed(() => {
  if (bulkMetadataMode.value === "clear") {
    return hasSelectedRows.value;
  }

  return (
    hasSelectedRows.value &&
    `${bulkMetadataValue.value ?? ""}`.trim().length > 0
  );
});

const isRunningBulkRowAction = computed(() => {
  return isDeletingRows.value || isApplyingBulkMetadata.value;
});

const bulkMetadataPlaceholder = computed(() => {
  return bulkMetadataMode.value === "merge"
    ? '{"reviewed":true,"owner":"ops"}'
    : '{"source":"support","lang":"en"}';
});

const activeEmbeddingVector = computed(() => {
  if (!embeddingDialog.value.id) return [];

  return embeddingVectorCache.value[embeddingDialog.value.id] ?? [];
});

const activeEmbeddingPreview = computed(() => {
  if (!embeddingDialog.value.id) return null;

  return embeddingPreviewCache.value[embeddingDialog.value.id] ?? null;
});

const activeEmbeddingWindow = computed(() => {
  return activeEmbeddingVector.value.slice(
    embeddingDialogOffset.value,
    embeddingDialogOffset.value + EMBEDDING_DIALOG_WINDOW_SIZE,
  );
});

const activeEmbeddingWindowRange = computed(() => {
  if (!activeEmbeddingVector.value.length) {
    return "No values loaded";
  }

  const start = embeddingDialogOffset.value + 1;
  const end = Math.min(
    embeddingDialogOffset.value + EMBEDDING_DIALOG_WINDOW_SIZE,
    activeEmbeddingVector.value.length,
  );

  return `Showing ${formatNumber(start)}-${formatNumber(end)} of ${formatNumber(activeEmbeddingVector.value.length)} values`;
});

const activeEmbeddingChunks = computed(() => {
  return Array.from(
    {
      length: Math.ceil(
        activeEmbeddingWindow.value.length / EMBEDDING_DIALOG_CHUNK_SIZE,
      ),
    },
    (_, chunkIndex) => {
      const start =
        embeddingDialogOffset.value + chunkIndex * EMBEDDING_DIALOG_CHUNK_SIZE;
      const values = activeEmbeddingWindow.value
        .slice(
          chunkIndex * EMBEDDING_DIALOG_CHUNK_SIZE,
          (chunkIndex + 1) * EMBEDDING_DIALOG_CHUNK_SIZE,
        )
        .map((value) => formatEmbeddingNumber(value));

      return {
        start,
        end: start + values.length - 1,
        values,
      };
    },
  );
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

const storeQueryHistory = (historyItems) => {
  localStorage.setItem("query_history", JSON.stringify(historyItems));
};

const retrieveQueryHistory = () => {
  const storedQueryHistory = localStorage.getItem("query_history");
  if (!storedQueryHistory) return;

  try {
    const parsedHistory = JSON.parse(storedQueryHistory);
    queryHistory.value = Array.isArray(parsedHistory)
      ? parsedHistory.map((entry) => {
          const legacyWhereState = parseLegacyQueryWhereState(entry?.whereText);
          const legacyWhereDocumentState = parseLegacyQueryWhereDocumentState(
            entry?.whereDocumentText,
          );
          const storedWhereRules = normalizeStoredQueryWhereRules(
            entry?.whereRules,
          );
          const storedWhereDocumentRules =
            normalizeStoredQueryWhereDocumentRules(entry?.whereDocumentRules);

          return {
            ...entry,
            mode: entry?.mode === "embedding" ? "embedding" : "semantic",
            provider: entry?.provider === "ollama" ? "ollama" : "openai",
            whereText: `${entry?.whereText ?? ""}`.trim(),
            whereDocumentText: `${entry?.whereDocumentText ?? ""}`.trim(),
            whereMode:
              entry?.whereMode === "any"
                ? "any"
                : legacyWhereState.mode === "any"
                  ? "any"
                  : "all",
            whereRules: storedWhereRules.length
              ? storedWhereRules
              : legacyWhereState.rules,
            whereDocumentMode:
              entry?.whereDocumentMode === "any"
                ? "any"
                : legacyWhereDocumentState.mode === "any"
                  ? "any"
                  : "all",
            whereDocumentRules: storedWhereDocumentRules.length
              ? storedWhereDocumentRules
              : legacyWhereDocumentState.rules,
          };
        })
      : [];
  } catch (_) {
    queryHistory.value = [];
  }
};

const trimActivityDetailText = (value) => {
  const normalizedValue = `${value ?? ""}`;

  if (!normalizedValue) return "";

  return normalizedValue.length > ACTIVITY_LOG_DETAIL_VALUE_LIMIT
    ? `${normalizedValue.slice(0, ACTIVITY_LOG_DETAIL_VALUE_LIMIT)}\n…`
    : normalizedValue;
};

const buildActivityDetailValue = (value, format = "text") => {
  if (value === undefined) return "";

  if (format === "json") {
    return trimActivityDetailText(safeStringify(value, true));
  }

  if (format === "embedding") {
    if (!Array.isArray(value) || !value.length) {
      return "[]";
    }

    const previewValues = value
      .slice(0, ACTIVITY_LOG_EMBEDDING_PREVIEW_COUNT)
      .map((entry) => formatEmbeddingNumber(entry));

    return trimActivityDetailText(
      `dims: ${formatNumber(value.length)}\n[${previewValues.join(", ")}${value.length > ACTIVITY_LOG_EMBEDDING_PREVIEW_COUNT ? ", …" : ""}]`,
    );
  }

  if (value === null) {
    return "null";
  }

  const normalizedValue = `${value ?? ""}`;
  return trimActivityDetailText(
    normalizedValue.length ? normalizedValue : "(empty)",
  );
};

const buildActivityDetailChange = ({
  label,
  before,
  after,
  format = "text",
}) => {
  return {
    label: `${label ?? ""}`.trim(),
    before: buildActivityDetailValue(before, format),
    after: buildActivityDetailValue(after, format),
    format: format === "json" || format === "embedding" ? format : "text",
  };
};

const buildActivityRecordSnapshot = (record) => {
  if (!record) return null;

  const snapshot = {
    id: `${record?.id ?? ""}`.trim(),
  };

  if (hasRecordField(record, "document")) {
    snapshot.document = `${record?.document ?? ""}`;
  }

  if (hasRecordField(record, "metadata")) {
    snapshot.metadata = parseMetadataValue(record?.metadata);
  }

  if (hasRecordField(record, "embedding")) {
    snapshot.embedding = Array.isArray(record?.embedding)
      ? record.embedding.filter(
          (value) => typeof value === "number" && Number.isFinite(value),
        )
      : [];
  }

  return snapshot;
};

const buildActivityRecordDetailSection = ({
  title,
  beforeRecord = null,
  afterRecord = null,
  fields = ["document", "metadata", "embedding"],
}) => {
  const changes = [];

  if (
    fields.includes("document") &&
    ((beforeRecord && hasRecordField(beforeRecord, "document")) ||
      (afterRecord && hasRecordField(afterRecord, "document")))
  ) {
    changes.push(
      buildActivityDetailChange({
        label: "Document",
        before: beforeRecord?.document,
        after: afterRecord?.document,
      }),
    );
  }

  if (
    fields.includes("metadata") &&
    ((beforeRecord && hasRecordField(beforeRecord, "metadata")) ||
      (afterRecord && hasRecordField(afterRecord, "metadata")))
  ) {
    changes.push(
      buildActivityDetailChange({
        label: "Metadata",
        before: beforeRecord?.metadata,
        after: afterRecord?.metadata,
        format: "json",
      }),
    );
  }

  if (
    fields.includes("embedding") &&
    ((beforeRecord && hasRecordField(beforeRecord, "embedding")) ||
      (afterRecord && hasRecordField(afterRecord, "embedding")))
  ) {
    changes.push(
      buildActivityDetailChange({
        label: "Embedding",
        before: beforeRecord?.embedding,
        after: afterRecord?.embedding,
        format: "embedding",
      }),
    );
  }

  return {
    title:
      `${title ?? beforeRecord?.id ?? afterRecord?.id ?? "Record"}`.trim() ||
      "Record",
    changes,
  };
};

const buildCollectionActivityDetailSection = ({
  title = "Collection settings",
  beforeName,
  afterName,
  beforeMetadata,
  afterMetadata,
  includeAllFields = false,
}) => {
  const changes = [];

  if (includeAllFields || beforeName !== afterName) {
    changes.push(
      buildActivityDetailChange({
        label: "Name",
        before: beforeName,
        after: afterName,
      }),
    );
  }

  if (
    includeAllFields ||
    safeStringify(beforeMetadata) !== safeStringify(afterMetadata)
  ) {
    changes.push(
      buildActivityDetailChange({
        label: "Metadata",
        before: beforeMetadata,
        after: afterMetadata,
        format: "json",
      }),
    );
  }

  return changes.length
    ? {
        title,
        changes,
      }
    : null;
};

const normalizeActivityDetailChange = (change) => {
  const normalizedLabel = `${change?.label ?? ""}`.trim();
  const before = trimActivityDetailText(change?.before);
  const after = trimActivityDetailText(change?.after);

  if (!normalizedLabel || (!before && !after)) {
    return null;
  }

  return {
    label: normalizedLabel,
    before,
    after,
    format:
      change?.format === "json" || change?.format === "embedding"
        ? change.format
        : "text",
  };
};

const normalizeActivityDetailSection = (section) => {
  const changes = Array.isArray(section?.changes)
    ? section.changes
        .map(normalizeActivityDetailChange)
        .filter(Boolean)
        .slice(0, 4)
    : [];

  if (!changes.length) {
    return null;
  }

  return {
    title: `${section?.title ?? "Record"}`.trim() || "Record",
    changes,
  };
};

const normalizeActivityLogEntry = (entry) => {
  return {
    id:
      `${entry?.id ?? ""}`.trim() ||
      `activity-${Date.now()}-${(activityLogSequence += 1)}`,
    type: `${entry?.type ?? "event"}`.trim() || "event",
    title: `${entry?.title ?? "Activity"}`.trim() || "Activity",
    description: `${entry?.description ?? ""}`.trim(),
    timestamp: `${entry?.timestamp ?? new Date().toISOString()}`.trim(),
    workspaceKey: `${entry?.workspaceKey ?? ""}`.trim(),
    collectionId: `${entry?.collectionId ?? ""}`.trim(),
    collectionName: `${entry?.collectionName ?? ""}`.trim(),
    rowCount: Math.max(0, Number(entry?.rowCount) || 0),
    rowIds: Array.isArray(entry?.rowIds)
      ? entry.rowIds
          .map((id) => `${id ?? ""}`.trim())
          .filter(Boolean)
          .slice(0, ACTIVITY_LOG_ID_PREVIEW_LIMIT)
      : [],
    details: Array.isArray(entry?.details)
      ? entry.details
          .map(normalizeActivityDetailSection)
          .filter(Boolean)
          .slice(0, ACTIVITY_LOG_DETAIL_SECTION_LIMIT)
      : [],
    detailsOverflowCount: Math.max(0, Number(entry?.detailsOverflowCount) || 0),
    meta:
      entry?.meta && typeof entry.meta === "object" ? { ...entry.meta } : {},
  };
};

const buildWorkspaceActivityKey = (
  connectionUrl = url.value,
  connectionTenant = tenant.value,
  connectionDatabase = database.value,
) => {
  return [connectionUrl, connectionTenant, connectionDatabase]
    .map((value) => `${value ?? ""}`.trim())
    .join("::");
};

const currentWorkspaceActivityKey = computed(() => buildWorkspaceActivityKey());

const currentWorkspaceActivityLog = computed(() => {
  const activeWorkspaceKey = currentWorkspaceActivityKey.value;

  return activityLog.value.filter(
    (entry) => entry.workspaceKey === activeWorkspaceKey,
  );
});

const currentCollectionActivityLog = computed(() => {
  if (!currentCollection.value) {
    return [];
  }

  return currentWorkspaceActivityLog.value.filter(
    (entry) => entry.collectionId === currentCollection.value.id,
  );
});

const formatActivityTimestamp = (value) => formatQueryHistoryTimestamp(value);

const activityLogSummary = computed(() => {
  const workspaceEntries = currentWorkspaceActivityLog.value;
  const latestEntry = workspaceEntries[0] ?? null;
  const collectionsTouched = new Set(
    workspaceEntries
      .map((entry) => entry.collectionId || entry.collectionName)
      .filter(Boolean),
  ).size;

  return [
    {
      label: "Events",
      value: formatNumber(workspaceEntries.length),
      description: "Recent changes captured for this workspace.",
    },
    {
      label: "Collections",
      value: formatNumber(collectionsTouched),
      description: "Collections touched by the recent timeline.",
    },
    {
      label: "This collection",
      value: formatNumber(currentCollectionActivityLog.value.length),
      description: currentCollection.value
        ? `Events tied to ${currentCollection.value.name}.`
        : "Select a collection to focus the timeline.",
    },
    {
      label: "Latest change",
      value: latestEntry
        ? formatActivityTimestamp(latestEntry.timestamp)
        : "None",
      description: latestEntry
        ? latestEntry.title
        : "No activity has been logged yet.",
    },
  ];
});

const getActivityTypeLabel = (type) => {
  switch (type) {
    case "collection":
      return "Collection";
    case "delete":
      return "Delete";
    case "metadata":
      return "Metadata patch";
    case "edit":
      return "Row edit";
    case "embedding":
      return "Embedding edit";
    case "import":
      return "Import";
    case "create":
      return "Create";
    default:
      return "Activity";
  }
};

const getActivityIcon = (type) => {
  switch (type) {
    case "collection":
      return "pi pi-folder-open";
    case "delete":
      return "pi pi-trash";
    case "metadata":
      return "pi pi-pencil";
    case "edit":
      return "pi pi-file-edit";
    case "embedding":
      return "pi pi-chart-line";
    case "import":
      return "pi pi-upload";
    case "create":
      return "pi pi-plus-circle";
    default:
      return "pi pi-history";
  }
};

const getActivityModeLabel = (mode) => {
  switch (`${mode ?? ""}`.trim()) {
    case "upsert":
      return "Upsert";
    case "add":
      return "Add only";
    case "merge":
      return "Merge patch";
    case "replace":
      return "Replace all";
    case "clear":
      return "Clear metadata";
    default:
      return `${mode ?? ""}`.trim();
  }
};

const hasActivityDetails = (entry) => {
  return Array.isArray(entry?.details) && entry.details.length > 0;
};

const isActivityEntryExpanded = (entryId) => {
  return Boolean(expandedActivityEntries.value[entryId]);
};

const toggleActivityEntry = (entryId) => {
  if (!entryId) return;

  expandedActivityEntries.value = {
    ...expandedActivityEntries.value,
    [entryId]: !expandedActivityEntries.value[entryId],
  };
};

const storeActivityLog = (entries) => {
  let nextEntries = entries.slice(0, ACTIVITY_LOG_LIMIT);
  activityLog.value = nextEntries;

  while (true) {
    try {
      localStorage.setItem(
        ACTIVITY_LOG_STORAGE_KEY,
        JSON.stringify(nextEntries),
      );
      activityLog.value = nextEntries;
      return;
    } catch (_) {
      if (nextEntries.length <= 1) {
        activityLog.value = nextEntries.slice(0, 1);
        return;
      }

      nextEntries = nextEntries.slice(0, -1);
    }
  }
};

const retrieveActivityLog = () => {
  const storedActivityLog = localStorage.getItem(ACTIVITY_LOG_STORAGE_KEY);
  if (!storedActivityLog) return;

  try {
    const parsedEntries = JSON.parse(storedActivityLog);
    activityLog.value = Array.isArray(parsedEntries)
      ? parsedEntries
          .map(normalizeActivityLogEntry)
          .slice(0, ACTIVITY_LOG_LIMIT)
      : [];
  } catch (_) {
    activityLog.value = [];
  }
};

const appendActivityLogEntry = (entry) => {
  const normalizedEntry = normalizeActivityLogEntry({
    ...entry,
    workspaceKey: entry?.workspaceKey || currentWorkspaceActivityKey.value,
    timestamp: entry?.timestamp || new Date().toISOString(),
  });

  storeActivityLog([
    normalizedEntry,
    ...activityLog.value.filter(
      (activityEntry) => activityEntry.id !== normalizedEntry.id,
    ),
  ]);
};

const clearCurrentWorkspaceActivityLog = () => {
  const workspaceEntries = currentWorkspaceActivityLog.value;

  if (!workspaceEntries.length) return;

  const activeWorkspaceKey = currentWorkspaceActivityKey.value;
  const workspaceLabel =
    [tenant.value, database.value].filter(Boolean).join(" / ") ||
    "this workspace";
  const removedCount = workspaceEntries.length;

  confirm.require({
    message: `Clear ${formatNumber(removedCount)} ${pluralize(removedCount, "activity event")} from '${workspaceLabel}'?`,
    header: "Clear activity log?",
    icon: "pi pi-info-circle",
    rejectLabel: "Cancel",
    acceptLabel: "Clear log",
    rejectClass: "p-button-secondary p-button-outlined",
    acceptClass: "p-button-danger",
    acceptIcon: "pi pi-trash",
    accept: () => {
      expandedActivityEntries.value = {};
      storeActivityLog(
        activityLog.value.filter(
          (entry) => entry.workspaceKey !== activeWorkspaceKey,
        ),
      );

      toast.add({
        severity: "success",
        summary: "Activity log cleared",
        detail: `Removed ${formatNumber(removedCount)} ${pluralize(removedCount, "event")} from ${workspaceLabel}.`,
        life: 4000,
      });
    },
  });
};

const normalizeSemanticQuerySettings = (value) => ({
  provider: value?.provider === "ollama" ? "ollama" : "openai",
  openaiBaseUrl:
    `${value?.openaiBaseUrl ?? "https://api.openai.com/v1"}`.trim() ||
    "https://api.openai.com/v1",
  openaiModel:
    `${value?.openaiModel ?? "text-embedding-3-small"}`.trim() ||
    "text-embedding-3-small",
  openaiDimensions: `${value?.openaiDimensions ?? ""}`.trim(),
  ollamaBaseUrl:
    `${value?.ollamaBaseUrl ?? "http://localhost:11434"}`.trim() ||
    "http://localhost:11434",
  ollamaModel:
    `${value?.ollamaModel ?? "embeddinggemma"}`.trim() || "embeddinggemma",
});

const storeSemanticQuerySettings = (value) => {
  localStorage.setItem(
    SEMANTIC_QUERY_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeSemanticQuerySettings(value)),
  );
};

const retrieveSemanticQuerySettings = () => {
  const storedSettings = localStorage.getItem(
    SEMANTIC_QUERY_SETTINGS_STORAGE_KEY,
  );
  if (!storedSettings) return;

  try {
    semanticQuerySettings.value = normalizeSemanticQuerySettings(
      JSON.parse(storedSettings),
    );
  } catch (_) {
    semanticQuerySettings.value = normalizeSemanticQuerySettings(
      semanticQuerySettings.value,
    );
  }
};

watch(
  semanticQuerySettings,
  (nextSettings) => {
    storeSemanticQuerySettings(nextSettings);
  },
  { deep: true },
);

watch(
  currentCollectionData,
  (rows) => {
    if (!selectedTableRows.value.length) return;

    const rowIdSet = new Set(rows.map((row) => row.id));
    selectedTableRows.value = selectedTableRows.value.filter((row) =>
      rowIdSet.has(row.id),
    );
  },
  { deep: false },
);

watch(bulkMetadataMode, (nextMode) => {
  if (nextMode === "clear") {
    bulkMetadataValue.value = "";
  }
});

watch(
  [
    showQueryViewer,
    showImportViewer,
    showCreateRecordForm,
    queryMode,
    () => currentCollection.value?.id ?? null,
    () => currentCollectionData.value.length,
  ],
  async ([
    isQueryViewerOpen,
    isImportViewerOpen,
    isCreateRecordViewerOpen,
    activeQueryMode,
    activeCollectionId,
    loadedRows,
  ]) => {
    if (
      (!isQueryViewerOpen || activeQueryMode !== "semantic") &&
      !isImportViewerOpen &&
      !isCreateRecordViewerOpen
    ) {
      return;
    }

    if (!activeCollectionId || !loadedRows) {
      return;
    }

    await resolveCollectionEmbeddingDimension();
  },
);

const setSemanticProvider = (provider) => {
  semanticQuerySettings.value = {
    ...semanticQuerySettings.value,
    provider,
  };
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

const stopWorkspaceHealthCheck = () => {
  if (workspaceHealthCheckTimer) {
    window.clearInterval(workspaceHealthCheckTimer);
    workspaceHealthCheckTimer = null;
  }

  isCheckingWorkspaceHealth.value = false;
};

const checkWorkspaceHealth = async () => {
  if (
    !connected.value ||
    !apiUrl.value ||
    isInitializingConnection.value ||
    isCheckingWorkspaceHealth.value
  ) {
    return;
  }

  isCheckingWorkspaceHealth.value = true;

  if (workspaceHealthStatus.value !== "unreachable") {
    workspaceHealthStatus.value = "checking";
  }

  try {
    await axios.get(apiUrl.value, {
      timeout: WORKSPACE_HEALTH_CHECK_TIMEOUT,
    });

    if (connected.value) {
      workspaceHealthStatus.value = "live";
    }
  } catch (_) {
    if (connected.value) {
      workspaceHealthStatus.value = "unreachable";
    }
  } finally {
    isCheckingWorkspaceHealth.value = false;
  }
};

const startWorkspaceHealthCheck = () => {
  stopWorkspaceHealthCheck();

  if (!connected.value || !apiUrl.value) return;

  workspaceHealthStatus.value = "live";

  // Keep the workspace badge in sync if the Chroma server disappears.
  workspaceHealthCheckTimer = window.setInterval(() => {
    void checkWorkspaceHealth();
  }, WORKSPACE_HEALTH_CHECK_INTERVAL);
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
      collectionEmbeddingDimensions.value = {};
      resetTableFilters();
      resetEmbeddingViews();
      resetCreateRecordState();
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

const loadEmbeddingPreview = async (id) => {
  if (
    !currentCollection.value ||
    embeddingPreviewCache.value[id] ||
    loadingEmbeddingPreviewIds.value[id]
  ) {
    return;
  }

  loadingEmbeddingPreviewIds.value = {
    ...loadingEmbeddingPreviewIds.value,
    [id]: true,
  };

  try {
    const response = await axios.post(
      `${collectionBaseUrl.value}/${currentCollection.value.id}/get`,
      {
        ids: [id],
        include: ["embeddings"],
      },
    );

    const embedding = response.data?.embeddings?.[0] ?? null;

    if (!Array.isArray(embedding) || !embedding.length) {
      toast.add({
        severity: "warn",
        summary: "Embedding unavailable",
        detail: `No embedding values were returned for record ${id}.`,
        life: 5000,
      });

      return;
    }

    embeddingVectorCache.value = {
      ...embeddingVectorCache.value,
      [id]: embedding,
    };
    embeddingPreviewCache.value = {
      ...embeddingPreviewCache.value,
      [id]: buildEmbeddingPreview(embedding),
    };
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: `Unable to load embedding preview. Reason: ${getErrorMessage(error)}`,
      life: 5000,
    });
  } finally {
    const nextLoadingState = { ...loadingEmbeddingPreviewIds.value };
    delete nextLoadingState[id];
    loadingEmbeddingPreviewIds.value = nextLoadingState;
  }
};

const openEmbeddingDialog = async (id) => {
  embeddingDialog.value = { visible: true, id };
  embeddingDialogOffset.value = 0;

  if (!embeddingPreviewCache.value[id]) {
    await loadEmbeddingPreview(id);
  }
};

const closeEmbeddingDialog = () => {
  embeddingDialog.value = { visible: false, id: null };
  embeddingDialogOffset.value = 0;
};

const handleEmbeddingRowExpand = async (event) => {
  await loadEmbeddingPreview(event.data.id);
};

const moveEmbeddingDialogWindow = (direction) => {
  const nextOffset =
    embeddingDialogOffset.value + direction * EMBEDDING_DIALOG_WINDOW_SIZE;

  embeddingDialogOffset.value = Math.max(
    0,
    Math.min(
      nextOffset,
      Math.max(
        0,
        activeEmbeddingVector.value.length - EMBEDDING_DIALOG_WINDOW_SIZE,
      ),
    ),
  );
};

const copyActiveEmbedding = async () => {
  if (!activeEmbeddingVector.value.length || !navigator?.clipboard) return;

  try {
    await navigator.clipboard.writeText(
      JSON.stringify(activeEmbeddingVector.value),
    );

    toast.add({
      severity: "success",
      summary: "Copied",
      detail: "Embedding vector copied to the clipboard.",
      life: 3000,
    });
  } catch (_) {
    toast.add({
      severity: "error",
      summary: "Clipboard error",
      detail: "Unable to copy the embedding vector.",
      life: 4000,
    });
  }
};

const copyToClipboard = async (value, successDetail, errorDetail) => {
  if (!value || !navigator?.clipboard) return;

  try {
    await navigator.clipboard.writeText(value);
  } catch (_) {
    toast.add({
      severity: "error",
      summary: "Clipboard error",
      detail: errorDetail,
      life: 4000,
    });
  }
};

const copyCollectionId = async () => {
  await copyToClipboard(
    currentCollection.value?.id,
    "Collection ID copied to the clipboard.",
    "Unable to copy the collection ID.",
  );
};

const loadMetricsEmbeddingSummary = async () => {
  if (
    !currentCollection.value ||
    !currentCollectionData.value.length ||
    isLoadingMetricsEmbeddings.value
  ) {
    return;
  }

  const activeCollectionId = currentCollection.value.id;
  const sampledRows = sampleRows(
    currentCollectionData.value,
    METRICS_EMBEDDING_SAMPLE_SIZE,
  );

  if (!sampledRows.length) {
    metricsEmbeddingSummary.value = null;
    return;
  }

  isLoadingMetricsEmbeddings.value = true;

  try {
    const response = await axios.post(
      `${collectionBaseUrl.value}/${activeCollectionId}/get`,
      {
        ids: sampledRows.map((row) => row.id),
        include: ["embeddings"],
      },
    );
    const embeddings = Array.isArray(response.data?.embeddings)
      ? response.data.embeddings
      : [];
    const dimensionCounts = {};
    let returnedVectors = 0;
    let missingVectors = 0;
    let normTotal = 0;
    let zeroNormVectors = 0;
    let minNorm = Infinity;
    let maxNorm = 0;

    for (const embedding of embeddings) {
      if (!Array.isArray(embedding) || !embedding.length) {
        missingVectors += 1;
        continue;
      }

      returnedVectors += 1;
      dimensionCounts[embedding.length] =
        (dimensionCounts[embedding.length] ?? 0) + 1;

      const norm = Math.sqrt(
        embedding.reduce((total, value) => total + value * value, 0),
      );
      normTotal += norm;
      minNorm = Math.min(minNorm, norm);
      maxNorm = Math.max(maxNorm, norm);

      if (norm <= AUDIT_ZERO_NORM_THRESHOLD) {
        zeroNormVectors += 1;
      }
    }

    missingVectors += Math.max(0, sampledRows.length - embeddings.length);

    const dimensionBreakdown = Object.entries(dimensionCounts)
      .map(([dimension, count]) => ({
        dimension: Number(dimension),
        count,
        coverageLabel: formatPercentage(count, sampledRows.length),
      }))
      .sort((leftEntry, rightEntry) => rightEntry.count - leftEntry.count);

    metricsEmbeddingSummary.value = {
      sampleSize: sampledRows.length,
      returnedVectors,
      missingVectors,
      dominantDimension: dimensionBreakdown[0]?.dimension ?? null,
      averageNormLabel: returnedVectors
        ? formatEmbeddingNumber(normTotal / returnedVectors)
        : "n/a",
      minNormLabel: returnedVectors ? formatEmbeddingNumber(minNorm) : "n/a",
      maxNormLabel: returnedVectors ? formatEmbeddingNumber(maxNorm) : "n/a",
      zeroNormVectors,
      consistencyLabel: !returnedVectors
        ? "No embeddings returned in the sample."
        : dimensionBreakdown.length === 1 && !missingVectors
          ? "Dimensions are consistent across the sampled rows."
          : "Mixed dimensions or missing vectors detected in the sample.",
      dimensionBreakdown,
    };
  } catch (error) {
    metricsEmbeddingSummary.value = null;
    toast.add({
      severity: "error",
      summary: "Metrics unavailable",
      detail: `Unable to sample embedding metrics. Reason: ${getErrorMessage(error)}`,
      life: 5000,
    });
  } finally {
    isLoadingMetricsEmbeddings.value = false;
  }
};

const openMetricsViewer = async () => {
  if (!currentCollection.value) return;

  showMetricsViewer.value = true;
  metricsEmbeddingSummary.value = null;
  await loadMetricsEmbeddingSummary();
};

const formatQueryDistance = (distance) => {
  if (distance === null || distance === undefined) return "n/a";
  if (!Number.isFinite(distance)) return String(distance);
  return distance.toFixed(4);
};

const getQueryResultLabel = (result) => {
  if (result.matchType === "semantic") {
    return `distance ${formatQueryDistance(result.distance)}`;
  }

  return `distance ${formatQueryDistance(result.distance)}`;
};

const parseQueryEmbedding = (value) => {
  let parsedValue;

  try {
    parsedValue = JSON.parse(value);
  } catch (_) {
    throw new Error("Query embedding must be valid JSON.");
  }

  const vector = Array.isArray(parsedValue?.[0]) ? parsedValue[0] : parsedValue;

  if (!Array.isArray(vector)) {
    throw new Error("Query embedding must be a JSON array of numbers.");
  }

  if (
    !vector.every(
      (entry) => typeof entry === "number" && Number.isFinite(entry),
    )
  ) {
    throw new Error("Query embedding must only contain finite numeric values.");
  }

  return vector;
};

const parseQueryWhereRuleValue = (rule) => {
  const normalizedValueType = normalizeQueryWhereValueType(
    rule?.valueType,
    rule?.operator,
  );
  const trimmedValue = `${rule?.value ?? ""}`.trim();

  if (normalizedValueType === "boolean") {
    return trimmedValue === "false" ? false : true;
  }

  if (!trimmedValue) {
    throw new Error(
      "Complete or remove every metadata where rule before querying.",
    );
  }

  if (normalizedValueType === "number") {
    const parsedValue = Number(trimmedValue);

    if (!Number.isFinite(parsedValue)) {
      throw new Error(
        "Metadata where rules using numeric comparison need a valid number.",
      );
    }

    return parsedValue;
  }

  return trimmedValue;
};

const buildCompoundQueryFilter = (clauses, mode = "all") => {
  if (!clauses.length) {
    return null;
  }

  if (clauses.length === 1) {
    return clauses[0];
  }

  return {
    [mode === "any" ? "$or" : "$and"]: clauses,
  };
};

const buildQueryWhereFilter = () => {
  const clauses = activeQueryWhereRules.value.map((rule) => ({
    [`${rule.key ?? ""}`.trim()]: {
      [`$${rule.operator}`]: parseQueryWhereRuleValue(rule),
    },
  }));

  return buildCompoundQueryFilter(clauses, queryWhereMode.value);
};

const buildQueryWhereDocumentFilter = () => {
  const clauses = activeQueryWhereDocumentRules.value.map((rule) => {
    const trimmedValue = `${rule?.value ?? ""}`.trim();

    if (!trimmedValue) {
      throw new Error(
        "Complete or remove every where_document rule before querying.",
      );
    }

    return {
      [`$${rule.operator}`]: trimmedValue,
    };
  });

  return buildCompoundQueryFilter(clauses, queryWhereDocumentMode.value);
};

const buildStoredQueryWhereRules = () => {
  return activeQueryWhereRules.value.map((rule) => {
    const normalizedRule = createQueryWhereRule(rule);

    return {
      key: `${normalizedRule.key ?? ""}`.trim(),
      operator: normalizedRule.operator,
      valueType: normalizeQueryWhereValueType(
        normalizedRule.valueType,
        normalizedRule.operator,
      ),
      value: normalizeQueryWhereValue(
        normalizedRule.value,
        normalizeQueryWhereValueType(
          normalizedRule.valueType,
          normalizedRule.operator,
        ),
      ),
    };
  });
};

const buildStoredQueryWhereDocumentRules = () => {
  return activeQueryWhereDocumentRules.value.map((rule) => ({
    operator: rule.operator,
    value: `${rule.value ?? ""}`.trim(),
  }));
};

const getQueryFilterSummarySuffix = ({
  where = null,
  whereDocument = null,
} = {}) => {
  const activeFilters = [];

  if (where !== null) {
    activeFilters.push("where");
  }

  if (whereDocument !== null) {
    activeFilters.push("where_document");
  }

  return activeFilters.length ? ` - ${activeFilters.join(" + ")}` : "";
};

const getQueryHistoryFilterLabel = (entry) => {
  const labels = [];
  const whereRuleCount = Array.isArray(entry?.whereRules)
    ? entry.whereRules.length
    : `${entry?.whereText ?? ""}`.trim()
      ? 1
      : 0;
  const whereDocumentRuleCount = Array.isArray(entry?.whereDocumentRules)
    ? entry.whereDocumentRules.length
    : `${entry?.whereDocumentText ?? ""}`.trim()
      ? 1
      : 0;

  if (whereRuleCount) {
    labels.push(
      `${formatNumber(whereRuleCount)} where ${pluralize(whereRuleCount, "rule")}`,
    );
  }

  if (whereDocumentRuleCount) {
    labels.push(
      `${formatNumber(whereDocumentRuleCount)} where_document ${pluralize(whereDocumentRuleCount, "rule")}`,
    );
  }

  return labels.join(" • ");
};

const normalizeUrlBase = (value, fallbackValue) => {
  const trimmedValue = `${value ?? ""}`.trim();
  return (trimmedValue || fallbackValue).replace(/\/+$/, "");
};

const buildOpenAiEmbeddingsUrl = (baseUrl) => {
  const normalizedBaseUrl = normalizeUrlBase(
    baseUrl,
    "https://api.openai.com/v1",
  );

  return normalizedBaseUrl.endsWith("/embeddings")
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/embeddings`;
};

const buildOllamaEmbedUrl = (baseUrl) => {
  const normalizedBaseUrl = normalizeUrlBase(baseUrl, "http://localhost:11434");

  if (normalizedBaseUrl.endsWith("/api/embed")) {
    return normalizedBaseUrl;
  }

  if (normalizedBaseUrl.endsWith("/api")) {
    return `${normalizedBaseUrl}/embed`;
  }

  return `${normalizedBaseUrl}/api/embed`;
};

const parsePositiveInteger = (value, fieldLabel) => {
  const trimmedValue = `${value ?? ""}`.trim();
  if (!trimmedValue) return null;

  const parsedValue = Number(trimmedValue);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error(`${fieldLabel} must be a positive whole number.`);
  }

  return parsedValue;
};

const ensureEmbeddingVector = (embedding, errorLabel) => {
  if (
    !Array.isArray(embedding) ||
    !embedding.length ||
    !embedding.every(
      (entry) => typeof entry === "number" && Number.isFinite(entry),
    )
  ) {
    throw new Error(errorLabel);
  }

  return embedding;
};

const updateCollectionEmbeddingDimension = (collectionId, dimension) => {
  if (!collectionId || !Number.isInteger(dimension) || dimension < 1) return;

  collectionEmbeddingDimensions.value = {
    ...collectionEmbeddingDimensions.value,
    [collectionId]: dimension,
  };
};

const resolveCollectionEmbeddingDimension = async () => {
  if (!currentCollection.value) return null;

  const cachedDimension =
    collectionEmbeddingDimensions.value[currentCollection.value.id] ?? null;

  if (cachedDimension) {
    return cachedDimension;
  }

  const cachedVector = Object.values(embeddingVectorCache.value).find(
    (value) => Array.isArray(value) && value.length,
  );

  if (Array.isArray(cachedVector) && cachedVector.length) {
    updateCollectionEmbeddingDimension(
      currentCollection.value.id,
      cachedVector.length,
    );
    return cachedVector.length;
  }

  const sampleIds = currentCollectionData.value
    .slice(0, 8)
    .map((row) => row.id)
    .filter(Boolean);

  if (!sampleIds.length || isResolvingCollectionEmbeddingDimension.value) {
    return null;
  }

  isResolvingCollectionEmbeddingDimension.value = true;

  try {
    const response = await axios.post(
      `${collectionBaseUrl.value}/${currentCollection.value.id}/get`,
      {
        ids: sampleIds,
        include: ["embeddings"],
      },
    );

    const detectedDimensions = (response.data?.embeddings ?? [])
      .filter((embedding) => Array.isArray(embedding) && embedding.length)
      .map((embedding) => embedding.length);

    if (!detectedDimensions.length) {
      return null;
    }

    const dimensionCounts = detectedDimensions.reduce((counts, dimension) => {
      counts[dimension] = (counts[dimension] ?? 0) + 1;
      return counts;
    }, {});
    const resolvedDimension = Number(
      Object.entries(dimensionCounts).sort((leftEntry, rightEntry) => {
        if (rightEntry[1] !== leftEntry[1]) {
          return rightEntry[1] - leftEntry[1];
        }

        return Number(leftEntry[0]) - Number(rightEntry[0]);
      })[0]?.[0] ?? 0,
    );

    if (resolvedDimension > 0) {
      updateCollectionEmbeddingDimension(
        currentCollection.value.id,
        resolvedDimension,
      );
      return resolvedDimension;
    }

    return null;
  } finally {
    isResolvingCollectionEmbeddingDimension.value = false;
  }
};

const generateOpenAiQueryEmbedding = async (
  queryValue,
  expectedDimension,
  usageLabel = "running a semantic query",
) => {
  const apiKey = `${semanticQueryApiKey.value ?? ""}`.trim();
  if (!apiKey) {
    throw new Error(`Enter an OpenAI API key before ${usageLabel}.`);
  }

  const model =
    `${semanticQuerySettings.value.openaiModel ?? ""}`.trim() ||
    "text-embedding-3-small";
  const dimensions = parsePositiveInteger(
    semanticQuerySettings.value.openaiDimensions,
    "OpenAI dimensions",
  );
  const requestedDimensions = dimensions ?? expectedDimension ?? null;
  const response = await axios.post(
    buildOpenAiEmbeddingsUrl(semanticQuerySettings.value.openaiBaseUrl),
    {
      model,
      input: queryValue,
      ...(requestedDimensions ? { dimensions: requestedDimensions } : {}),
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  const embedding = ensureEmbeddingVector(
    response.data?.data?.[0]?.embedding,
    "OpenAI did not return a usable embedding vector.",
  );

  if (expectedDimension && embedding.length !== expectedDimension) {
    throw new Error(
      `Embedding dimension mismatch. The active collection expects ${expectedDimension} values, but ${model} returned ${embedding.length}.`,
    );
  }

  return {
    embedding,
    provider: "openai",
    providerLabel: "OpenAI",
    providerModel: model,
  };
};

const generateOllamaQueryEmbedding = async (queryValue, expectedDimension) => {
  const model =
    `${semanticQuerySettings.value.ollamaModel ?? ""}`.trim() ||
    "embeddinggemma";
  const response = await axios.post(
    buildOllamaEmbedUrl(semanticQuerySettings.value.ollamaBaseUrl),
    {
      model,
      input: queryValue,
    },
  );

  const embedding = ensureEmbeddingVector(
    response.data?.embeddings?.[0] ?? response.data?.embedding,
    "Ollama did not return a usable embedding vector.",
  );

  if (expectedDimension && embedding.length !== expectedDimension) {
    throw new Error(
      `Embedding dimension mismatch. The active collection expects ${expectedDimension} values, but ${model} returned ${embedding.length}.`,
    );
  }

  return {
    embedding,
    provider: "ollama",
    providerLabel: "Ollama",
    providerModel: model,
  };
};

const generateSemanticQueryEmbedding = async (queryValue) => {
  return generateSemanticEmbedding(queryValue, {
    usageLabel: "running a semantic query",
  });
};

const generateSemanticEmbedding = async (
  inputValue,
  { expectedDimension = undefined, usageLabel = "generating embeddings" } = {},
) => {
  const normalizedInput = `${inputValue ?? ""}`.trim();

  if (!normalizedInput) {
    throw new Error("Embedding source text cannot be empty.");
  }

  const resolvedExpectedDimension =
    expectedDimension === undefined
      ? await resolveCollectionEmbeddingDimension()
      : expectedDimension;

  if (semanticQuerySettings.value.provider === "ollama") {
    return generateOllamaQueryEmbedding(
      normalizedInput,
      resolvedExpectedDimension ?? null,
    );
  }

  return generateOpenAiQueryEmbedding(
    normalizedInput,
    resolvedExpectedDimension ?? null,
    usageLabel,
  );
};

const ensureRecordsHaveEmbeddings = async (
  records,
  usageLabel = "generating embeddings",
) => {
  if (!Array.isArray(records) || !records.length) {
    return {
      records: [],
      generatedCount: 0,
    };
  }

  let expectedDimension = await resolveCollectionEmbeddingDimension();
  let generatedCount = 0;
  const recordsWithEmbeddings = [];

  for (let recordIndex = 0; recordIndex < records.length; recordIndex += 1) {
    const record = records[recordIndex];
    const recordLabel = `Record ${recordIndex + 1}`;

    if (hasRecordField(record, "embedding")) {
      const validatedEmbedding = ensureEmbeddingVector(
        record.embedding,
        `${recordLabel} has an invalid embedding vector.`,
      );

      if (
        expectedDimension !== null &&
        expectedDimension !== undefined &&
        validatedEmbedding.length !== expectedDimension
      ) {
        throw new Error(
          `${recordLabel} embedding dimension mismatch. Expected ${expectedDimension} values but received ${validatedEmbedding.length}.`,
        );
      }

      expectedDimension ??= validatedEmbedding.length;
      recordsWithEmbeddings.push({
        ...record,
        embedding: validatedEmbedding,
      });
      continue;
    }

    const sourceDocument = `${record.document ?? ""}`.trim();

    if (!sourceDocument) {
      throw new Error(
        `Record needs either an embedding or a non-empty document for auto-embedding.`,
      );
    }

    const generatedEmbedding = await generateSemanticEmbedding(sourceDocument, {
      expectedDimension,
      usageLabel,
    });

    expectedDimension ??= generatedEmbedding.embedding.length;
    generatedCount += 1;
    recordsWithEmbeddings.push({
      ...record,
      embedding: generatedEmbedding.embedding,
    });
  }

  if (currentCollection.value && expectedDimension) {
    updateCollectionEmbeddingDimension(
      currentCollection.value.id,
      expectedDimension,
    );
  }

  return {
    records: recordsWithEmbeddings,
    generatedCount,
  };
};

const executeVectorQuery = async (
  embedding,
  resultCount,
  matchType,
  { where = null, whereDocument = null } = {},
) => {
  if (!currentCollection.value) return;

  const queryPayload = {
    query_embeddings: [embedding],
    n_results: resultCount,
    include: ["documents", "metadatas", "distances"],
    ...(where !== null ? { where } : {}),
    ...(whereDocument !== null ? { where_document: whereDocument } : {}),
  };

  const response = await axios.post(
    `${collectionBaseUrl.value}/${currentCollection.value.id}/query`,
    queryPayload,
  );

  const ids = response.data?.ids?.[0] ?? [];
  const documents = response.data?.documents?.[0] ?? [];
  const metadatas = response.data?.metadatas?.[0] ?? [];
  const distances = response.data?.distances?.[0] ?? [];

  queryResults.value = ids.map((id, index) => ({
    id,
    document: documents[index] ?? "",
    metadata: safeStringify(metadatas[index], true),
    distance: distances[index],
    matchType,
  }));
};

const appendQueryHistoryEntry = (entry) => {
  const nextHistory = [
    entry,
    ...queryHistory.value.filter(
      (historyEntry) => historyEntry.id !== entry.id,
    ),
  ].slice(0, QUERY_HISTORY_LIMIT);

  queryHistory.value = nextHistory;
  storeQueryHistory(nextHistory);
};

const scrollToQueryResults = async () => {
  await nextTick();

  if (!showQueryViewer.value || !queryResultsSection.value) return;

  queryResultsSection.value.scrollIntoView({
    behavior: "smooth",
    block: "start",
    inline: "nearest",
  });
};

const clearCurrentCollectionQueryHistory = () => {
  if (!currentCollection.value) return;

  queryHistory.value = queryHistory.value.filter(
    (entry) => entry.collectionId !== currentCollection.value.id,
  );
  storeQueryHistory(queryHistory.value);
};

const applyQueryHistoryEntry = (entry) => {
  queryMode.value = entry.mode === "embedding" ? "embedding" : "semantic";
  queryResultCount.value = entry.resultCount;
  queryText.value = entry.mode === "embedding" ? "" : entry.value;
  queryEmbedding.value = entry.mode === "embedding" ? entry.value : "";
  queryWhereMode.value = entry?.whereMode === "any" ? "any" : "all";
  queryWhereRules.value = normalizeStoredQueryWhereRules(entry?.whereRules);
  queryWhereDocumentMode.value =
    entry?.whereDocumentMode === "any" ? "any" : "all";
  queryWhereDocumentRules.value = normalizeStoredQueryWhereDocumentRules(
    entry?.whereDocumentRules,
  );
  showQueryFilters.value = Boolean(
    queryWhereRules.value.length || queryWhereDocumentRules.value.length,
  );
  lastQuerySummary.value = entry.summary;

  if (entry.mode === "embedding") {
    return;
  }

  if (entry.provider === "ollama") {
    semanticQuerySettings.value = {
      ...semanticQuerySettings.value,
      provider: "ollama",
      ollamaModel:
        entry.providerModel || semanticQuerySettings.value.ollamaModel,
    };
    return;
  }

  semanticQuerySettings.value = {
    ...semanticQuerySettings.value,
    provider: "openai",
    openaiModel: entry.providerModel || semanticQuerySettings.value.openaiModel,
  };
};

const rerunQueryHistoryEntry = async (entry) => {
  applyQueryHistoryEntry(entry);
  await runCollectionQuery();
};

const updateImportPayload = (value, source = "manual") => {
  importPayload.value = value;

  if (source !== "file") {
    importFileName.value = "";

    if (source === "manual" && importFileInput.value) {
      importFileInput.value.value = "";
    }
  }
};

const triggerImportFilePicker = () => {
  importFileInput.value?.click?.();
};

const clearImportedFile = () => {
  importFileName.value = "";

  if (importFileInput.value) {
    importFileInput.value.value = "";
  }
};

const handleImportFileSelection = async (event) => {
  const selectedFile = event?.target?.files?.[0];

  if (!selectedFile) return;

  const normalizedName = selectedFile.name.toLowerCase();
  const isSupportedFile = normalizedName.endsWith(".json");

  if (!isSupportedFile) {
    clearImportedFile();
    toast.add({
      severity: "error",
      summary: "Unsupported file",
      detail: "Choose a .json file for import.",
      life: 5000,
    });
    return;
  }

  try {
    const fileText = await selectedFile.text();
    updateImportPayload(fileText, "file");
    importFileName.value = selectedFile.name;

    toast.add({
      severity: "success",
      summary: "File loaded",
      detail: `${selectedFile.name} has been loaded.`,
      life: 3000,
    });
  } catch (_) {
    clearImportedFile();
    toast.add({
      severity: "error",
      summary: "Read failed",
      detail: `Unable to read ${selectedFile.name}.`,
      life: 5000,
    });
  }
};

const loadImportExample = () => {
  updateImportPayload(IMPORT_EXAMPLE_PAYLOAD, "example");
};

const parseImportRecords = (value) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error("Paste a JSON array or a single object before importing.");
  }

  let parsedValue;

  if (trimmedValue.startsWith("[")) {
    parsedValue = JSON.parse(trimmedValue);
  } else if (trimmedValue.startsWith("{")) {
    const parsedObject = JSON.parse(trimmedValue);
    parsedValue = Array.isArray(parsedObject?.records)
      ? parsedObject.records
      : [parsedObject];
  } else {
    parsedValue = trimmedValue
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  if (!Array.isArray(parsedValue) || !parsedValue.length) {
    throw new Error("The import payload must resolve to at least one record.");
  }

  const seenIds = new Set();

  return parsedValue.map((record, index) => {
    const rowNumber = index + 1;

    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error(`Record ${rowNumber} must be a JSON object.`);
    }

    const id =
      typeof record.id === "string"
        ? record.id.trim()
        : `${record.id ?? ""}`.trim();

    if (!id) {
      throw new Error(`Record ${rowNumber} is missing a valid id.`);
    }

    if (seenIds.has(id)) {
      throw new Error(`Duplicate id '${id}' found in the import payload.`);
    }

    seenIds.add(id);

    const normalizedRecord = { id };

    if (hasRecordField(record, "document")) {
      if (
        record.document !== null &&
        record.document !== undefined &&
        typeof record.document !== "string"
      ) {
        throw new Error(
          `Record ${rowNumber} has a document that is not a string.`,
        );
      }

      if (typeof record.document === "string") {
        normalizedRecord.document = record.document;
      }
    }

    if (hasRecordField(record, "embedding")) {
      if (record.embedding !== null && record.embedding !== undefined) {
        if (
          !Array.isArray(record.embedding) ||
          !record.embedding.every(
            (entry) => typeof entry === "number" && Number.isFinite(entry),
          )
        ) {
          throw new Error(
            `Record ${rowNumber} has an embedding that is not a JSON array of finite numbers.`,
          );
        }

        normalizedRecord.embedding = record.embedding;
      }
    }

    if (hasRecordField(record, "metadata")) {
      if (
        record.metadata !== null &&
        (typeof record.metadata !== "object" || Array.isArray(record.metadata))
      ) {
        throw new Error(
          `Record ${rowNumber} metadata must be an object or null.`,
        );
      }

      normalizedRecord.metadata = record.metadata;
    }

    if (
      !hasRecordField(normalizedRecord, "embedding") &&
      `${normalizedRecord.document ?? ""}`.trim().length === 0
    ) {
      throw new Error(
        `Record ${rowNumber} needs either an embedding or a non-empty document for auto-embedding.`,
      );
    }

    return normalizedRecord;
  });
};

const buildImportPayloadGroups = (records) => {
  const payloadGroups = new Map();

  for (const record of records) {
    const key = [
      hasRecordField(record, "document") ? "d" : "",
      hasRecordField(record, "embedding") ? "e" : "",
      hasRecordField(record, "metadata") ? "m" : "",
    ].join("");

    if (!payloadGroups.has(key)) {
      payloadGroups.set(key, {
        ids: [],
        embeddings: hasRecordField(record, "embedding") ? [] : null,
        documents: hasRecordField(record, "document") ? [] : null,
        metadatas: hasRecordField(record, "metadata") ? [] : null,
        uris: null,
      });
    }

    const payloadGroup = payloadGroups.get(key);
    payloadGroup.ids.push(record.id);

    if (hasRecordField(record, "document")) {
      payloadGroup.documents.push(record.document);
    }

    if (hasRecordField(record, "embedding")) {
      payloadGroup.embeddings.push(record.embedding);
    }

    if (hasRecordField(record, "metadata")) {
      payloadGroup.metadatas.push(record.metadata);
    }
  }

  return Array.from(payloadGroups.values());
};

const handleImportRecords = async () => {
  if (!currentCollection.value || isImportingRecords.value) return;

  let parsedRecords;
  let recordsWithEmbeddings;
  let generatedEmbeddingCount = 0;

  try {
    parsedRecords = parseImportRecords(importPayload.value);
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Invalid import payload",
      detail: error.message,
      life: 5000,
    });
    return;
  }

  isImportingRecords.value = true;

  try {
    const preparedRecords = await ensureRecordsHaveEmbeddings(
      parsedRecords,
      "auto-embedding documents during import",
    );
    recordsWithEmbeddings = preparedRecords.records;
    generatedEmbeddingCount = preparedRecords.generatedCount;
    const payloadGroups = buildImportPayloadGroups(recordsWithEmbeddings);
    const activeCollectionId = currentCollection.value.id;
    const isAddOnly = importMode.value === "add";
    const endpoint = isAddOnly ? "add" : "upsert";
    const successVerb = isAddOnly ? "Added" : "Upserted";
    const importIds = recordsWithEmbeddings.map((record) => record.id);

    if (isAddOnly) {
      const existingIds = new Set(
        currentCollectionData.value.map((record) => record.id),
      );
      const duplicateIds = recordsWithEmbeddings
        .map((record) => record.id)
        .filter((id) => existingIds.has(id));

      if (duplicateIds.length) {
        const previewIds = duplicateIds.slice(0, 3).join(", ");
        const remainingCount =
          duplicateIds.length - Math.min(duplicateIds.length, 3);

        toast.add({
          severity: "error",
          summary: "Duplicate record IDs",
          detail: `Add only cannot import records that already exist. Duplicate IDs: ${previewIds}${remainingCount > 0 ? ` and ${remainingCount} more` : ""}. Use Upsert if you want to overwrite existing rows.`,
          life: 7000,
        });
        return;
      }
    }

    for (const payloadGroup of payloadGroups) {
      await axios.post(
        `${collectionBaseUrl.value}/${activeCollectionId}/${endpoint}`,
        payloadGroup,
      );
    }

    toast.add({
      severity: "success",
      summary: "Import complete",
      detail: `${successVerb} ${formatNumber(recordsWithEmbeddings.length)} records${generatedEmbeddingCount ? ` with ${formatNumber(generatedEmbeddingCount)} auto-generated embedding${generatedEmbeddingCount === 1 ? "" : "s"}` : ""}.`,
      life: 5000,
    });

    const importDetails = recordsWithEmbeddings
      .slice(0, ACTIVITY_LOG_DETAIL_SECTION_LIMIT)
      .map((record) =>
        buildActivityRecordDetailSection({
          title: record.id,
          afterRecord: buildActivityRecordSnapshot(record),
        }),
      );

    appendActivityLogEntry({
      type: "import",
      title: `${successVerb} ${formatNumber(recordsWithEmbeddings.length)} ${pluralize(recordsWithEmbeddings.length, "row")}`,
      description: `${successVerb} records into ${currentCollection.value.name}${generatedEmbeddingCount ? ` with ${formatNumber(generatedEmbeddingCount)} auto-generated embedding${generatedEmbeddingCount === 1 ? "" : "s"}` : ""}.`,
      collectionId: currentCollection.value.id,
      collectionName: currentCollection.value.name,
      rowCount: recordsWithEmbeddings.length,
      rowIds: importIds,
      details: importDetails,
      detailsOverflowCount: Math.max(
        0,
        recordsWithEmbeddings.length - importDetails.length,
      ),
      meta: {
        mode: importMode.value,
        generatedEmbeddingCount,
      },
    });

    resetImportState();
    await retrieveCollections();

    if (currentCollection.value) {
      await handleCollectionSelection(currentCollection.value, true);
    }
  } catch (error) {
    toast.add({
      severity: "error",
      summary: recordsWithEmbeddings
        ? "Import failed"
        : "Import preparation failed",
      detail: recordsWithEmbeddings
        ? `Unable to import records. Reason: ${getErrorMessage(error)}`
        : error.message,
      life: 6000,
    });
  } finally {
    isImportingRecords.value = false;
  }
};

const parseEmbeddingDraft = (draft, expectedDimensions = null) => {
  let parsedValue;

  try {
    parsedValue = JSON.parse(draft);
  } catch (_) {
    throw new Error("Embedding must be valid JSON.");
  }

  if (!Array.isArray(parsedValue)) {
    throw new Error("Embedding must be a JSON array of numbers.");
  }

  if (
    !parsedValue.every(
      (value) => typeof value === "number" && Number.isFinite(value),
    )
  ) {
    throw new Error("Embedding must only contain finite numeric values.");
  }

  if (
    expectedDimensions !== null &&
    expectedDimensions !== undefined &&
    parsedValue.length !== expectedDimensions
  ) {
    throw new Error(
      `Embedding dimension mismatch. Expected ${expectedDimensions} values but received ${parsedValue.length}.`,
    );
  }

  return parsedValue;
};

const startEmbeddingEdit = async (id) => {
  if (!id) return;

  if (!embeddingVectorCache.value[id]) {
    await loadEmbeddingPreview(id);
  }

  const currentVector = embeddingVectorCache.value[id];

  if (!Array.isArray(currentVector) || !currentVector.length) return;

  embeddingEditorDrafts.value = {
    ...embeddingEditorDrafts.value,
    [id]: JSON.stringify(currentVector, null, 2),
  };
  editingEmbeddingIds.value = {
    ...editingEmbeddingIds.value,
    [id]: true,
  };
};

const cancelEmbeddingEdit = (id) => {
  const nextEditingState = { ...editingEmbeddingIds.value };
  delete nextEditingState[id];
  editingEmbeddingIds.value = nextEditingState;

  const nextDrafts = { ...embeddingEditorDrafts.value };
  delete nextDrafts[id];
  embeddingEditorDrafts.value = nextDrafts;
};

const saveEmbedding = async (id) => {
  if (!currentCollection.value || isSavingEmbedding(id)) return;

  const currentPreview = getEmbeddingPreview(id);
  const previousEmbedding = Array.isArray(embeddingVectorCache.value[id])
    ? [...embeddingVectorCache.value[id]]
    : undefined;
  let parsedEmbedding;

  try {
    parsedEmbedding = parseEmbeddingDraft(
      getEmbeddingDraft(id),
      currentPreview?.dimensions ?? null,
    );
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Invalid embedding",
      detail: error.message,
      life: 5000,
    });
    return;
  }

  savingEmbeddingIds.value = {
    ...savingEmbeddingIds.value,
    [id]: true,
  };

  try {
    await axios.post(
      `${collectionBaseUrl.value}/${currentCollection.value.id}/update`,
      {
        ids: [id],
        embeddings: [parsedEmbedding],
      },
    );

    embeddingVectorCache.value = {
      ...embeddingVectorCache.value,
      [id]: parsedEmbedding,
    };
    embeddingPreviewCache.value = {
      ...embeddingPreviewCache.value,
      [id]: buildEmbeddingPreview(parsedEmbedding),
    };

    toast.add({
      severity: "success",
      summary: "Embedding updated",
      detail: `Vector values for ${id} were saved.`,
      life: 3500,
    });

    appendActivityLogEntry({
      type: "embedding",
      title: `Updated embedding for ${id}`,
      description: `Saved a revised vector for ${id} in ${currentCollection.value.name}.`,
      collectionId: currentCollection.value.id,
      collectionName: currentCollection.value.name,
      rowCount: 1,
      rowIds: [id],
      details: [
        buildActivityRecordDetailSection({
          title: id,
          beforeRecord: buildActivityRecordSnapshot({
            id,
            ...(Array.isArray(previousEmbedding)
              ? { embedding: previousEmbedding }
              : {}),
          }),
          afterRecord: buildActivityRecordSnapshot({
            id,
            embedding: parsedEmbedding,
          }),
          fields: ["embedding"],
        }),
      ],
    });

    cancelEmbeddingEdit(id);
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: `Unable to update embedding. Reason: ${getErrorMessage(error)}`,
      life: 5000,
    });
  } finally {
    const nextSavingState = { ...savingEmbeddingIds.value };
    delete nextSavingState[id];
    savingEmbeddingIds.value = nextSavingState;
  }
};

const runCollectionQuery = async () => {
  if (!currentCollection.value || isQueryingCollection.value) return;

  const resultCount = Math.max(1, Number(queryResultCount.value) || 5);
  let historyEntry = null;
  let parsedWhere = null;
  let parsedWhereDocument = null;
  let normalizedWhereText = "";
  let normalizedWhereDocumentText = "";
  let storedWhereRules = [];
  let storedWhereDocumentRules = [];

  if (queryMode.value === "semantic" && !queryText.value.trim()) {
    toast.add({
      severity: "error",
      summary: "Missing semantic query",
      detail: "Enter text before running a semantic search.",
      life: 4000,
    });
    return;
  }

  if (queryWhereRules.value.some((rule) => !isQueryWhereRuleComplete(rule))) {
    toast.add({
      severity: "error",
      summary: "Invalid query filter",
      detail: "Complete or remove each metadata where rule before querying.",
      life: 5000,
    });
    return;
  }

  if (
    queryWhereDocumentRules.value.some(
      (rule) => !isQueryWhereDocumentRuleComplete(rule),
    )
  ) {
    toast.add({
      severity: "error",
      summary: "Invalid query filter",
      detail: "Complete or remove each where_document rule before querying.",
      life: 5000,
    });
    return;
  }

  try {
    parsedWhere = buildQueryWhereFilter();
    parsedWhereDocument = buildQueryWhereDocumentFilter();
    normalizedWhereText =
      parsedWhere === null ? "" : safeStringify(parsedWhere, false);
    normalizedWhereDocumentText =
      parsedWhereDocument === null
        ? ""
        : safeStringify(parsedWhereDocument, false);
    storedWhereRules = buildStoredQueryWhereRules();
    storedWhereDocumentRules = buildStoredQueryWhereDocumentRules();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Invalid query filter",
      detail: error.message,
      life: 5000,
    });
    return;
  }

  if (queryMode.value === "embedding") {
    try {
      parseQueryEmbedding(queryEmbedding.value);
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Invalid query embedding",
        detail: error.message,
        life: 5000,
      });
      return;
    }
  }

  isQueryingCollection.value = true;

  try {
    if (queryMode.value === "semantic") {
      const trimmedQueryText = queryText.value.trim();
      const generatedQuery =
        await generateSemanticQueryEmbedding(trimmedQueryText);
      const filterSummarySuffix = getQueryFilterSummarySuffix({
        where: parsedWhere,
        whereDocument: parsedWhereDocument,
      });

      lastQuerySummary.value = `Semantic query - ${generatedQuery.providerLabel} - ${generatedQuery.providerModel} - ${formatNumber(generatedQuery.embedding.length)} dims${filterSummarySuffix}`;
      historyEntry = {
        id: `${currentCollection.value.id}:semantic:${generatedQuery.provider}:${generatedQuery.providerModel}:${trimmedQueryText.toLowerCase()}:${resultCount}:${normalizedWhereText}:${normalizedWhereDocumentText}`,
        collectionId: currentCollection.value.id,
        collectionName: currentCollection.value.name,
        mode: "semantic",
        value: trimmedQueryText,
        preview: truncateText(trimmedQueryText, 72),
        provider: generatedQuery.provider,
        providerModel: generatedQuery.providerModel,
        whereMode: queryWhereMode.value,
        whereRules: storedWhereRules,
        whereText: normalizedWhereText,
        whereDocumentMode: queryWhereDocumentMode.value,
        whereDocumentRules: storedWhereDocumentRules,
        whereDocumentText: normalizedWhereDocumentText,
        resultCount,
        summary: lastQuerySummary.value,
        timestamp: new Date().toISOString(),
      };

      await executeVectorQuery(
        generatedQuery.embedding,
        resultCount,
        "semantic",
        {
          where: parsedWhere,
          whereDocument: parsedWhereDocument,
        },
      );
      updateCollectionEmbeddingDimension(
        currentCollection.value.id,
        generatedQuery.embedding.length,
      );
    } else {
      const parsedEmbedding = parseQueryEmbedding(queryEmbedding.value);
      const filterSummarySuffix = getQueryFilterSummarySuffix({
        where: parsedWhere,
        whereDocument: parsedWhereDocument,
      });

      lastQuerySummary.value = `Embedding query - ${formatNumber(parsedEmbedding.length)} dims${filterSummarySuffix}`;
      historyEntry = {
        id: `${currentCollection.value.id}:embedding:${safeStringify(parsedEmbedding)}:${resultCount}:${normalizedWhereText}:${normalizedWhereDocumentText}`,
        collectionId: currentCollection.value.id,
        collectionName: currentCollection.value.name,
        mode: "embedding",
        value: JSON.stringify(parsedEmbedding),
        preview: `${formatNumber(parsedEmbedding.length)} dims - ${truncateText(
          parsedEmbedding
            .slice(0, 4)
            .map((value) => formatEmbeddingNumber(value))
            .join(", "),
          48,
        )}`,
        whereMode: queryWhereMode.value,
        whereRules: storedWhereRules,
        whereText: normalizedWhereText,
        whereDocumentMode: queryWhereDocumentMode.value,
        whereDocumentRules: storedWhereDocumentRules,
        whereDocumentText: normalizedWhereDocumentText,
        resultCount,
        summary: lastQuerySummary.value,
        timestamp: new Date().toISOString(),
      };

      await executeVectorQuery(parsedEmbedding, resultCount, "embedding", {
        where: parsedWhere,
        whereDocument: parsedWhereDocument,
      });
      updateCollectionEmbeddingDimension(
        currentCollection.value.id,
        parsedEmbedding.length,
      );
    }

    hasCompletedQuery.value = true;

    if (historyEntry) {
      appendQueryHistoryEntry(historyEntry);
    }

    await scrollToQueryResults();
  } catch (error) {
    queryResults.value = [];
    hasCompletedQuery.value = false;

    toast.add({
      severity: "error",
      summary: "Query failed",
      detail: getErrorMessage(error),
      life: 5000,
    });
  } finally {
    isQueryingCollection.value = false;
  }
};

const focusQueryResult = (id) => {
  clearMetadataFilters();
  hideMetadataFilterOverlayPanel();
  filters.value.global.value = id;
  showQueryViewer.value = false;
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
  workspaceHealthStatus.value = "offline";
  stopWorkspaceHealthCheck();

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
    workspaceHealthStatus.value = "live";
    startWorkspaceHealthCheck();
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
  stopWorkspaceHealthCheck();
  connected.value = false;
  workspaceHealthStatus.value = "offline";
  collections.value = [];
  currentCollection.value = null;
  currentCollectionData.value = [];
  collectionEmbeddingDimensions.value = {};
  resetTableFilters();
  collectionSearch.value = "";
  mobileSidebarOpen.value = false;
  resetEmbeddingViews();
  queryResults.value = [];
  lastQuerySummary.value = "";
  hasCompletedQuery.value = false;
  showQueryViewer.value = false;
  resetBulkSelectionState();
  resetCreateRecordState();
  resetImportState();
  resetCloneCollectionState();
  showMetricsViewer.value = false;
  showActivityLogViewer.value = false;
  expandedActivityEntries.value = {};
  metricsEmbeddingSummary.value = null;
};

onBeforeUnmount(() => {
  stopWorkspaceHealthCheck();
});

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
  resetTableFilters();
  resetEmbeddingViews();
  queryResults.value = [];
  lastQuerySummary.value = "";
  hasCompletedQuery.value = false;
  showQueryViewer.value = false;
  resetBulkSelectionState();
  resetCreateRecordState();
  resetImportState();
  showMetricsViewer.value = false;
  metricsEmbeddingSummary.value = null;

  try {
    const response = await axios.post(
      `${collectionBaseUrl.value}/${collection.id}/get`,
      {
        include: ["documents", "metadatas"],
      },
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
  const createdCollectionMetadata = metadata;

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

    appendActivityLogEntry({
      type: "collection",
      title: `Created collection ${createdCollectionName}`,
      description: `Added ${createdCollectionName} to the current workspace.`,
      collectionId: createdCollection?.id ?? "",
      collectionName: createdCollectionName,
      details: [
        buildCollectionActivityDetailSection({
          title: createdCollectionName,
          afterName: createdCollectionName,
          afterMetadata: createdCollectionMetadata,
          includeAllFields: true,
        }),
      ].filter(Boolean),
    });

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

const handleCreateRecordButtonClick = () => {
  createRecordData.value = createEmptyRecordDraft();
  showCreateRecordForm.value = true;
};

const handleCreateRecord = async () => {
  if (!currentCollection.value || isCreatingRecord.value) return;

  const trimmedId = `${createRecordData.value.id ?? ""}`.trim();
  const documentValue = `${createRecordData.value.document ?? ""}`;
  const normalizedDocument = documentValue.trim() ? documentValue : "";
  const trimmedEmbedding = `${createRecordData.value.embedding ?? ""}`.trim();
  const trimmedMetadata = `${createRecordData.value.metadata ?? ""}`.trim();
  let metadata = null;

  if (!trimmedId) {
    toast.add({
      severity: "error",
      summary: "Missing record ID",
      detail: "Provide a unique ID before creating a record.",
      life: 5000,
    });
    return;
  }

  if (currentCollectionData.value.some((row) => row.id === trimmedId)) {
    toast.add({
      severity: "error",
      summary: "Duplicate record ID",
      detail: `${trimmedId} already exists in the current collection.`,
      life: 5000,
    });
    return;
  }

  if (trimmedMetadata) {
    try {
      metadata = JSON.parse(trimmedMetadata);
    } catch (_) {
      toast.add({
        severity: "error",
        summary: "Invalid metadata",
        detail: "Metadata must be valid JSON.",
        life: 5000,
      });
      return;
    }

    if (
      metadata !== null &&
      (typeof metadata !== "object" || Array.isArray(metadata))
    ) {
      toast.add({
        severity: "error",
        summary: "Invalid metadata",
        detail: "Metadata must be a JSON object or null.",
        life: 5000,
      });
      return;
    }
  }

  isCreatingRecord.value = true;

  try {
    const recordDraft = {
      id: trimmedId,
      document: normalizedDocument,
      ...(trimmedMetadata ? { metadata } : {}),
    };

    if (trimmedEmbedding) {
      recordDraft.embedding = parseEmbeddingDraft(
        createRecordData.value.embedding,
      );
    }

    const preparedRecords = await ensureRecordsHaveEmbeddings(
      [recordDraft],
      "auto-embedding this record",
    );
    const preparedRecord = preparedRecords.records[0];
    const wasAutoEmbedded = preparedRecords.generatedCount > 0;

    await axios.post(
      `${collectionBaseUrl.value}/${currentCollection.value.id}/add`,
      {
        ids: [trimmedId],
        embeddings: [preparedRecord.embedding],
        documents: normalizedDocument ? [normalizedDocument] : null,
        metadatas: trimmedMetadata ? [metadata] : null,
        uris: null,
      },
    );

    currentCollectionData.value = [
      {
        id: trimmedId,
        document: normalizedDocument,
        metadata: trimmedMetadata ? safeStringify(metadata) : "null",
      },
      ...currentCollectionData.value,
    ];

    toast.add({
      severity: "success",
      summary: "Record created",
      detail: `${trimmedId} was added to ${currentCollection.value.name}${wasAutoEmbedded ? ` with an auto-generated embedding from ${semanticProviderLabel.value}.` : "."}`,
      life: 4000,
    });

    appendActivityLogEntry({
      type: "create",
      title: `Created row ${trimmedId}`,
      description: `${trimmedId} was added to ${currentCollection.value.name}${wasAutoEmbedded ? ` with an auto-generated embedding from ${semanticProviderLabel.value}.` : "."}`,
      collectionId: currentCollection.value.id,
      collectionName: currentCollection.value.name,
      rowCount: 1,
      rowIds: [trimmedId],
      details: [
        buildActivityRecordDetailSection({
          title: trimmedId,
          afterRecord: buildActivityRecordSnapshot(preparedRecord),
        }),
      ],
    });

    resetCreateRecordState();
    await retrieveCollections();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Create failed",
      detail: `Unable to create the record. Reason: ${getErrorMessage(error)}`,
      life: 6000,
    });
  } finally {
    isCreatingRecord.value = false;
  }
};

const toggleCollectionOverlayPanel = (event, collection) => {
  if (isDeletingCollection.value || isCloningCollection.value) return;

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
      const deletedCollection = selectedCollection.value
        ? JSON.parse(JSON.stringify(selectedCollection.value))
        : null;

      try {
        await axios.delete(
          `${collectionBaseUrl.value}/${selectedCollection.value.name}`,
        );

        if (selectedCollection.value.id === currentCollection.value?.id) {
          currentCollection.value = null;
          currentCollectionData.value = [];
          collectionEmbeddingDimensions.value = {};
          resetTableFilters();
          resetEmbeddingViews();
          queryResults.value = [];
          lastQuerySummary.value = "";
          showQueryViewer.value = false;
          resetBulkSelectionState();
          resetCreateRecordState();
          resetImportState();
          showMetricsViewer.value = false;
          metricsEmbeddingSummary.value = null;
        }

        const collectionIndex = collections.value.findIndex(
          (collection) => collection.id === selectedCollection.value.id,
        );

        if (collectionIndex !== -1) {
          collections.value.splice(collectionIndex, 1);
        }

        if (deletedCollection) {
          appendActivityLogEntry({
            type: "collection",
            title: `Deleted collection ${deletedCollection.name}`,
            description: `Removed ${deletedCollection.name} from the current workspace.`,
            collectionId: deletedCollection.id ?? "",
            collectionName: deletedCollection.name ?? "",
            details: [
              buildCollectionActivityDetailSection({
                title: deletedCollection.name,
                beforeName: deletedCollection.name,
                beforeMetadata: deletedCollection.metadata ?? null,
                includeAllFields: true,
              }),
            ].filter(Boolean),
          });
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

const handleCollectionClone = () => {
  if (!selectedCollection.value || isCloningCollection.value) return;

  showCloneCollectionForm.value = true;
  collectionOverlayPanel.value.visible = false;
  cloneCollectionData.value = {
    name: buildSuggestedCollectionCloneName(selectedCollection.value.name),
    metadata:
      selectedCollection.value.metadata == null
        ? ""
        : JSON.stringify(selectedCollection.value.metadata, null, 2),
    includeRecords: true,
  };
};

const handleCloneCollection = async () => {
  if (!selectedCollection.value || isCloningCollection.value) return;

  const sourceCollection = JSON.parse(JSON.stringify(selectedCollection.value));
  const nextName = `${cloneCollectionData.value.name ?? ""}`.trim();
  const shouldCopyRecords = cloneCollectionData.value.includeRecords;

  if (!nextName) {
    toast.add({
      severity: "error",
      summary: "Missing collection name",
      detail: "Provide a name for the cloned collection.",
      life: 5000,
    });
    return;
  }

  if (collections.value.some((collection) => collection.name === nextName)) {
    toast.add({
      severity: "error",
      summary: "Collection already exists",
      detail: `${nextName} already exists in this workspace. Choose a different clone name.`,
      life: 5000,
    });
    return;
  }

  let metadata = null;
  let sourceRecords = [];

  try {
    metadata = cloneCollectionData.value.metadata
      ? JSON.parse(cloneCollectionData.value.metadata)
      : null;
  } catch (_) {
    toast.add({
      severity: "error",
      summary: "Invalid metadata",
      detail: "Metadata must be valid JSON.",
      life: 5000,
    });
    return;
  }

  isCloningCollection.value = true;

  try {
    if (shouldCopyRecords) {
      sourceRecords = await fetchAllRecordsForCollection(sourceCollection.id, [
        "documents",
        "embeddings",
        "metadatas",
        "uris",
      ]);
    }

    await axios.post(collectionBaseUrl.value, {
      name: nextName,
      metadata,
    });

    await retrieveCollections();

    const clonedCollection = collections.value.find(
      (collection) => collection.name === nextName,
    );

    if (!clonedCollection) {
      throw new Error(
        "The cloned collection was created, but it could not be loaded from the workspace.",
      );
    }

    if (shouldCopyRecords && sourceRecords.length) {
      const payloadGroups = buildChunkedRecordAddPayloadGroups(sourceRecords, {
        includeMetadata: true,
      });

      try {
        for (const payloadGroup of payloadGroups) {
          await axios.post(
            `${collectionBaseUrl.value}/${clonedCollection.id}/add`,
            payloadGroup,
          );
        }
      } catch (copyError) {
        try {
          await axios.delete(`${collectionBaseUrl.value}/${nextName}`);
          await retrieveCollections();
        } catch (_) {
          // Best effort rollback only; preserve the original clone failure below.
        }

        throw new Error(
          `The collection was created, but copying rows failed and the clone was removed. ${getErrorMessage(copyError)}`,
        );
      }
    }

    const copiedRowCount = sourceRecords.length;
    const collectionDetailSection = buildCollectionActivityDetailSection({
      title: nextName,
      afterName: nextName,
      afterMetadata: metadata,
      includeAllFields: true,
    });

    toast.add({
      severity: "success",
      summary: "Collection cloned",
      detail: shouldCopyRecords
        ? `Created ${nextName} from ${sourceCollection.name} with ${formatNumber(copiedRowCount)} copied ${pluralize(copiedRowCount, "row")}.`
        : `Created ${nextName} from ${sourceCollection.name} without copying rows.`,
      life: 5000,
    });

    appendActivityLogEntry({
      type: "collection",
      title: `Cloned collection ${sourceCollection.name} to ${nextName}`,
      description: shouldCopyRecords
        ? `Created ${nextName} by copying ${formatNumber(copiedRowCount)} ${pluralize(copiedRowCount, "row")} from ${sourceCollection.name}.`
        : `Created ${nextName} as a metadata-only copy of ${sourceCollection.name}.`,
      collectionId: clonedCollection.id,
      collectionName: nextName,
      rowCount: shouldCopyRecords ? copiedRowCount : 0,
      details: [
        collectionDetailSection,
        {
          title: "Clone source",
          changes: [
            buildActivityDetailChange({
              label: "Source collection",
              after: sourceCollection.name,
            }),
            buildActivityDetailChange({
              label: "Copy mode",
              after: shouldCopyRecords ? "Rows and settings" : "Settings only",
            }),
            buildActivityDetailChange({
              label: "Rows copied",
              after: shouldCopyRecords ? formatNumber(copiedRowCount) : "0",
            }),
          ],
        },
      ].filter(Boolean),
    });

    resetCloneCollectionState(true);
    await retrieveCollections();

    const nextCollection = collections.value.find(
      (collection) => collection.name === nextName,
    );

    if (nextCollection) {
      await handleCollectionSelection(nextCollection, true);
    }
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Clone failed",
      detail: getErrorMessage(error),
      life: 7000,
    });
  } finally {
    isCloningCollection.value = false;
  }
};

const handleEditCollection = async () => {
  if (isEditingCollection.value) return;

  let metadata = null;
  const previousName = `${selectedCollection.value?.name ?? ""}`;
  const previousMetadata = selectedCollection.value?.metadata ?? null;

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
  const nextName = `${editCollectionData.value.name ?? ""}`;

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

    const collectionDetailSection = buildCollectionActivityDetailSection({
      title: nextName || previousName || "Collection settings",
      beforeName: previousName,
      afterName: nextName,
      beforeMetadata: previousMetadata,
      afterMetadata: metadata,
    });

    toast.add({
      severity: "success",
      summary: "Success",
      detail: "Collection updated",
      life: 5000,
    });

    appendActivityLogEntry({
      type: "collection",
      title:
        previousName !== nextName
          ? `Renamed collection ${previousName} to ${nextName}`
          : `Updated collection ${nextName}`,
      description:
        previousName !== nextName
          ? `Renamed ${previousName} to ${nextName} in the current workspace.`
          : `Updated settings for ${nextName} in the current workspace.`,
      collectionId: selectedCollection.value.id,
      collectionName: nextName,
      details: collectionDetailSection ? [collectionDetailSection] : [],
    });

    selectedCollection.value = {
      ...selectedCollection.value,
      name: nextName,
      metadata,
    };

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

const openDocumentEditor = (id) => {
  const row = currentCollectionData.value.find((item) => item.id === id);

  if (!row) return;

  isSavingDocumentEditor.value = false;
  documentEditorDialog.value = {
    visible: true,
    id,
    draft: `${row.document ?? ""}`,
  };
};

const closeDocumentEditor = () => {
  isSavingDocumentEditor.value = false;
  documentEditorDialog.value = { visible: false, id: null, draft: "" };
};

const saveDocumentEditor = async () => {
  if (
    !currentCollection.value ||
    !documentEditorDialog.value.id ||
    isSavingDocumentEditor.value
  ) {
    return;
  }

  const row = currentCollectionData.value.find(
    (item) => item.id === documentEditorDialog.value.id,
  );

  if (!row) {
    closeDocumentEditor();
    return;
  }

  const previousDocument = `${row.document ?? ""}`;
  const nextDocument = `${documentEditorDialog.value.draft ?? ""}`;

  if (previousDocument === nextDocument) {
    closeDocumentEditor();
    return;
  }

  isSavingDocumentEditor.value = true;

  try {
    await axios.post(
      `${collectionBaseUrl.value}/${currentCollection.value.id}/update`,
      {
        documents: [nextDocument],
        ids: [row.id],
        metadatas: [parseMetadataValue(row.metadata)],
      },
    );

    const selectedRowIds = new Set(
      selectedTableRows.value.map((item) => item.id),
    );

    currentCollectionData.value = currentCollectionData.value.map((item) =>
      item.id === row.id
        ? {
            ...item,
            document: nextDocument,
          }
        : item,
    );
    selectedTableRows.value = currentCollectionData.value.filter((item) =>
      selectedRowIds.has(item.id),
    );

    toast.add({
      severity: "success",
      summary: nextDocument.trim().length
        ? "Document updated"
        : "Document cleared",
      detail: nextDocument.trim().length
        ? `Saved document text for ${row.id}.`
        : `Removed document text from ${row.id}.`,
      life: 4000,
    });

    appendActivityLogEntry({
      type: "edit",
      title: `Edited document for ${row.id}`,
      description: `Updated the document text for ${row.id} in ${currentCollection.value.name}.`,
      collectionId: currentCollection.value.id,
      collectionName: currentCollection.value.name,
      rowCount: 1,
      rowIds: [row.id],
      details: [
        buildActivityRecordDetailSection({
          title: row.id,
          beforeRecord: buildActivityRecordSnapshot({
            id: row.id,
            document: previousDocument,
          }),
          afterRecord: buildActivityRecordSnapshot({
            id: row.id,
            document: nextDocument,
          }),
          fields: ["document"],
        }),
      ],
      meta: {
        field: "document",
      },
    });

    closeDocumentEditor();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Document update failed",
      detail: getErrorMessage(error),
      life: 5000,
    });
  } finally {
    isSavingDocumentEditor.value = false;
  }
};

const openMetadataEditor = (id) => {
  const row = currentCollectionData.value.find((item) => item.id === id);

  if (!row) return;

  const metadataValue = parseMetadataValue(row.metadata);

  isSavingMetadataEditor.value = false;
  metadataEditorDialog.value = {
    visible: true,
    id,
    entries: canMetadataEditorUseFieldMode(metadataValue)
      ? buildMetadataEditorEntries(metadataValue)
      : [],
    mode: canMetadataEditorUseFieldMode(metadataValue) ? "fields" : "raw",
    rawValue: safeStringify(metadataValue, true),
  };
};

const closeMetadataEditor = () => {
  isSavingMetadataEditor.value = false;
  metadataEditorDialog.value = {
    visible: false,
    id: null,
    entries: [],
    mode: "fields",
    rawValue: "null",
  };
};

const addMetadataEditorEntry = () => {
  metadataEditorDialog.value = {
    ...metadataEditorDialog.value,
    entries: [
      ...metadataEditorDialog.value.entries,
      createMetadataEditorEntry(),
    ],
  };
};

const removeMetadataEditorEntry = (entryId) => {
  metadataEditorDialog.value = {
    ...metadataEditorDialog.value,
    entries: metadataEditorDialog.value.entries.filter(
      (entry) => entry.id !== entryId,
    ),
  };
};

const clearMetadataEditorEntries = () => {
  metadataEditorDialog.value = {
    ...metadataEditorDialog.value,
    entries: [],
    rawValue: "null",
  };
};

const setMetadataEditorMode = (nextMode) => {
  const normalizedMode = nextMode === "raw" ? "raw" : "fields";

  if (metadataEditorDialog.value.mode === normalizedMode) {
    return;
  }

  if (normalizedMode === "raw") {
    let nextMetadata;

    try {
      nextMetadata = buildMetadataFromEditorEntries(
        metadataEditorDialog.value.entries,
      );
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Invalid metadata",
        detail: error.message,
        life: 5000,
      });
      return;
    }

    metadataEditorDialog.value = {
      ...metadataEditorDialog.value,
      mode: "raw",
      rawValue: safeStringify(nextMetadata, true),
    };
    return;
  }

  let parsedMetadata;

  try {
    parsedMetadata = parseMetadataEditorRawValue(
      metadataEditorDialog.value.rawValue,
    );
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Invalid metadata",
      detail: error.message,
      life: 5000,
    });
    return;
  }

  if (!canMetadataEditorUseFieldMode(parsedMetadata)) {
    toast.add({
      severity: "error",
      summary: "Cannot switch to fields",
      detail:
        "Fields mode supports flat text, number, and true/false values only.",
      life: 5000,
    });
    return;
  }

  metadataEditorDialog.value = {
    ...metadataEditorDialog.value,
    mode: "fields",
    entries: buildMetadataEditorEntries(parsedMetadata),
    rawValue: safeStringify(parsedMetadata, true),
  };
};

const saveMetadataEditor = async () => {
  if (
    !currentCollection.value ||
    !metadataEditorDialog.value.id ||
    isSavingMetadataEditor.value
  ) {
    return;
  }

  const row = currentCollectionData.value.find(
    (item) => item.id === metadataEditorDialog.value.id,
  );

  if (!row) {
    closeMetadataEditor();
    return;
  }

  let nextMetadata;

  try {
    nextMetadata =
      metadataEditorDialog.value.mode === "raw"
        ? parseMetadataEditorRawValue(metadataEditorDialog.value.rawValue)
        : buildMetadataFromEditorEntries(metadataEditorDialog.value.entries);
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Invalid metadata",
      detail: error.message,
      life: 5000,
    });
    return;
  }

  const previousMetadata = parseMetadataValue(row.metadata);

  if (areMetadataValuesEqual(previousMetadata, nextMetadata)) {
    closeMetadataEditor();
    return;
  }

  isSavingMetadataEditor.value = true;

  try {
    await applyExactMetadataOnServer([
      {
        id: row.id,
        metadata: nextMetadata,
      },
    ]);

    const nextMetadataLabel = safeStringify(nextMetadata);
    const selectedRowIds = new Set(
      selectedTableRows.value.map((item) => item.id),
    );

    currentCollectionData.value = currentCollectionData.value.map((item) =>
      item.id === row.id
        ? {
            ...item,
            metadata: nextMetadataLabel,
          }
        : item,
    );
    selectedTableRows.value = currentCollectionData.value.filter((item) =>
      selectedRowIds.has(item.id),
    );

    toast.add({
      severity: "success",
      summary: nextMetadata === null ? "Metadata cleared" : "Metadata updated",
      detail:
        nextMetadata === null
          ? `Removed metadata from ${row.id}.`
          : `Saved metadata for ${row.id}.`,
      life: 4000,
    });

    appendActivityLogEntry({
      type: "edit",
      title: `Edited metadata for ${row.id}`,
      description: `Updated the metadata for ${row.id} in ${currentCollection.value.name}.`,
      collectionId: currentCollection.value.id,
      collectionName: currentCollection.value.name,
      rowCount: 1,
      rowIds: [row.id],
      details: [
        buildActivityRecordDetailSection({
          title: row.id,
          beforeRecord: buildActivityRecordSnapshot({
            id: row.id,
            metadata: previousMetadata,
          }),
          afterRecord: buildActivityRecordSnapshot({
            id: row.id,
            metadata: nextMetadata,
          }),
          fields: ["metadata"],
        }),
      ],
      meta: {
        field: "metadata",
      },
    });

    closeMetadataEditor();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Metadata update failed",
      detail: getErrorMessage(error),
      life: 5000,
    });
  } finally {
    isSavingMetadataEditor.value = false;
  }
};

const removeRowsFromLocalState = (ids) => {
  const idSet = new Set(ids);

  currentCollectionData.value = currentCollectionData.value.filter(
    (row) => !idSet.has(row.id),
  );
  selectedTableRows.value = selectedTableRows.value.filter(
    (row) => !idSet.has(row.id),
  );
  queryResults.value = queryResults.value.filter(
    (result) => !idSet.has(result.id),
  );

  const nextExpandedRows = { ...expandedEmbeddingRows.value };

  for (const id of ids) {
    delete embeddingPreviewCache.value[id];
    delete embeddingVectorCache.value[id];
    delete embeddingEditorDrafts.value[id];
    delete editingEmbeddingIds.value[id];
    delete savingEmbeddingIds.value[id];
    delete nextExpandedRows[id];

    if (embeddingDialog.value.id === id) {
      closeEmbeddingDialog();
    }

    if (documentEditorDialog.value.id === id) {
      closeDocumentEditor();
    }

    if (metadataEditorDialog.value.id === id) {
      closeMetadataEditor();
    }
  }

  expandedEmbeddingRows.value = nextExpandedRows;

  if (!selectedTableRows.value.length) {
    resetBulkMetadataState();
  }
};

const parseBulkMetadataPayload = () => {
  if (bulkMetadataMode.value === "clear") {
    return null;
  }

  const trimmedPayload = `${bulkMetadataValue.value ?? ""}`.trim();

  if (!trimmedPayload) {
    throw new Error(
      bulkMetadataMode.value === "merge"
        ? "Enter a JSON object to merge into the selected rows."
        : "Enter a JSON object or null before applying the metadata update.",
    );
  }

  let parsedPayload;

  try {
    parsedPayload = JSON.parse(trimmedPayload);
  } catch (_) {
    throw new Error("Metadata update must be valid JSON.");
  }

  if (bulkMetadataMode.value === "merge") {
    if (!isPlainMetadataObject(parsedPayload)) {
      throw new Error("Merge mode requires a JSON object.");
    }

    return parsedPayload;
  }

  if (parsedPayload !== null && !isPlainMetadataObject(parsedPayload)) {
    throw new Error("Replace mode requires a JSON object or null.");
  }

  return parsedPayload;
};

const selectVisibleRows = () => {
  selectedTableRows.value = visibleTableRows.value.map((row) => row);
};

const clearSelectedRows = () => {
  selectedTableRows.value = [];
};

const openBulkMetadataDialog = () => {
  if (!hasSelectedRows.value) return;

  bulkMetadataMode.value = "merge";
  bulkMetadataValue.value = "";
  showBulkMetadataDialog.value = true;
};

const refreshMetricsSummaryIfNeeded = async () => {
  metricsEmbeddingSummary.value = null;

  if (showMetricsViewer.value && currentCollectionData.value.length) {
    await loadMetricsEmbeddingSummary();
  }
};

const fetchAllRecordsForCollection = async (
  collectionId,
  include = ["documents", "embeddings", "metadatas", "uris"],
) => {
  if (!collectionId) {
    return [];
  }

  const response = await axios.post(
    `${collectionBaseUrl.value}/${collectionId}/get`,
    {
      include,
    },
  );

  const responseIds = Array.isArray(response.data?.ids)
    ? response.data.ids
    : [];
  const documents = Array.isArray(response.data?.documents)
    ? response.data.documents
    : [];
  const embeddings = Array.isArray(response.data?.embeddings)
    ? response.data.embeddings
    : [];
  const metadatas = Array.isArray(response.data?.metadatas)
    ? response.data.metadatas
    : [];
  const uris = Array.isArray(response.data?.uris) ? response.data.uris : [];

  return responseIds.map((id, index) => {
    const record = { id };

    if (documents[index] !== undefined && documents[index] !== null) {
      record.document = documents[index];
    }

    if (Array.isArray(embeddings[index])) {
      record.embedding = embeddings[index];
    }

    if (metadatas[index] !== undefined) {
      record.metadata = metadatas[index];
    }

    if (uris[index] !== undefined && uris[index] !== null) {
      record.uri = uris[index];
    }

    return record;
  });
};

const fetchRecordsByIds = async (
  ids,
  include = ["documents", "embeddings", "metadatas", "uris"],
) => {
  if (!currentCollection.value || !ids.length) {
    return [];
  }

  const response = await axios.post(
    `${collectionBaseUrl.value}/${currentCollection.value.id}/get`,
    {
      ids,
      include,
    },
  );

  const responseIds = Array.isArray(response.data?.ids)
    ? response.data.ids
    : [];
  const documents = Array.isArray(response.data?.documents)
    ? response.data.documents
    : [];
  const embeddings = Array.isArray(response.data?.embeddings)
    ? response.data.embeddings
    : [];
  const metadatas = Array.isArray(response.data?.metadatas)
    ? response.data.metadatas
    : [];
  const uris = Array.isArray(response.data?.uris) ? response.data.uris : [];

  return responseIds.map((id, index) => ({
    id,
    document: documents[index],
    embedding: embeddings[index],
    metadata: metadatas[index],
    uri: uris[index],
  }));
};

const buildRecordAddPayloadGroups = (
  records,
  { includeMetadata = false } = {},
) => {
  const payloadGroups = new Map();

  for (const record of records) {
    const hasDocument =
      Object.prototype.hasOwnProperty.call(record, "document") &&
      record.document !== null &&
      record.document !== undefined;
    const hasEmbedding =
      Object.prototype.hasOwnProperty.call(record, "embedding") &&
      Array.isArray(record.embedding) &&
      record.embedding.length > 0;
    const hasMetadata =
      includeMetadata &&
      Object.prototype.hasOwnProperty.call(record, "metadata") &&
      record.metadata !== undefined;
    const hasUri =
      Object.prototype.hasOwnProperty.call(record, "uri") &&
      record.uri !== null &&
      record.uri !== undefined;
    const key = [
      hasDocument ? "d" : "",
      hasEmbedding ? "e" : "",
      hasMetadata ? "m" : "",
      hasUri ? "u" : "",
    ].join("");

    if (!payloadGroups.has(key)) {
      payloadGroups.set(key, {
        ids: [],
        embeddings: hasEmbedding ? [] : null,
        documents: hasDocument ? [] : null,
        metadatas: hasMetadata ? [] : null,
        uris: hasUri ? [] : null,
      });
    }

    const payloadGroup = payloadGroups.get(key);
    payloadGroup.ids.push(record.id);

    if (hasDocument) {
      payloadGroup.documents.push(record.document);
    }

    if (hasEmbedding) {
      payloadGroup.embeddings.push(record.embedding);
    }

    if (hasMetadata) {
      payloadGroup.metadatas.push(record.metadata);
    }

    if (hasUri) {
      payloadGroup.uris.push(record.uri);
    }
  }

  return Array.from(payloadGroups.values());
};

const buildChunkedRecordAddPayloadGroups = (
  records,
  options = {},
  maxGroupSize = 250,
) => {
  return buildRecordAddPayloadGroups(records, options).flatMap(
    (payloadGroup) => {
      const totalIds = Array.isArray(payloadGroup.ids)
        ? payloadGroup.ids.length
        : 0;

      if (!totalIds) {
        return [];
      }

      if (totalIds <= maxGroupSize) {
        return [payloadGroup];
      }

      const chunkedGroups = [];

      for (
        let startIndex = 0;
        startIndex < totalIds;
        startIndex += maxGroupSize
      ) {
        const endIndex = startIndex + maxGroupSize;

        chunkedGroups.push({
          ids: payloadGroup.ids.slice(startIndex, endIndex),
          embeddings: Array.isArray(payloadGroup.embeddings)
            ? payloadGroup.embeddings.slice(startIndex, endIndex)
            : null,
          documents: Array.isArray(payloadGroup.documents)
            ? payloadGroup.documents.slice(startIndex, endIndex)
            : null,
          metadatas: Array.isArray(payloadGroup.metadatas)
            ? payloadGroup.metadatas.slice(startIndex, endIndex)
            : null,
          uris: Array.isArray(payloadGroup.uris)
            ? payloadGroup.uris.slice(startIndex, endIndex)
            : null,
        });
      }

      return chunkedGroups;
    },
  );
};

const normalizeMetadataForComparison = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeMetadataForComparison);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort((leftKey, rightKey) => leftKey.localeCompare(rightKey))
      .reduce((normalizedValue, key) => {
        normalizedValue[key] = normalizeMetadataForComparison(value[key]);
        return normalizedValue;
      }, {});
  }

  return value ?? null;
};

const areMetadataValuesEqual = (leftValue, rightValue) => {
  return (
    safeStringify(normalizeMetadataForComparison(leftValue)) ===
    safeStringify(normalizeMetadataForComparison(rightValue))
  );
};

const rebuildRecordsWithMetadata = async (metadataEntries) => {
  if (!currentCollection.value || !metadataEntries.length) {
    return false;
  }

  const ids = metadataEntries.map((entry) => entry.id);
  const nextMetadataMap = new Map(
    metadataEntries.map((entry) => [entry.id, entry.metadata]),
  );

  const currentRecords = await fetchRecordsByIds(ids, [
    "documents",
    "embeddings",
    "metadatas",
    "uris",
  ]);

  if (currentRecords.length !== ids.length) {
    throw new Error(
      "Unable to rebuild all selected rows while replacing metadata.",
    );
  }

  const rebuiltRecords = currentRecords.map((record) => {
    const nextMetadata = nextMetadataMap.get(record.id);

    if (nextMetadata === undefined || nextMetadata === null) {
      return {
        ...record,
        metadata: undefined,
      };
    }

    return {
      ...record,
      metadata: nextMetadata,
    };
  });

  const rebuiltPayloadGroups = buildRecordAddPayloadGroups(rebuiltRecords, {
    includeMetadata: true,
  });
  const restorePayloadGroups = buildRecordAddPayloadGroups(currentRecords, {
    includeMetadata: false,
  });
  const restorePayloadGroupsWithMetadata = buildRecordAddPayloadGroups(
    currentRecords,
    {
      includeMetadata: true,
    },
  );

  await axios.post(
    `${collectionBaseUrl.value}/${currentCollection.value.id}/delete`,
    {
      ids,
    },
  );

  try {
    for (const payloadGroup of rebuiltPayloadGroups) {
      await axios.post(
        `${collectionBaseUrl.value}/${currentCollection.value.id}/add`,
        payloadGroup,
      );
    }
  } catch (error) {
    try {
      for (const payloadGroup of restorePayloadGroupsWithMetadata.length
        ? restorePayloadGroupsWithMetadata
        : restorePayloadGroups) {
        await axios.post(
          `${collectionBaseUrl.value}/${currentCollection.value.id}/add`,
          payloadGroup,
        );
      }
    } catch (_) {
      // Best effort rollback only; preserve the original failure below.
    }

    throw error;
  }

  return true;
};

const applyExactMetadataOnServer = async (metadataEntries) => {
  if (!currentCollection.value || !metadataEntries.length) {
    return { usedRebuildFallback: false };
  }

  const ids = metadataEntries.map((entry) => entry.id);
  const expectedMetadataMap = new Map(
    metadataEntries.map((entry) => [entry.id, entry.metadata ?? null]),
  );

  await axios.post(
    `${collectionBaseUrl.value}/${currentCollection.value.id}/update`,
    {
      ids,
      metadatas: metadataEntries.map((entry) => entry.metadata ?? null),
    },
  );

  const verificationRecords = await fetchRecordsByIds(ids, ["metadatas"]);
  const remainingEntries = verificationRecords
    .filter(
      (record) =>
        !areMetadataValuesEqual(
          record.metadata ?? null,
          expectedMetadataMap.get(record.id) ?? null,
        ),
    )
    .map((record) => ({
      id: record.id,
      metadata: expectedMetadataMap.get(record.id) ?? null,
    }));

  if (!remainingEntries.length) {
    return { usedRebuildFallback: false };
  }

  await rebuildRecordsWithMetadata(remainingEntries);

  return {
    usedRebuildFallback: true,
    rebuiltIds: remainingEntries.map((entry) => entry.id),
  };
};

const deleteRowsByIds = async (
  ids,
  {
    successSummary = "Rows deleted",
    successDetail = "",
    errorSummary = "Delete failed",
  } = {},
) => {
  if (!currentCollection.value || !ids.length || isDeletingRows.value) {
    return;
  }

  const deletedRowSnapshots = ids
    .map((id) => {
      const row = currentCollectionData.value.find((entry) => entry.id === id);
      if (!row) return null;

      return buildActivityRecordSnapshot({
        ...row,
        ...(Array.isArray(embeddingVectorCache.value[id])
          ? { embedding: embeddingVectorCache.value[id] }
          : {}),
      });
    })
    .filter(Boolean);
  isDeletingRows.value = true;

  try {
    await axios.post(
      `${collectionBaseUrl.value}/${currentCollection.value.id}/delete`,
      {
        ids,
      },
    );

    removeRowsFromLocalState(ids);
    await retrieveCollections();
    await refreshMetricsSummaryIfNeeded();

    toast.add({
      severity: "success",
      summary: successSummary,
      detail:
        successDetail ||
        `${formatNumber(ids.length)} ${pluralize(ids.length, "row")} removed from ${currentCollection.value.name}.`,
      life: 4000,
    });

    appendActivityLogEntry({
      type: "delete",
      title:
        ids.length === 1
          ? `Deleted row ${ids[0]}`
          : `Deleted ${formatNumber(ids.length)} rows`,
      description:
        successDetail ||
        `${formatNumber(ids.length)} ${pluralize(ids.length, "row")} removed from ${currentCollection.value.name}.`,
      collectionId: currentCollection.value.id,
      collectionName: currentCollection.value.name,
      rowCount: ids.length,
      rowIds: ids,
      details: deletedRowSnapshots
        .slice(0, ACTIVITY_LOG_DETAIL_SECTION_LIMIT)
        .map((snapshot) =>
          buildActivityRecordDetailSection({
            title: snapshot.id,
            beforeRecord: snapshot,
          }),
        ),
      detailsOverflowCount: Math.max(
        0,
        deletedRowSnapshots.length - ACTIVITY_LOG_DETAIL_SECTION_LIMIT,
      ),
    });
  } catch (error) {
    toast.add({
      severity: "error",
      summary: errorSummary,
      detail: getErrorMessage(error),
      life: 5000,
    });
  } finally {
    isDeletingRows.value = false;
  }
};

const deleteEmbedding = async (id) => {
  await deleteRowsByIds([id], {
    successSummary: "Row deleted",
    successDetail: `${id} was removed from ${currentCollection.value?.name ?? "the collection"}.`,
    errorSummary: "Unable to delete row",
  });
};

const handleBulkDeleteRows = () => {
  if (!hasSelectedRows.value || isDeletingRows.value) return;

  const ids = selectedRows.value.map((row) => row.id);

  confirm.require({
    message: `Delete ${formatNumber(ids.length)} selected ${pluralize(ids.length, "row")} from '${currentCollection.value?.name ?? "this collection"}'?`,
    header: "Delete selected rows?",
    icon: "pi pi-info-circle",
    rejectLabel: "Cancel",
    acceptLabel: "Delete",
    rejectClass: "p-button-secondary p-button-outlined",
    acceptClass: "p-button-danger",
    acceptIcon: "pi pi-trash",
    accept: async () => {
      await deleteRowsByIds(ids, {
        successSummary: "Selected rows deleted",
        errorSummary: "Bulk delete failed",
      });
    },
  });
};

const applyBulkMetadata = async () => {
  if (
    !currentCollection.value ||
    !hasSelectedRows.value ||
    isApplyingBulkMetadata.value
  ) {
    return;
  }

  let metadataPayload;

  try {
    metadataPayload = parseBulkMetadataPayload();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Invalid metadata update",
      detail: error.message,
      life: 5000,
    });
    return;
  }

  const selectedRowsSnapshot = selectedRows.value.map((row) => ({ ...row }));
  const nextMetadataEntries = selectedRowsSnapshot.map((row) => {
    const existingMetadata = parseMetadataValue(row.metadata);
    const nextMetadata =
      bulkMetadataMode.value === "merge"
        ? {
            ...(isPlainMetadataObject(existingMetadata)
              ? existingMetadata
              : {}),
            ...metadataPayload,
          }
        : metadataPayload;

    return {
      id: row.id,
      metadata: nextMetadata,
      metadataLabel: safeStringify(nextMetadata),
    };
  });
  const nextMetadataValueMap = new Map(
    nextMetadataEntries.map((entry) => [entry.id, entry.metadata]),
  );
  const shouldApplyExactMetadataServerSide =
    bulkMetadataMode.value === "replace" || bulkMetadataMode.value === "clear";
  const exactMetadataEntries = nextMetadataEntries.map((entry) => ({
    id: entry.id,
    metadata: entry.metadata,
  }));
  const isExactMetadataClear = nextMetadataEntries.every(
    (entry) => entry.metadata === null,
  );

  isApplyingBulkMetadata.value = true;

  try {
    const bulkMetadataResult = shouldApplyExactMetadataServerSide
      ? await applyExactMetadataOnServer(exactMetadataEntries)
      : await axios.post(
          `${collectionBaseUrl.value}/${currentCollection.value.id}/update`,
          {
            ids: nextMetadataEntries.map((entry) => entry.id),
            metadatas: nextMetadataEntries.map((entry) => entry.metadata),
          },
        );

    const nextMetadataMap = new Map(
      nextMetadataEntries.map((entry) => [entry.id, entry.metadataLabel]),
    );

    currentCollectionData.value = currentCollectionData.value.map((row) =>
      nextMetadataMap.has(row.id)
        ? {
            ...row,
            metadata: nextMetadataMap.get(row.id),
          }
        : row,
    );
    selectedTableRows.value = currentCollectionData.value.filter((row) =>
      nextMetadataMap.has(row.id),
    );

    toast.add({
      severity: "success",
      summary: "Metadata updated",
      detail: `${formatNumber(nextMetadataEntries.length)} selected ${pluralize(nextMetadataEntries.length, "row")} ${nextMetadataEntries.length === 1 ? "was" : "were"} updated.${bulkMetadataResult?.usedRebuildFallback ? ` Metadata ${isExactMetadataClear ? "clear" : "replacement"} used a server-side rebuild fallback for rows that Chroma did not fully replace via update.` : ""}`,
      life: 4000,
    });

    appendActivityLogEntry({
      type: "metadata",
      title:
        bulkMetadataMode.value === "clear"
          ? `Cleared metadata on ${formatNumber(nextMetadataEntries.length)} ${pluralize(nextMetadataEntries.length, "row")}`
          : `Patched metadata on ${formatNumber(nextMetadataEntries.length)} ${pluralize(nextMetadataEntries.length, "row")}`,
      description:
        bulkMetadataMode.value === "merge"
          ? `Merged metadata into ${formatNumber(nextMetadataEntries.length)} selected ${pluralize(nextMetadataEntries.length, "row")} in ${currentCollection.value.name}.`
          : bulkMetadataMode.value === "replace"
            ? `Replaced metadata on ${formatNumber(nextMetadataEntries.length)} selected ${pluralize(nextMetadataEntries.length, "row")} in ${currentCollection.value.name}.`
            : `Cleared metadata on ${formatNumber(nextMetadataEntries.length)} selected ${pluralize(nextMetadataEntries.length, "row")} in ${currentCollection.value.name}.`,
      collectionId: currentCollection.value.id,
      collectionName: currentCollection.value.name,
      rowCount: nextMetadataEntries.length,
      rowIds: nextMetadataEntries.map((entry) => entry.id),
      details: selectedRowsSnapshot
        .slice(0, ACTIVITY_LOG_DETAIL_SECTION_LIMIT)
        .map((row) =>
          buildActivityRecordDetailSection({
            title: row.id,
            beforeRecord: buildActivityRecordSnapshot({
              id: row.id,
              metadata: row.metadata,
            }),
            afterRecord: buildActivityRecordSnapshot({
              id: row.id,
              metadata: nextMetadataValueMap.get(row.id),
            }),
            fields: ["metadata"],
          }),
        ),
      detailsOverflowCount: Math.max(
        0,
        selectedRowsSnapshot.length - ACTIVITY_LOG_DETAIL_SECTION_LIMIT,
      ),
      meta: {
        mode: bulkMetadataMode.value,
      },
    });

    resetBulkMetadataState();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Bulk metadata update failed",
      detail: getErrorMessage(error),
      life: 5000,
    });
  } finally {
    isApplyingBulkMetadata.value = false;
  }
};

const addMetadataFilterRule = () => {
  metadataFilterRules.value = [
    ...metadataFilterRules.value,
    createMetadataFilterRule(),
  ];
};

const getMetadataFilterSuggestions = (rule) => {
  const normalizedKey = `${rule?.key ?? ""}`.trim().toLowerCase();

  if (!normalizedKey) {
    return metadataFilterKeyOptions.value.slice(0, 8);
  }

  return metadataFilterKeyOptions.value
    .filter((key) => key.toLowerCase().includes(normalizedKey))
    .slice(0, 8);
};

const shouldShowMetadataFilterSuggestions = (rule) => {
  return (
    metadataFilterFocusedRuleId.value === rule.id &&
    getMetadataFilterSuggestions(rule).length > 0
  );
};

const handleMetadataFilterKeyFocus = (ruleId) => {
  metadataFilterFocusedRuleId.value = ruleId;
};

const handleMetadataFilterKeyBlur = () => {
  window.setTimeout(() => {
    metadataFilterFocusedRuleId.value = null;
  }, 80);
};

const selectMetadataFilterKey = (rule, key) => {
  rule.key = key;
  metadataFilterFocusedRuleId.value = null;
};

const removeMetadataFilterRule = (ruleId) => {
  metadataFilterRules.value = metadataFilterRules.value.filter(
    (rule) => rule.id !== ruleId,
  );
};

const clearMetadataFilters = () => {
  metadataFilterRules.value = [];
  metadataFilterMode.value = "all";
  metadataFilterFocusedRuleId.value = null;
};

const hideMetadataFilterOverlayPanel = () => {
  metadataFilterOverlayPanel.value?.hide?.();
};

const toggleMetadataFilterOverlayPanel = (event) => {
  if (!currentCollection.value) return;

  metadataFilterOverlayPanel.value?.toggle(event);
};

const resetTableFilters = () => {
  filters.value.global.value = null;
  clearMetadataFilters();
  hideMetadataFilterOverlayPanel();
};

const toggleExportOverlayPanel = (event) => {
  if (!filteredCollectionData.value.length || isExportingCsv.value) return;

  exportOverlayPanel.value?.toggle(event);
};

const hideExportOverlayPanel = () => {
  exportOverlayPanel.value?.hide?.();
};

const escapeCsvValue = (value) => {
  const normalizedValue =
    value === null || value === undefined ? "" : String(value);

  return `"${normalizedValue.replace(/"/g, '""')}"`;
};

const buildExportFilename = (includeEmbeddings, scopeSuffix = "") => {
  const sanitizedCollectionName =
    (currentCollection.value?.name ?? "collection")
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "collection";
  const normalizedScopeSuffix = `${scopeSuffix ?? ""}`.trim();
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filenamePrefix = normalizedScopeSuffix
    ? `${sanitizedCollectionName}-${normalizedScopeSuffix}`
    : sanitizedCollectionName;

  return includeEmbeddings
    ? `${filenamePrefix}-with-embeddings-${dateStamp}.csv`
    : `${filenamePrefix}-${dateStamp}.csv`;
};

const downloadCsvFile = (filename, csvContent) => {
  const csvBlob = new Blob(["\uFEFF", csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const downloadUrl = URL.createObjectURL(csvBlob);
  const downloadLink = document.createElement("a");

  downloadLink.href = downloadUrl;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(downloadUrl);
};

const fetchEmbeddingsForExport = async (ids) => {
  if (!ids.length) return {};

  const response = await axios.post(
    `${collectionBaseUrl.value}/${currentCollection.value.id}/get`,
    {
      ids,
      include: ["embeddings"],
    },
  );

  const responseIds = Array.isArray(response.data?.ids)
    ? response.data.ids
    : ids;
  const embeddings = Array.isArray(response.data?.embeddings)
    ? response.data.embeddings
    : [];

  return responseIds.reduce((embeddingMap, id, index) => {
    embeddingMap[id] = Array.isArray(embeddings[index])
      ? embeddings[index]
      : null;
    return embeddingMap;
  }, {});
};

const getRowsForExport = (rowsOverride = null) => {
  if (Array.isArray(rowsOverride)) {
    return rowsOverride;
  }

  const processedRows = embeddingDataTable.value?.processedData;

  if (Array.isArray(processedRows) && processedRows.length) {
    return processedRows;
  }

  return filteredCollectionData.value;
};

const buildCsvLines = (rows, embeddingsById = null) => {
  const includeEmbeddings = Boolean(embeddingsById);
  const csvHeader = includeEmbeddings
    ? ["id", "document", "metadata", "embedding"]
    : ["id", "document", "metadata"];

  return [
    csvHeader.map(escapeCsvValue).join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.document,
        row.metadata,
        ...(includeEmbeddings ? [safeStringify(embeddingsById[row.id])] : []),
      ]
        .map(escapeCsvValue)
        .join(","),
    ),
  ];
};

const exportTableCsv = () => {
  if (!getRowsForExport().length) return;

  hideExportOverlayPanel();
  embeddingDataTable.value?.exportCSV();
};

const exportRowsAsCsv = async ({
  rows = null,
  includeEmbeddings = false,
  scopeSuffix = "",
} = {}) => {
  const rowsToExport = getRowsForExport(rows).map((row) => ({ ...row }));

  if (
    !currentCollection.value ||
    !rowsToExport.length ||
    isExportingCsv.value
  ) {
    return;
  }

  if (!includeEmbeddings && rows === null) {
    exportTableCsv();
    return;
  }

  if (rows === null) {
    hideExportOverlayPanel();
  }

  isExportingCsv.value = true;

  try {
    const embeddingsById = includeEmbeddings
      ? await fetchEmbeddingsForExport(rowsToExport.map((row) => row.id))
      : null;
    const csvLines = buildCsvLines(rowsToExport, embeddingsById);

    downloadCsvFile(
      buildExportFilename(includeEmbeddings, scopeSuffix),
      csvLines.join("\n"),
    );
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Export failed",
      detail: `Unable to export CSV. Reason: ${getErrorMessage(error)}`,
      life: 5000,
    });
  } finally {
    isExportingCsv.value = false;
  }
};

const exportSelectedRows = async () => {
  await exportRowsAsCsv({
    rows: selectedRows.value,
    includeEmbeddings: false,
    scopeSuffix: "selected",
  });
};

const exportCSV = async (includeEmbeddings = false) => {
  if (
    !currentCollection.value ||
    !getRowsForExport().length ||
    isExportingCsv.value
  ) {
    return;
  }

  await exportRowsAsCsv({ includeEmbeddings });
};
</script>

<template>
  <Toast />
  <ConfirmDialog :draggable="false" class="confirm-dialog" />

  <div v-if="!connected" class="entry-view">
    <div class="backdrop-orb backdrop-orb--mint"></div>
    <div class="backdrop-orb backdrop-orb--amber"></div>
    <div class="backdrop-grid"></div>

    <section class="entry-layout">
      <div class="hero-copy">
        <div class="brand-pill">
          <img :src="chromaLogoUrl" alt="ChromaDB logo" />
          <span>ChromaDB UI</span>
        </div>

        <p class="section-kicker">Vector database cockpit</p>
        <p class="text-4xl font-bold">
          Give your Chroma workspace a cleaner, sharper control room.
        </p>
        <p class="hero-copy__text">
          Browse collections, inspect metadata, edit embeddings, and export the
          view you need without feeling stuck in a bare-bones admin screen.
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
            <img :src="chromaLogoUrl" alt="ChromaDB logo" />
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
        <div
          class="sidebar-connection__status"
          :class="{
            'sidebar-connection__status--unreachable':
              workspaceHealthStatus === 'unreachable',
          }"
        >
          <span class="status-dot" :class="workspaceStatusDotClass"></span>
          <span>{{ workspaceStatusLabel }}</span>
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
              :disabled="
                isDeletingCollection ||
                isFetchingCollectionData ||
                isCloningCollection
              "
              @click.stop="toggleCollectionOverlayPanel($event, collection)"
            >
              <i
                :class="
                  isDeletingCollection ||
                  isFetchingCollectionData ||
                  isCloningCollection
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

          <div class="workspace-header__copy">
            <p class="section-kicker">Vector workspace</p>
            <h1>{{ workspaceTitle }}</h1>
            <p>{{ workspaceSubtitle }}</p>

            <div class="workspace-header__actions">
              <button
                class="workspace-query-cta"
                type="button"
                :disabled="!currentCollection"
                @click="showQueryViewer = true"
              >
                <span class="workspace-query-cta__icon">
                  <i class="pi pi-search"></i>
                </span>

                <span class="workspace-query-cta__copy">
                  <small>Semantic search</small>
                  <strong>Open Query Viewer</strong>
                  <span>
                    Turn text into embeddings or query with a raw vector.
                  </span>
                </span>
              </button>

              <button
                class="workspace-import-cta"
                type="button"
                :disabled="!currentCollection"
                @click="showImportViewer = true"
              >
                <span class="workspace-import-cta__icon">
                  <i class="pi pi-upload"></i>
                </span>

                <span class="workspace-import-cta__copy">
                  <small>Data import</small>
                  <strong>Open Importer</strong>
                  <span
                    >Paste records as JSON and add or upsert them into this
                    collection.</span
                  >
                </span>
              </button>

              <button
                class="workspace-metrics-cta"
                type="button"
                :disabled="!currentCollection"
                @click="openMetricsViewer"
              >
                <span class="workspace-metrics-cta__icon">
                  <i class="pi pi-chart-line"></i>
                </span>

                <span class="workspace-metrics-cta__copy">
                  <small>Collection metrics</small>
                  <strong>Open Metrics</strong>
                  <span
                    >Review detailed stats for the selected collection.</span
                  >
                </span>
              </button>

              <button
                class="workspace-activity-cta"
                type="button"
                @click="showActivityLogViewer = true"
              >
                <span class="workspace-activity-cta__icon">
                  <i class="pi pi-history"></i>
                </span>

                <span class="workspace-activity-cta__copy">
                  <small>Recent changes</small>
                  <strong>Open Activity Log</strong>
                  <span>
                    Review deletes, imports, patches, and edits from this
                    workspace.
                  </span>
                </span>
              </button>
            </div>
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
              <span class="my-auto">{{ fact.label }}</span>

              <div class="detail-row__value">
                <strong>{{ fact.value }}</strong>

                <button
                  v-if="fact.label === 'Collection ID' && currentCollection?.id"
                  class="mini-button mini-button--ghost mini-button--icon"
                  type="button"
                  aria-label="Copy collection ID"
                  @click="copyCollectionId"
                >
                  <i class="pi pi-copy"></i>
                </button>
              </div>
            </div>
          </div>

          <div class="code-block">
            <div class="code-block__label">Metadata preview</div>
            <pre v-if="collectionMetadataPreviewHtml"><code
              class="hljs json-highlight"
              v-html="collectionMetadataPreviewHtml"
            ></code></pre>
            <pre v-else>{{ collectionMetadataPreview }}</pre>
          </div>
        </article>

        <article class="table-panel glass-panel">
          <DataTable
            ref="embeddingDataTable"
            class="embedding-table"
            showGridlines
            paginator
            scrollable
            tableStyle="min-width: 58rem"
            :rows="10"
            :rowsPerPageOptions="[5, 10, 20, 50, 100]"
            :loading="isFetchingCollectionData"
            resizableColumns
            columnResizeMode="fit"
            stateStorage="local"
            stateKey="dt-state-chromadb-ui"
            dataKey="id"
            v-model:selection="selectedTableRows"
            v-model:filters="filters"
            v-model:expandedRows="expandedEmbeddingRows"
            :value="filteredCollectionData"
            @row-expand="handleEmbeddingRowExpand"
          >
            <template #header>
              <div class="table-toolbar">
                <div class="table-toolbar__copy">
                  <p class="section-kicker">Embedding explorer</p>
                  <h2>Documents, metadata and vectors</h2>
                  <p>
                    Search and edit the current records, then expand a row to
                    inspect its vector.
                  </p>
                </div>

                <div class="table-toolbar__actions">
                  <button
                    class="ui-button ui-button--primary"
                    type="button"
                    :disabled="!currentCollection || isFetchingCollectionData"
                    @click="handleCreateRecordButtonClick"
                  >
                    <i class="pi pi-plus-circle"></i>
                    <span>Create record</span>
                  </button>

                  <button
                    class="ui-button ui-button--ghost metadata-filter-button"
                    :class="{
                      'metadata-filter-button--active': hasMetadataFilters,
                    }"
                    type="button"
                    :disabled="!currentCollection"
                    @click="toggleMetadataFilterOverlayPanel($event)"
                  >
                    <i class="pi pi-sliders-h"></i>
                    <span>Metadata filters</span>
                    <span
                      v-if="activeMetadataFilterRules.length"
                      class="metadata-filter-button__count"
                    >
                      {{ activeMetadataFilterRules.length }}
                    </span>
                  </button>

                  <button
                    class="ui-button ui-button--secondary export-button"
                    type="button"
                    :disabled="!filteredCollectionData.length || isExportingCsv"
                    @click="toggleExportOverlayPanel($event)"
                  >
                    <i
                      :class="
                        isExportingCsv
                          ? 'pi pi-spin pi-spinner'
                          : 'pi pi-download'
                      "
                    ></i>
                    <span>{{
                      isExportingCsv ? "Preparing CSV" : "Export CSV"
                    }}</span>
                    <i
                      v-if="!isExportingCsv"
                      class="pi pi-angle-down export-button__caret"
                    ></i>
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

              <div
                v-if="activeMetadataFilterRules.length"
                class="table-filter-strip"
              >
                <div class="table-filter-strip__summary">
                  <span class="section-kicker">Metadata filters</span>
                  <strong>
                    {{
                      metadataFilterMode === "any"
                        ? "Match any rule"
                        : "Match all rules"
                    }}
                  </strong>
                </div>

                <div class="table-filter-chip-list">
                  <button
                    v-for="rule in activeMetadataFilterRules"
                    :key="rule.id"
                    class="table-filter-chip"
                    type="button"
                    @click="removeMetadataFilterRule(rule.id)"
                  >
                    <span>{{ formatMetadataFilterRule(rule) }}</span>
                    <i class="pi pi-times"></i>
                  </button>
                </div>

                <button
                  class="mini-button mini-button--ghost"
                  type="button"
                  @click="clearMetadataFilters"
                >
                  Clear metadata filters
                </button>
              </div>

              <div v-if="hasSelectedRows" class="table-bulk-strip">
                <div class="table-bulk-strip__summary">
                  <span class="section-kicker">Bulk row actions</span>
                  <strong>{{ selectedRowsLabel }}</strong>
                  <p>Apply changes across the selected rows.</p>
                </div>

                <div class="table-bulk-strip__actions">
                  <button
                    class="mini-button mini-button--ghost"
                    type="button"
                    :disabled="
                      !visibleRowsCount ||
                      areAllVisibleRowsSelected ||
                      isRunningBulkRowAction
                    "
                    @click="selectVisibleRows"
                  >
                    Select visible
                  </button>

                  <button
                    class="mini-button mini-button--ghost"
                    type="button"
                    :disabled="isRunningBulkRowAction || isExportingCsv"
                    @click="clearSelectedRows"
                  >
                    Clear selection
                  </button>

                  <button
                    class="mini-button mini-button--ghost"
                    type="button"
                    :disabled="isRunningBulkRowAction || isExportingCsv"
                    @click="exportSelectedRows"
                  >
                    <i
                      :class="
                        isExportingCsv
                          ? 'pi pi-spin pi-spinner'
                          : 'pi pi-download'
                      "
                    ></i>
                    <span>Export selected CSV</span>
                  </button>

                  <button
                    class="mini-button"
                    type="button"
                    :disabled="isRunningBulkRowAction"
                    @click="openBulkMetadataDialog"
                  >
                    <i class="pi pi-pencil"></i>
                    <span>Patch metadata</span>
                  </button>

                  <button
                    class="mini-button mini-button--danger"
                    type="button"
                    :disabled="isRunningBulkRowAction"
                    @click="handleBulkDeleteRows"
                  >
                    <i
                      :class="
                        isDeletingRows ? 'pi pi-spin pi-spinner' : 'pi pi-trash'
                      "
                    ></i>
                    <span>Delete selected</span>
                  </button>
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

            <Column selectionMode="multiple" headerStyle="width: 3.25rem" />
            <Column expander headerStyle="width: 3.75rem" />

            <Column field="id" header="ID" sortable headerStyle="width: 11rem">
              <template #body="slotProps">
                <div class="cell-id-wrap">
                  <div class="cell-id">{{ slotProps.data.id }}</div>
                  <button
                    class="mini-button mini-button--ghost mini-button--inline"
                    type="button"
                    @click="openEmbeddingDialog(slotProps.data.id)"
                  >
                    Vector
                  </button>
                </div>
              </template>
            </Column>

            <Column
              field="document"
              header="Document"
              sortable
              headerStyle="width: 22rem"
            >
              <template #body="slotProps">
                <div class="cell-document-wrap">
                  <div v-if="slotProps.data.document" class="cell-document">
                    {{ slotProps.data.document }}
                  </div>

                  <div v-else class="cell-document cell-document--empty">
                    <strong class="cell-document__empty-title">
                      No document stored
                    </strong>
                  </div>

                  <button
                    class="mini-button mini-button--ghost mini-button--inline cell-document__action"
                    type="button"
                    @click="openDocumentEditor(slotProps.data.id)"
                  >
                    {{
                      slotProps.data.document ? "Edit document" : "Add document"
                    }}
                  </button>
                </div>
              </template>
            </Column>

            <Column
              field="metadata"
              header="Metadata"
              sortable
              headerStyle="width: 20rem"
            >
              <template #body="slotProps">
                <div class="cell-json-wrap">
                  <code
                    class="cell-json hljs json-highlight"
                    v-html="
                      highlightJsonValue(slotProps.data.metadata ?? 'null')
                    "
                  ></code>

                  <button
                    class="mini-button mini-button--ghost mini-button--inline cell-json__action"
                    type="button"
                    @click="openMetadataEditor(slotProps.data.id)"
                  >
                    Edit metadata
                  </button>
                </div>
              </template>
            </Column>

            <Column header="" headerStyle="width: 4.5rem">
              <template #body="slotProps">
                <button
                  class="row-action row-action--danger"
                  type="button"
                  aria-label="Delete row"
                  :disabled="isDeletingRows"
                  @click="deleteEmbedding(slotProps.data.id)"
                >
                  <i class="pi pi-trash"></i>
                </button>
              </template>
            </Column>

            <template #expansion="slotProps">
              <div class="embedding-row-panel">
                <div class="embedding-row-panel__header">
                  <div>
                    <p class="section-kicker">Embedding preview</p>
                    <h3>{{ slotProps.data.id }}</h3>
                    <p class="embedding-row-panel__copy">
                      {{
                        getEmbeddingPreview(slotProps.data.id)
                          ? getEmbeddingSummaryText(slotProps.data.id)
                          : "Loading a compact vector preview for this record."
                      }}
                    </p>
                  </div>

                  <div class="embedding-row-panel__actions">
                    <button
                      class="mini-button mini-button--ghost"
                      type="button"
                      :disabled="isEmbeddingPreviewLoading(slotProps.data.id)"
                      @click="loadEmbeddingPreview(slotProps.data.id)"
                    >
                      <i
                        :class="
                          isEmbeddingPreviewLoading(slotProps.data.id)
                            ? 'pi pi-spin pi-spinner'
                            : 'pi pi-refresh'
                        "
                      ></i>
                      <span>Refresh preview</span>
                    </button>

                    <button
                      class="mini-button mini-button--ghost"
                      type="button"
                      :disabled="isEmbeddingPreviewLoading(slotProps.data.id)"
                      @click="startEmbeddingEdit(slotProps.data.id)"
                    >
                      <span>{{
                        isEmbeddingEditing(slotProps.data.id)
                          ? "Editing"
                          : "Edit vector"
                      }}</span>
                    </button>

                    <button
                      class="mini-button"
                      type="button"
                      @click="openEmbeddingDialog(slotProps.data.id)"
                    >
                      <span>Open full vector</span>
                    </button>
                  </div>
                </div>

                <div
                  v-if="isEmbeddingPreviewLoading(slotProps.data.id)"
                  class="embedding-row-panel__loading"
                >
                  <i class="pi pi-spin pi-spinner"></i>
                  <span>Loading vector preview...</span>
                </div>

                <div
                  v-else-if="getEmbeddingPreview(slotProps.data.id)"
                  class="embedding-preview embedding-preview--expanded"
                >
                  <div class="embedding-preview__header">
                    <div class="embedding-preview__metrics">
                      <span>
                        {{
                          formatNumber(
                            getEmbeddingPreview(slotProps.data.id).dimensions,
                          )
                        }}
                        dims
                      </span>
                      <span>
                        norm
                        {{ getEmbeddingPreview(slotProps.data.id).normLabel }}
                      </span>
                    </div>

                    <div class="embedding-preview__range">
                      <span>
                        min
                        {{ getEmbeddingPreview(slotProps.data.id).minLabel }}
                      </span>
                      <span>
                        max
                        {{ getEmbeddingPreview(slotProps.data.id).maxLabel }}
                      </span>
                    </div>
                  </div>

                  <svg
                    v-if="
                      getEmbeddingPreview(slotProps.data.id).sparklinePoints
                    "
                    class="embedding-preview__sparkline embedding-preview__sparkline--wide"
                    viewBox="0 0 132 40"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <polyline
                      :points="
                        getEmbeddingPreview(slotProps.data.id).sparklinePoints
                      "
                    />
                  </svg>

                  <div class="embedding-preview__samples">
                    <div
                      v-for="sample in getEmbeddingPreview(slotProps.data.id)
                        .sampleValues"
                      :key="`${slotProps.data.id}-${sample.index}`"
                      class="embedding-preview__sample"
                    >
                      <span>v[{{ sample.index }}]</span>
                      <strong>{{ sample.label }}</strong>
                    </div>
                  </div>
                </div>

                <div
                  v-if="isEmbeddingEditing(slotProps.data.id)"
                  class="embedding-editor"
                >
                  <div class="embedding-editor__header">
                    <div>
                      <p class="section-kicker">Edit embedding</p>
                      <p class="embedding-editor__copy">
                        Provide a JSON array of numbers. The vector must keep
                        the same dimension count.
                      </p>
                    </div>
                  </div>

                  <textarea
                    class="embedding-editor__textarea scroll-container"
                    rows="10"
                    :value="getEmbeddingDraft(slotProps.data.id)"
                    @input="
                      updateEmbeddingDraft(
                        slotProps.data.id,
                        $event.target.value,
                      )
                    "
                  ></textarea>

                  <div class="embedding-editor__footer">
                    <span class="embedding-editor__hint">
                      {{
                        getEmbeddingPreview(slotProps.data.id)
                          ? `${formatNumber(
                              getEmbeddingPreview(slotProps.data.id).dimensions,
                            )} values expected`
                          : "Load the vector first to validate dimensions"
                      }}
                    </span>

                    <div class="embedding-editor__actions">
                      <button
                        class="mini-button mini-button--ghost"
                        type="button"
                        :disabled="isSavingEmbedding(slotProps.data.id)"
                        @click="cancelEmbeddingEdit(slotProps.data.id)"
                      >
                        Cancel
                      </button>

                      <button
                        class="mini-button"
                        type="button"
                        :disabled="isSavingEmbedding(slotProps.data.id)"
                        @click="saveEmbedding(slotProps.data.id)"
                      >
                        <i
                          :class="
                            isSavingEmbedding(slotProps.data.id)
                              ? 'pi pi-spin pi-spinner'
                              : 'pi pi-check'
                          "
                        ></i>
                        <span>Save vector</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </DataTable>
        </article>
      </section>
    </main>
  </div>

  <Dialog
    v-model:visible="showActivityLogViewer"
    modal
    :draggable="false"
    class="activity-dialog"
  >
    <template #header>
      <div class="dialog-heading">
        <p class="section-kicker">Workspace activity</p>
        <h2>Recent changes at a glance</h2>
      </div>
    </template>

    <div class="activity-panel">
      <div class="panel-heading">
        <div>
          <p class="activity-panel__copy">
            Review recent deletes, imports, metadata patches, and edits for the
            current workspace.
          </p>
        </div>

        <div class="query-panel__header-actions activity-panel__header-actions">
          <span class="tag-chip">
            {{
              currentCollection
                ? currentCollection.name
                : `${tenant} / ${database}`
            }}
          </span>
          <span class="tag-chip">
            {{ formatNumber(currentWorkspaceActivityLog.length) }} events
          </span>
          <button
            class="mini-button mini-button--danger"
            type="button"
            :disabled="!currentWorkspaceActivityLog.length"
            @click="clearCurrentWorkspaceActivityLog"
          >
            <i class="pi pi-trash"></i>
            <span>Clear log</span>
          </button>
        </div>
      </div>

      <div class="metrics-card-grid activity-summary-grid">
        <article
          v-for="summaryCard in activityLogSummary"
          :key="summaryCard.label"
          class="metrics-summary-card"
        >
          <p class="section-kicker">{{ summaryCard.label }}</p>
          <h3>{{ summaryCard.value }}</h3>
          <p>{{ summaryCard.description }}</p>
        </article>
      </div>

      <div v-if="currentWorkspaceActivityLog.length" class="activity-log-list">
        <article
          v-for="entry in currentWorkspaceActivityLog"
          :key="entry.id"
          class="activity-log-entry"
        >
          <div class="activity-log-entry__top">
            <div class="activity-log-entry__icon">
              <i :class="getActivityIcon(entry.type)"></i>
            </div>

            <div class="activity-log-entry__copy">
              <p class="section-kicker">
                {{ getActivityTypeLabel(entry.type) }}
              </p>
              <h3>{{ entry.title }}</h3>
              <p>{{ entry.description }}</p>
            </div>

            <div class="activity-log-entry__meta">
              <span class="activity-log-entry__time">{{
                formatActivityTimestamp(entry.timestamp)
              }}</span>
              <strong>{{ entry.collectionName || "Workspace" }}</strong>
            </div>
          </div>

          <div class="activity-log-entry__footer">
            <div class="activity-log-entry__facts">
              <span v-if="entry.rowCount > 0">
                {{ formatNumber(entry.rowCount) }}
                {{ pluralize(entry.rowCount, "row") }}
              </span>
              <span v-if="entry.meta?.mode">
                {{ getActivityModeLabel(entry.meta.mode) }}
              </span>
              <span v-if="entry.rowIds.length">
                IDs: {{ truncateText(entry.rowIds.join(", "), 96) }}
              </span>
            </div>

            <div class="activity-log-entry__actions">
              <button
                v-if="hasActivityDetails(entry)"
                class="mini-button mini-button--ghost"
                type="button"
                @click="toggleActivityEntry(entry.id)"
              >
                <i
                  :class="
                    isActivityEntryExpanded(entry.id)
                      ? 'pi pi-chevron-up'
                      : 'pi pi-chevron-down'
                  "
                ></i>
                <span>{{
                  isActivityEntryExpanded(entry.id)
                    ? "Hide details"
                    : "View details"
                }}</span>
              </button>
            </div>
          </div>

          <div
            v-if="
              hasActivityDetails(entry) && isActivityEntryExpanded(entry.id)
            "
            class="activity-log-entry__details"
          >
            <div class="activity-log-entry__details-summary">
              <span>
                Showing {{ formatNumber(entry.details.length) }}
                {{ pluralize(entry.details.length, "entry", "entries") }}
                with field-level changes.
              </span>
              <span v-if="entry.detailsOverflowCount > 0">
                {{ formatNumber(entry.detailsOverflowCount) }} more
                {{ pluralize(entry.detailsOverflowCount, "row") }} not shown.
              </span>
            </div>

            <article
              v-for="section in entry.details"
              :key="`${entry.id}-${section.title}`"
              class="activity-detail-section"
            >
              <div class="activity-detail-section__header">
                <strong>{{ section.title }}</strong>
              </div>

              <div class="activity-detail-section__changes">
                <section
                  v-for="change in section.changes"
                  :key="`${section.title}-${change.label}`"
                  class="activity-detail-card"
                >
                  <p class="section-kicker activity-detail-card__label">
                    {{ change.label }}
                  </p>

                  <div
                    class="activity-detail-card__grid"
                    :class="{
                      'activity-detail-card__grid--single':
                        !change.before || !change.after,
                    }"
                  >
                    <div
                      v-if="change.before"
                      class="activity-detail-card__column"
                    >
                      <span class="activity-detail-card__column-label"
                        >Before</span
                      >
                      <pre class="activity-detail-card__value"><code
                        v-if="
                          change.format === 'json' ||
                          change.format === 'embedding'
                        "
                        class="hljs json-highlight"
                        v-html="highlightJsonValue(change.before)"
                      ></code><code v-else>{{ change.before }}</code></pre>
                    </div>

                    <div
                      v-if="change.after"
                      class="activity-detail-card__column"
                    >
                      <span class="activity-detail-card__column-label"
                        >After</span
                      >
                      <pre class="activity-detail-card__value"><code
                        v-if="
                          change.format === 'json' ||
                          change.format === 'embedding'
                        "
                        class="hljs json-highlight"
                        v-html="highlightJsonValue(change.after)"
                      ></code><code v-else>{{ change.after }}</code></pre>
                    </div>
                  </div>
                </section>
              </div>
            </article>
          </div>
        </article>
      </div>

      <div v-else class="activity-log-empty">
        <div class="activity-log-empty__icon">
          <i class="pi pi-history"></i>
        </div>
        <h3>No activity captured yet</h3>
        <p>
          Successful imports, deletes, metadata patches, and edits will appear
          here once you start working in this workspace.
        </p>
      </div>
    </div>
  </Dialog>

  <Dialog
    v-model:visible="showBulkMetadataDialog"
    modal
    :draggable="false"
    class="collection-dialog bulk-row-dialog"
    @hide="resetBulkMetadataState"
  >
    <template #header>
      <div class="dialog-heading">
        <p class="section-kicker">Bulk row actions</p>
        <h2>Update metadata across selected rows</h2>
      </div>
    </template>

    <div class="dialog-body">
      <div class="bulk-row-dialog__summary">
        <div class="bulk-row-dialog__summary-copy">
          <p class="section-kicker">Selection</p>
          <strong>{{ selectedRowsLabel }}</strong>
          <p>
            {{
              currentCollection
                ? `Applying updates inside ${currentCollection.name}.`
                : "Select a collection before applying bulk metadata updates."
            }}
          </p>
        </div>

        <span class="tag-chip">
          {{
            currentCollection ? currentCollection.name : "Select a collection"
          }}
        </span>
      </div>

      <div class="query-mode-switch bulk-row-dialog__mode-switch">
        <button
          class="query-mode-switch__button"
          :class="{
            'query-mode-switch__button--active': bulkMetadataMode === 'merge',
          }"
          type="button"
          @click="bulkMetadataMode = 'merge'"
        >
          Merge patch
        </button>

        <button
          class="query-mode-switch__button"
          :class="{
            'query-mode-switch__button--active': bulkMetadataMode === 'replace',
          }"
          type="button"
          @click="bulkMetadataMode = 'replace'"
        >
          Replace all
        </button>

        <button
          class="query-mode-switch__button"
          :class="{
            'query-mode-switch__button--active': bulkMetadataMode === 'clear',
          }"
          type="button"
          @click="bulkMetadataMode = 'clear'"
        >
          Clear metadata
        </button>
      </div>

      <p class="query-panel__hint">
        {{
          bulkMetadataMode === "merge"
            ? "Merge mode adds or overwrites keys while keeping each row's other metadata intact."
            : bulkMetadataMode === "replace"
              ? "Replace mode swaps every selected row to the same JSON object or null."
              : "Clear mode sets metadata to null on every selected row."
        }}
      </p>

      <label v-if="bulkMetadataMode !== 'clear'" class="field">
        <span class="field__label">Metadata JSON</span>
        <span class="field__hint">
          {{
            bulkMetadataMode === "merge"
              ? "Provide a JSON object. Rows with null or non-object metadata are treated as empty objects before merging."
              : "Provide a JSON object or null to replace metadata on every selected row."
          }}
        </span>
        <textarea
          v-model="bulkMetadataValue"
          rows="12"
          :placeholder="bulkMetadataPlaceholder"
        ></textarea>
      </label>

      <div v-else class="bulk-row-dialog__notice">
        Every selected row will be updated so its metadata becomes
        <code>null</code>.
      </div>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <button
          class="ui-button ui-button--ghost"
          type="button"
          :disabled="isApplyingBulkMetadata"
          @click="resetBulkMetadataState"
        >
          Cancel
        </button>

        <button
          class="ui-button ui-button--primary"
          type="button"
          :disabled="!canApplyBulkMetadata || isApplyingBulkMetadata"
          @click="applyBulkMetadata"
        >
          <i
            :class="
              isApplyingBulkMetadata ? 'pi pi-spin pi-spinner' : 'pi pi-check'
            "
          ></i>
          <span>Apply to selected rows</span>
        </button>
      </div>
    </template>
  </Dialog>

  <Dialog
    v-model:visible="documentEditorDialog.visible"
    modal
    :draggable="false"
    class="record-dialog document-editor-dialog"
    @hide="closeDocumentEditor"
  >
    <template #header>
      <div class="dialog-heading">
        <p class="section-kicker">Row document</p>
        <h2>{{ documentEditorDialog.id ?? "No row selected" }}</h2>
      </div>
    </template>

    <div class="dialog-body document-editor-dialog__body">
      <div class="record-dialog__meta document-editor-dialog__summary">
        <strong>Edit the full document.</strong>
        <p>
          Use this editor for long text, multiline content, or emptying the
          document entirely. Saving a blank value clears the stored document.
        </p>
      </div>

      <label class="field document-editor-dialog__field">
        <span class="field__label">Document text</span>
        <span class="field__hint">
          You can paste plain text, multiline content, or leave it empty.
        </span>
        <textarea
          v-model="documentEditorDialog.draft"
          class="document-editor-dialog__textarea scroll-container"
          rows="16"
          spellcheck="true"
          placeholder="Paste or write the full document text"
        ></textarea>
      </label>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <button
          class="ui-button ui-button--ghost"
          type="button"
          :disabled="isSavingDocumentEditor"
          @click="closeDocumentEditor"
        >
          Cancel
        </button>

        <button
          class="ui-button ui-button--primary"
          type="button"
          :disabled="isSavingDocumentEditor"
          @click="saveDocumentEditor"
        >
          <i
            :class="
              isSavingDocumentEditor ? 'pi pi-spin pi-spinner' : 'pi pi-check'
            "
          ></i>
          <span>Save document</span>
        </button>
      </div>
    </template>
  </Dialog>

  <Dialog
    v-model:visible="metadataEditorDialog.visible"
    modal
    :draggable="false"
    class="record-dialog metadata-editor-dialog"
    @hide="closeMetadataEditor"
  >
    <template #header>
      <div class="dialog-heading">
        <p class="section-kicker">Row metadata</p>
        <h2>{{ metadataEditorDialog.id ?? "No row selected" }}</h2>
      </div>
    </template>

    <div class="dialog-body metadata-editor-dialog__body">
      <div class="record-dialog__meta metadata-editor-dialog__summary">
        <strong>Edit metadata with fields or raw JSON.</strong>
        <p>
          Use the fields mode for quick edits, or switch to raw JSON when you
          want full control. Remove every key if you want this row to save as
          <code>null</code>.
        </p>
      </div>

      <div class="query-mode-switch metadata-editor-dialog__mode-switch">
        <button
          class="query-mode-switch__button"
          :class="{
            'query-mode-switch__button--active':
              metadataEditorDialog.mode === 'fields',
          }"
          type="button"
          :disabled="isSavingMetadataEditor"
          @click="setMetadataEditorMode('fields')"
        >
          Fields
        </button>

        <button
          class="query-mode-switch__button"
          :class="{
            'query-mode-switch__button--active':
              metadataEditorDialog.mode === 'raw',
          }"
          type="button"
          :disabled="isSavingMetadataEditor"
          @click="setMetadataEditorMode('raw')"
        >
          Raw JSON
        </button>
      </div>

      <template v-if="metadataEditorDialog.mode === 'fields'">
        <div class="metadata-editor-dialog__toolbar">
          <button
            class="mini-button"
            type="button"
            :disabled="isSavingMetadataEditor"
            @click="addMetadataEditorEntry"
          >
            <i class="pi pi-plus"></i>
            <span>Add key</span>
          </button>

          <button
            class="mini-button mini-button--ghost"
            type="button"
            :disabled="
              !metadataEditorDialog.entries.length || isSavingMetadataEditor
            "
            @click="clearMetadataEditorEntries"
          >
            Clear all
          </button>
        </div>

        <div
          v-if="metadataEditorDialog.entries.length"
          class="metadata-editor-list scroll-container"
        >
          <article
            v-for="entry in metadataEditorDialog.entries"
            :key="entry.id"
            class="metadata-editor-row"
          >
            <label class="field field--compact metadata-editor-row__field">
              <span class="field__label">Key</span>
              <input v-model="entry.key" type="text" placeholder="Enter Key" />
            </label>

            <label class="field field--compact metadata-editor-row__field">
              <span class="field__label">Type</span>
              <select
                v-model="entry.valueType"
                @change="handleMetadataEditorValueTypeChange(entry)"
              >
                <option
                  v-for="valueType in METADATA_EDITOR_VALUE_TYPES"
                  :key="valueType.value"
                  :value="valueType.value"
                >
                  {{ valueType.label }}
                </option>
              </select>
            </label>

            <label class="field field--compact metadata-editor-row__field">
              <span class="field__label">Value</span>
              <select
                v-if="entry.valueType === 'boolean'"
                v-model="entry.value"
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>

              <input
                v-else
                v-model="entry.value"
                type="text"
                :inputmode="entry.valueType === 'number' ? 'decimal' : 'text'"
                placeholder="Enter Value"
              />
            </label>

            <button
              class="mini-button mini-button--ghost mini-button--icon metadata-editor-row__remove"
              type="button"
              aria-label="Remove metadata entry"
              :disabled="isSavingMetadataEditor"
              @click="removeMetadataEditorEntry(entry.id)"
            >
              <i class="pi pi-trash"></i>
            </button>
          </article>
        </div>

        <div v-else class="metadata-editor-dialog__empty">
          No metadata keys yet. Save now to store <code>null</code>, or add a
          key to build a metadata object.
        </div>
      </template>

      <label v-else class="field metadata-editor-dialog__raw-field">
        <span class="field__label">Metadata JSON</span>
        <span class="field__hint">
          Paste a JSON object or <code>null</code>. Switch back to
          <code>Fields</code> only when the metadata is flat text, number, or
          true/false values.
        </span>
        <textarea
          v-model="metadataEditorDialog.rawValue"
          class="metadata-editor-dialog__textarea scroll-container"
          rows="14"
          spellcheck="false"
          placeholder='{"topic":"auth","priority":2}'
        ></textarea>
      </label>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <button
          class="ui-button ui-button--ghost"
          type="button"
          :disabled="isSavingMetadataEditor"
          @click="closeMetadataEditor"
        >
          Cancel
        </button>

        <button
          class="ui-button ui-button--primary"
          type="button"
          :disabled="isSavingMetadataEditor"
          @click="saveMetadataEditor"
        >
          <i
            :class="
              isSavingMetadataEditor ? 'pi pi-spin pi-spinner' : 'pi pi-check'
            "
          ></i>
          <span>Save metadata</span>
        </button>
      </div>
    </template>
  </Dialog>

  <Dialog
    v-model:visible="showMetricsViewer"
    modal
    :draggable="false"
    class="metrics-dialog"
  >
    <template #header>
      <div class="dialog-heading">
        <p class="section-kicker">Collection metrics</p>
        <h2>Read the shape of this collection</h2>
      </div>
    </template>

    <div class="metrics-panel">
      <div class="panel-heading">
        <div>
          <p class="metrics-panel__copy">
            Review document, metadata, and sampled embedding metrics for the
            selected collection.
          </p>
        </div>

        <div class="query-panel__header-actions">
          <span class="tag-chip">
            {{
              currentCollection ? currentCollection.name : "Select a collection"
            }}
          </span>
        </div>
      </div>

      <div class="metrics-card-grid">
        <article
          v-for="metric in collectionMetricCards"
          :key="metric.label"
          class="metrics-summary-card"
        >
          <p class="section-kicker">{{ metric.label }}</p>
          <h3>{{ metric.value }}</h3>
          <p>{{ metric.description }}</p>
        </article>
      </div>

      <article
        class="metrics-section metrics-section--full quality-audit-section"
      >
        <div class="metrics-section__header">
          <div>
            <p class="section-kicker">Collection quality audit</p>
            <h3>Flag ingestion and consistency issues</h3>
          </div>

          <span class="metrics-section__eyebrow">
            {{ collectionQualityAudit.statusLabel }}
          </span>
        </div>

        <div class="metrics-card-grid quality-audit-summary">
          <article
            v-for="summaryCard in collectionQualityAudit.summaryCards"
            :key="summaryCard.label"
            class="metrics-summary-card quality-audit-card"
          >
            <p class="section-kicker">{{ summaryCard.label }}</p>
            <h3 :class="summaryCard.valueClass">{{ summaryCard.value }}</h3>
            <p>{{ summaryCard.description }}</p>
          </article>
        </div>

        <div
          v-if="collectionQualityAudit.pendingMessage"
          class="quality-audit-pending"
        >
          <i class="pi pi-spin pi-spinner"></i>
          <span>{{ collectionQualityAudit.pendingMessage }}</span>
        </div>

        <div
          v-if="collectionQualityAudit.findings.length"
          class="quality-audit-list"
        >
          <article
            v-for="finding in collectionQualityAudit.findings"
            :key="`${finding.category}-${finding.title}`"
            class="quality-audit-finding"
            :class="`quality-audit-finding--${finding.severity}`"
          >
            <div class="quality-audit-finding__top">
              <div>
                <p class="section-kicker">{{ finding.category }}</p>
                <h3>{{ finding.title }}</h3>
              </div>

              <span
                class="quality-audit-pill"
                :class="`quality-audit-pill--${finding.severity}`"
              >
                {{ finding.severityLabel }}
              </span>
            </div>

            <p class="quality-audit-finding__description">
              {{ finding.description }}
            </p>

            <p v-if="finding.hint" class="quality-audit-finding__hint">
              {{ finding.hint }}
            </p>
          </article>
        </div>

        <p v-else class="metrics-empty-copy quality-audit-empty">
          {{ collectionQualityAudit.emptyStateMessage }}
        </p>
      </article>

      <div class="metrics-grid">
        <article class="metrics-section">
          <div class="metrics-section__header">
            <div>
              <p class="section-kicker">Content profile</p>
              <h3>Documents at a glance</h3>
            </div>

            <span class="metrics-section__eyebrow">
              {{ collectionMetrics.documentCoverageLabel }} with text
            </span>
          </div>

          <div class="metrics-list">
            <div class="metrics-list__row">
              <span>Loaded rows</span>
              <strong>{{ formatNumber(collectionMetrics.totalRows) }}</strong>
            </div>
            <div class="metrics-list__row">
              <span>Rows with documents</span>
              <strong>{{
                formatNumber(collectionMetrics.rowsWithDocuments)
              }}</strong>
            </div>
            <div class="metrics-list__row">
              <span>Average document length</span>
              <strong
                >{{ collectionMetrics.averageWordCountLabel }} words</strong
              >
            </div>
            <div class="metrics-list__row">
              <span>Longest document</span>
              <strong
                >{{ collectionMetrics.longestDocumentWordsLabel }} words</strong
              >
            </div>
          </div>
        </article>

        <article class="metrics-section">
          <div class="metrics-section__header">
            <div>
              <p class="section-kicker">Metadata profile</p>
              <h3>Most common keys</h3>
            </div>

            <span class="metrics-section__eyebrow">
              {{ collectionMetrics.metadataKeyCountLabel }} unique
            </span>
          </div>

          <div
            v-if="collectionMetrics.topMetadataKeys.length"
            class="metrics-chip-grid"
          >
            <article
              v-for="keyStat in collectionMetrics.topMetadataKeys"
              :key="keyStat.key"
              class="metrics-chip"
            >
              <strong>{{ keyStat.key }}</strong>
              <span>{{ formatNumber(keyStat.count) }} rows</span>
              <small>{{ keyStat.coverageLabel }}</small>
            </article>
          </div>

          <p v-else class="metrics-empty-copy">
            No metadata keys were detected in the loaded rows.
          </p>
        </article>
      </div>

      <article class="metrics-section metrics-section--full">
        <div class="metrics-section__header">
          <div>
            <p class="section-kicker">Embedding sample</p>
            <h3>Vector consistency snapshot</h3>
          </div>

          <span class="metrics-section__eyebrow">
            {{
              currentCollectionData.length
                ? `Sampling up to ${formatNumber(
                    METRICS_EMBEDDING_SAMPLE_SIZE,
                  )} rows`
                : "No rows loaded"
            }}
          </span>
        </div>

        <div v-if="isLoadingMetricsEmbeddings" class="metrics-loading">
          <i class="pi pi-spin pi-spinner"></i>
          <span>Sampling embeddings for dimension and norm metrics...</span>
        </div>

        <div v-else-if="metricsEmbeddingSummary" class="metrics-embedding-grid">
          <article class="metrics-summary-card">
            <p class="section-kicker">Dominant size</p>
            <h3>
              {{
                metricsEmbeddingSummary.dominantDimension
                  ? `${formatNumber(
                      metricsEmbeddingSummary.dominantDimension,
                    )} dims`
                  : "Unavailable"
              }}
            </h3>
            <p>{{ metricsEmbeddingSummary.consistencyLabel }}</p>
          </article>

          <article class="metrics-summary-card">
            <p class="section-kicker">Vectors returned</p>
            <h3>{{ formatNumber(metricsEmbeddingSummary.returnedVectors) }}</h3>
            <p>
              {{
                metricsEmbeddingSummary.missingVectors
                  ? `${formatNumber(
                      metricsEmbeddingSummary.missingVectors,
                    )} sampled rows returned no embedding.`
                  : "Every sampled row returned an embedding."
              }}
            </p>
          </article>

          <article class="metrics-summary-card">
            <p class="section-kicker">Average norm</p>
            <h3>{{ metricsEmbeddingSummary.averageNormLabel }}</h3>
            <p>
              Norm range {{ metricsEmbeddingSummary.minNormLabel }} to
              {{ metricsEmbeddingSummary.maxNormLabel }}
              across {{ formatNumber(metricsEmbeddingSummary.sampleSize) }}
              sampled rows.
            </p>
          </article>

          <div
            v-if="metricsEmbeddingSummary.dimensionBreakdown.length"
            class="metrics-chip-grid metrics-chip-grid--wide"
          >
            <article
              v-for="dimensionStat in metricsEmbeddingSummary.dimensionBreakdown"
              :key="dimensionStat.dimension"
              class="metrics-chip"
            >
              <strong>{{ formatNumber(dimensionStat.dimension) }} dims</strong>
              <span>{{ formatNumber(dimensionStat.count) }} sampled</span>
              <small>{{ dimensionStat.coverageLabel }}</small>
            </article>
          </div>
        </div>

        <p v-else class="metrics-empty-copy">
          Open a collection with rows to analyze sampled embedding metrics.
        </p>
      </article>
    </div>
  </Dialog>

  <Dialog
    v-model:visible="showImportViewer"
    modal
    :draggable="false"
    class="import-dialog"
  >
    <template #header>
      <div class="dialog-heading">
        <p class="section-kicker">Collection import</p>
        <h2>Bring records into this collection</h2>
      </div>
    </template>

    <div class="import-panel">
      <div class="panel-heading">
        <div>
          <p class="import-panel__copy">
            Paste a JSON array or a single JSON object. Each record needs an
            <b>id</b> plus either an <b>embedding</b> or a non-empty
            <b>document</b>. Missing embeddings can be generated from document
            text. <b>metadata</b> is optional.
          </p>
        </div>

        <div class="query-panel__header-actions">
          <span class="tag-chip">
            {{
              currentCollection ? currentCollection.name : "Select a collection"
            }}
          </span>
        </div>
      </div>

      <div class="query-mode-switch">
        <button
          class="query-mode-switch__button"
          :class="{
            'query-mode-switch__button--active': importMode === 'upsert',
          }"
          type="button"
          @click="importMode = 'upsert'"
        >
          Upsert
        </button>

        <button
          class="query-mode-switch__button"
          :class="{
            'query-mode-switch__button--active': importMode === 'add',
          }"
          type="button"
          @click="importMode = 'add'"
        >
          Add only
        </button>
      </div>

      <div class="import-panel__layout">
        <div class="import-panel__form">
          <input
            ref="importFileInput"
            class="import-panel__file-input"
            type="file"
            accept=".json,application/json"
            @change="handleImportFileSelection"
          />

          <div class="import-panel__toolbar">
            <div class="import-panel__toolbar-copy">
              <p class="section-kicker">Choose a source</p>
              <h3>Paste, upload, or start from an example</h3>
            </div>

            <div class="import-source-actions">
              <button
                class="import-source-action"
                type="button"
                :disabled="Boolean(importFileName)"
                @click="triggerImportFilePicker"
              >
                <span class="import-source-action__icon">
                  <i class="pi pi-upload"></i>
                </span>
                <span class="import-source-action__copy">
                  <strong>Upload file</strong>
                  <span>Load a <code>.json</code> file.</span>
                </span>
              </button>

              <button
                class="import-source-action import-source-action--subtle"
                type="button"
                @click="loadImportExample"
              >
                <span class="import-source-action__icon">
                  <i class="pi pi-file-edit"></i>
                </span>
                <span class="import-source-action__copy">
                  <strong>Load example</strong>
                  <span>Insert a valid starter payload instantly.</span>
                </span>
              </button>
            </div>
          </div>

          <div class="import-panel__note">
            <i class="pi pi-info-circle"></i>
            <span>
              Missing embeddings are generated with
              <code>{{ semanticProviderLabel }}</code> using
              <code>{{ semanticProviderModelLabel }}</code>
              . All vectors still need to match the selected collection's
              dimension size.
            </span>
          </div>

          <section class="semantic-provider-card">
            <div class="semantic-provider-card__header">
              <div>
                <p class="section-kicker">Auto-embed provider</p>
                <h3>{{ semanticProviderLabel }}</h3>
                <p class="semantic-provider-card__copy">
                  Records without an embedding use this provider to generate
                  vectors during import.
                </p>
              </div>

              <button
                class="mini-button mini-button--ghost semantic-provider-card__toggle"
                type="button"
                :aria-expanded="showImportAutoEmbedSettings"
                @click="
                  showImportAutoEmbedSettings = !showImportAutoEmbedSettings
                "
              >
                <span>{{
                  showImportAutoEmbedSettings
                    ? "Hide settings"
                    : "Show settings"
                }}</span>
                <i
                  :class="
                    showImportAutoEmbedSettings
                      ? 'pi pi-angle-up'
                      : 'pi pi-angle-down'
                  "
                ></i>
              </button>
            </div>

            <div
              v-if="showImportAutoEmbedSettings"
              class="semantic-provider-card__status"
            >
              <span class="tag-chip semantic-provider-card__status-chip">
                <i
                  :class="
                    isResolvingCollectionEmbeddingDimension
                      ? 'pi pi-spin pi-spinner'
                      : 'pi pi-sparkles'
                  "
                ></i>
                <span>{{ semanticProviderDimensionLabel }}</span>
              </span>

              <p class="semantic-provider-card__status-copy">
                {{ semanticProviderDimensionNote }}
              </p>
            </div>

            <div
              v-if="showImportAutoEmbedSettings"
              class="semantic-provider-card__surface"
            >
              <div class="query-mode-switch semantic-provider-switch">
                <button
                  class="query-mode-switch__button"
                  :class="{
                    'query-mode-switch__button--active':
                      semanticQuerySettings.provider === 'openai',
                  }"
                  type="button"
                  @click="setSemanticProvider('openai')"
                >
                  OpenAI
                </button>

                <button
                  class="query-mode-switch__button"
                  :class="{
                    'query-mode-switch__button--active':
                      semanticQuerySettings.provider === 'ollama',
                  }"
                  type="button"
                  @click="setSemanticProvider('ollama')"
                >
                  Ollama
                </button>
              </div>

              <div
                v-if="semanticQuerySettings.provider === 'openai'"
                class="semantic-provider-grid"
              >
                <label class="field">
                  <span class="field__label">OpenAI API key</span>
                  <span class="field__hint">
                    Kept only in this session and not written into local browser
                    storage.
                  </span>
                  <input
                    v-model="semanticQueryApiKey"
                    type="password"
                    placeholder="sk-..."
                    autocomplete="off"
                  />
                </label>

                <label class="field">
                  <span class="field__label">OpenAI model</span>
                  <input
                    v-model="semanticQuerySettings.openaiModel"
                    type="text"
                    placeholder="text-embedding-3-small"
                  />
                </label>

                <label class="field">
                  <span class="field__label">Base URL</span>
                  <span class="field__hint">
                    Default: <code>https://api.openai.com/v1</code>
                  </span>
                  <input
                    v-model="semanticQuerySettings.openaiBaseUrl"
                    type="text"
                    placeholder="https://api.openai.com/v1"
                  />
                </label>

                <label class="field">
                  <span class="field__label">Dimensions</span>
                  <span class="field__hint">
                    Optional. Set this to the detected collection size when you
                    need a shorter vector.
                  </span>
                  <input
                    v-model="semanticQuerySettings.openaiDimensions"
                    type="number"
                    min="1"
                    :placeholder="
                      currentCollectionEmbeddingDimension
                        ? `${currentCollectionEmbeddingDimension}`
                        : '1536'
                    "
                  />
                </label>
              </div>

              <div v-else class="semantic-provider-grid">
                <label class="field">
                  <span class="field__label">Ollama model</span>
                  <input
                    v-model="semanticQuerySettings.ollamaModel"
                    type="text"
                    placeholder="embeddinggemma"
                  />
                </label>

                <label class="field">
                  <span class="field__label">Ollama URL</span>
                  <span class="field__hint">
                    Default: <code>http://localhost:11434</code>
                  </span>
                  <input
                    v-model="semanticQuerySettings.ollamaBaseUrl"
                    type="text"
                    placeholder="http://localhost:11434"
                  />
                </label>
              </div>
            </div>

            <p v-if="showImportAutoEmbedSettings" class="query-panel__hint">
              Current provider: {{ semanticProviderLabel }} /
              {{ semanticProviderModelLabel }}
            </p>
          </section>

          <div class="import-source-card">
            <div class="import-source-card__copy">
              <p class="section-kicker">Source</p>
              <strong>{{ importSourceLabel }}</strong>
            </div>

            <button
              v-if="importFileName"
              class="mini-button mini-button--ghost"
              type="button"
              @click="clearImportedFile"
            >
              <i class="pi pi-times"></i>
              <span>Clear file</span>
            </button>
          </div>

          <label class="field">
            <span class="field__label">Import payload</span>
            <span class="field__hint">
              Supported fields: <code>id</code>, optional
              <code>embedding</code>, optional <code>document</code> used for
              auto-embedding, and optional <code>metadata</code>.
            </span>
            <textarea
              :value="importPayload"
              class="import-panel__textarea scroll-container"
              rows="18"
              placeholder="Enter your payload here"
              @input="updateImportPayload($event.target.value)"
            ></textarea>
          </label>
        </div>

        <aside class="import-panel__guide">
          <article class="import-guide-card">
            <p class="section-kicker">Supported fields</p>
            <div class="import-guide-list">
              <div class="import-guide-row">
                <strong>id</strong>
                <span>Required unique string for every record.</span>
              </div>
              <div class="import-guide-row">
                <strong>embedding</strong>
                <span
                  >Optional JSON array of finite numbers. If omitted, a
                  non-empty document is used to generate the vector
                  automatically.</span
                >
              </div>
              <div class="import-guide-row">
                <strong>document</strong>
                <span
                  >Optional text stored with the record. Required when you want
                  the app to auto-generate the embedding.</span
                >
              </div>
              <div class="import-guide-row">
                <strong>metadata</strong>
                <span>Optional JSON object stored with the record.</span>
              </div>
            </div>
          </article>
        </aside>
      </div>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <button
          class="ui-button ui-button--ghost"
          type="button"
          :disabled="isImportingRecords"
          @click="showImportViewer = false"
        >
          Cancel
        </button>

        <button
          class="ui-button ui-button--primary"
          type="button"
          :disabled="!currentCollection || isImportingRecords"
          @click="handleImportRecords"
        >
          <i
            :class="
              isImportingRecords ? 'pi pi-spin pi-spinner' : 'pi pi-upload'
            "
          ></i>
          <span>{{ importActionLabel }}</span>
        </button>
      </div>
    </template>
  </Dialog>

  <Dialog
    v-model:visible="showQueryViewer"
    modal
    :draggable="false"
    class="query-dialog"
  >
    <template #header>
      <div class="dialog-heading">
        <p class="section-kicker">Collection query</p>
        <h2>Search this collection</h2>
      </div>
    </template>

    <div class="query-panel query-panel--dialog">
      <div class="query-panel__form">
        <section class="query-panel__form-section">
          <div class="panel-heading">
            <div>
              <p class="query-panel__copy">
                Enter query text or a JSON embedding to find the most similar
                records in the current collection.
              </p>
            </div>

            <div class="query-panel__header-actions">
              <span class="tag-chip">
                {{
                  currentCollection
                    ? currentCollection.name
                    : "Select a collection"
                }}
              </span>
            </div>
          </div>

          <div class="query-mode-switch">
            <button
              class="query-mode-switch__button"
              :class="{
                'query-mode-switch__button--active': queryMode === 'semantic',
              }"
              type="button"
              @click="queryMode = 'semantic'"
            >
              Semantic text
            </button>

            <button
              class="query-mode-switch__button"
              :class="{
                'query-mode-switch__button--active': queryMode === 'embedding',
              }"
              type="button"
              @click="queryMode = 'embedding'"
            >
              Embedding JSON
            </button>
          </div>
          <p class="query-panel__hint">
            Semantic text mode always generates an embedding first. Embedding
            JSON mode skips that step and queries Chroma directly.
          </p>

          <label class="field">
            <span class="field__label">
              {{
                queryMode === "semantic" ? "Semantic query" : "Query embedding"
              }}
            </span>
            <span class="field__hint">
              {{
                queryMode === "semantic"
                  ? "This mode embeds your text first using the selected embedding provider."
                  : "Paste a JSON array of numbers to query with a vector directly."
              }}
            </span>

            <textarea
              v-if="queryMode === 'embedding'"
              v-model="queryEmbedding"
              rows="8"
              placeholder="[0.12, -0.44, 0.87, 0.03]"
            ></textarea>

            <textarea
              v-else
              v-model="queryText"
              rows="4"
              placeholder="Enter your query text here"
            ></textarea>
          </label>

          <section class="semantic-provider-card">
            <div class="semantic-provider-card__header">
              <div>
                <p class="section-kicker">Query filters</p>
                <h3>Optional Chroma filters</h3>
              </div>

              <button
                class="mini-button mini-button--ghost semantic-provider-card__toggle"
                type="button"
                :aria-expanded="showQueryFilters"
                @click="showQueryFilters = !showQueryFilters"
              >
                <span>{{
                  showQueryFilters ? "Hide filters" : "Show filters"
                }}</span>
                <i
                  :class="
                    showQueryFilters ? 'pi pi-angle-up' : 'pi pi-angle-down'
                  "
                ></i>
              </button>
            </div>

            <div class="semantic-provider-card__status">
              <span class="tag-chip semantic-provider-card__status-chip">
                <i class="pi pi-filter"></i>
                <span>{{ queryFilterStatusLabel }}</span>
              </span>

              <p class="semantic-provider-card__status-copy">
                {{ queryFilterStatusCopy }}
              </p>
            </div>

            <div v-if="showQueryFilters" class="query-filter-builder">
              <section class="query-filter-builder__section">
                <div class="query-filter-builder__header">
                  <div>
                    <p class="section-kicker">Metadata</p>
                    <h4><code>where</code> rules</h4>
                  </div>

                  <span class="tag-chip">
                    {{
                      activeQueryWhereRules.length
                        ? `${activeQueryWhereRules.length} active`
                        : "Optional"
                    }}
                  </span>
                </div>

                <p class="query-filter-builder__copy">
                  Narrow matches by requiring or excluding specific metadata
                  key-value pairs in the stored records.
                </p>

                <div class="metadata-filter-mode-switch">
                  <button
                    class="metadata-filter-mode-switch__button"
                    :class="{
                      'metadata-filter-mode-switch__button--active':
                        queryWhereMode === 'all',
                    }"
                    type="button"
                    @click="queryWhereMode = 'all'"
                  >
                    Match all
                  </button>

                  <button
                    class="metadata-filter-mode-switch__button"
                    :class="{
                      'metadata-filter-mode-switch__button--active':
                        queryWhereMode === 'any',
                    }"
                    type="button"
                    @click="queryWhereMode = 'any'"
                  >
                    Match any
                  </button>
                </div>

                <div class="metadata-filter-menu__toolbar">
                  <button
                    class="mini-button"
                    type="button"
                    @click="addQueryWhereRule"
                  >
                    <i class="pi pi-plus"></i>
                    <span>Add metadata rule</span>
                  </button>

                  <button
                    class="mini-button mini-button--ghost"
                    type="button"
                    :disabled="!queryWhereRules.length"
                    @click="clearQueryWhereRules"
                  >
                    Clear metadata rules
                  </button>
                </div>

                <div
                  v-if="queryWhereRules.length"
                  class="metadata-filter-rule-list query-filter-rule-list"
                >
                  <article
                    v-for="rule in queryWhereRules"
                    :key="rule.id"
                    class="metadata-filter-rule"
                  >
                    <div class="metadata-filter-rule__fields">
                      <label
                        class="field field--compact metadata-filter-key-field"
                      >
                        <span class="field__label">Key</span>
                        <div class="metadata-filter-key-input-wrap">
                          <input
                            v-model="rule.key"
                            type="text"
                            placeholder="Enter key"
                            @focus="handleQueryWhereKeyFocus(rule.id)"
                            @blur="handleQueryWhereKeyBlur"
                          />

                          <div
                            v-if="shouldShowQueryWhereKeySuggestions(rule)"
                            class="metadata-filter-key-dropdown"
                          >
                            <button
                              v-for="suggestion in getQueryWhereKeySuggestions(
                                rule,
                              )"
                              :key="suggestion"
                              class="metadata-filter-key-option"
                              type="button"
                              @mousedown.prevent="
                                selectQueryWhereKey(rule, suggestion)
                              "
                            >
                              <span>{{ suggestion }}</span>
                            </button>
                          </div>
                        </div>
                      </label>

                      <label class="field field--compact">
                        <span class="field__label">Operator</span>
                        <select
                          v-model="rule.operator"
                          class="metadata-filter-select"
                          @change="handleQueryWhereOperatorChange(rule)"
                        >
                          <option
                            v-for="operator in QUERY_WHERE_OPERATORS"
                            :key="operator.value"
                            :value="operator.value"
                          >
                            {{ operator.label }}
                          </option>
                        </select>
                      </label>

                      <label class="field field--compact">
                        <span class="field__label">Value type</span>
                        <select
                          v-model="rule.valueType"
                          class="metadata-filter-select"
                          :disabled="
                            Boolean(getQueryWhereForcedValueType(rule.operator))
                          "
                          @change="handleQueryWhereValueTypeChange(rule)"
                        >
                          <option
                            v-for="valueType in QUERY_FILTER_VALUE_TYPES"
                            :key="valueType.value"
                            :value="valueType.value"
                          >
                            {{ valueType.label }}
                          </option>
                        </select>
                      </label>

                      <label class="field field--compact">
                        <span class="field__label">Value</span>
                        <select
                          v-if="
                            normalizeQueryWhereValueType(
                              rule.valueType,
                              rule.operator,
                            ) === 'boolean'
                          "
                          v-model="rule.value"
                          class="metadata-filter-select"
                        >
                          <option value="true">True</option>
                          <option value="false">False</option>
                        </select>

                        <input
                          v-else
                          v-model="rule.value"
                          :type="
                            normalizeQueryWhereValueType(
                              rule.valueType,
                              rule.operator,
                            ) === 'number'
                              ? 'number'
                              : 'text'
                          "
                          :placeholder="
                            normalizeQueryWhereValueType(
                              rule.valueType,
                              rule.operator,
                            ) === 'number'
                              ? 'Enter number'
                              : 'Enter value'
                          "
                        />
                      </label>
                    </div>

                    <button
                      class="mini-button mini-button--ghost mini-button--icon metadata-filter-rule__remove"
                      type="button"
                      aria-label="Remove metadata query rule"
                      @click="removeQueryWhereRule(rule.id)"
                    >
                      <i class="pi pi-times"></i>
                    </button>
                  </article>
                </div>

                <div v-else class="metadata-filter-menu__empty">
                  No metadata query rules yet. Click
                  <code>Add metadata rule</code> to narrow results before Chroma
                  ranks them.
                </div>
              </section>

              <section class="query-filter-builder__section">
                <div class="query-filter-builder__header">
                  <div>
                    <p class="section-kicker">Document text</p>
                    <h4><code>where_document</code> rules</h4>
                  </div>

                  <span class="tag-chip">
                    {{
                      activeQueryWhereDocumentRules.length
                        ? `${activeQueryWhereDocumentRules.length} active`
                        : "Optional"
                    }}
                  </span>
                </div>

                <p class="query-filter-builder__copy">
                  Narrow matches by requiring or excluding terms in the stored
                  document text.
                </p>

                <div class="metadata-filter-mode-switch">
                  <button
                    class="metadata-filter-mode-switch__button"
                    :class="{
                      'metadata-filter-mode-switch__button--active':
                        queryWhereDocumentMode === 'all',
                    }"
                    type="button"
                    @click="queryWhereDocumentMode = 'all'"
                  >
                    Match all
                  </button>

                  <button
                    class="metadata-filter-mode-switch__button"
                    :class="{
                      'metadata-filter-mode-switch__button--active':
                        queryWhereDocumentMode === 'any',
                    }"
                    type="button"
                    @click="queryWhereDocumentMode = 'any'"
                  >
                    Match any
                  </button>
                </div>

                <div class="metadata-filter-menu__toolbar">
                  <button
                    class="mini-button"
                    type="button"
                    @click="addQueryWhereDocumentRule"
                  >
                    <i class="pi pi-plus"></i>
                    <span>Add document rule</span>
                  </button>

                  <button
                    class="mini-button mini-button--ghost"
                    type="button"
                    :disabled="!queryWhereDocumentRules.length"
                    @click="clearQueryWhereDocumentRules"
                  >
                    Clear document rules
                  </button>
                </div>

                <div
                  v-if="queryWhereDocumentRules.length"
                  class="metadata-filter-rule-list query-filter-rule-list"
                >
                  <article
                    v-for="rule in queryWhereDocumentRules"
                    :key="rule.id"
                    class="metadata-filter-rule"
                  >
                    <div class="metadata-filter-rule__fields">
                      <label class="field field--compact">
                        <span class="field__label">Operator</span>
                        <select
                          v-model="rule.operator"
                          class="metadata-filter-select"
                        >
                          <option
                            v-for="operator in QUERY_WHERE_DOCUMENT_OPERATORS"
                            :key="operator.value"
                            :value="operator.value"
                          >
                            {{ operator.label }}
                          </option>
                        </select>
                      </label>

                      <label class="field field--compact">
                        <span class="field__label">Value</span>
                        <input
                          v-model="rule.value"
                          type="text"
                          :placeholder="
                            rule.operator.includes('regex')
                              ? 'Enter regex pattern'
                              : 'Enter term'
                          "
                        />
                      </label>
                    </div>

                    <button
                      class="mini-button mini-button--ghost mini-button--icon metadata-filter-rule__remove"
                      type="button"
                      aria-label="Remove document query rule"
                      @click="removeQueryWhereDocumentRule(rule.id)"
                    >
                      <i class="pi pi-times"></i>
                    </button>
                  </article>
                </div>

                <div v-else class="metadata-filter-menu__empty">
                  No document query rules yet. Click
                  <code>Add document rule</code> to narrow results before Chroma
                  ranks them.
                </div>
              </section>
            </div>
          </section>

          <section
            v-if="queryMode === 'semantic'"
            class="semantic-provider-card"
          >
            <div class="semantic-provider-card__header">
              <div>
                <p class="section-kicker">Embedding provider</p>
                <h3>{{ semanticProviderLabel }}</h3>
              </div>

              <button
                class="mini-button mini-button--ghost semantic-provider-card__toggle"
                type="button"
                :aria-expanded="showQueryAutoEmbedSettings"
                @click="
                  showQueryAutoEmbedSettings = !showQueryAutoEmbedSettings
                "
              >
                <span>{{
                  showQueryAutoEmbedSettings ? "Hide settings" : "Show settings"
                }}</span>
                <i
                  :class="
                    showQueryAutoEmbedSettings
                      ? 'pi pi-angle-up'
                      : 'pi pi-angle-down'
                  "
                ></i>
              </button>
            </div>

            <div class="import-panel__note">
              <i class="pi pi-sparkles"></i>
              <span>
                Semantic queries are converted to embeddings using the selected
                provider.
              </span>
            </div>

            <div v-if="showQueryAutoEmbedSettings" class="import-panel__note">
              <i class="pi pi-info-circle"></i>
              <span>
                Semantic search works best when the provider model matches the
                one that created this collection's embeddings.
              </span>
            </div>

            <div
              v-if="showQueryAutoEmbedSettings"
              class="semantic-provider-card__status"
            >
              <span class="tag-chip semantic-provider-card__status-chip">
                <i
                  :class="
                    isResolvingCollectionEmbeddingDimension
                      ? 'pi pi-spin pi-spinner'
                      : 'pi pi-sparkles'
                  "
                ></i>
                <span>{{ semanticProviderDimensionLabel }}</span>
              </span>

              <p class="semantic-provider-card__status-copy">
                {{ semanticProviderDimensionNote }}
              </p>
            </div>

            <div
              v-if="showQueryAutoEmbedSettings"
              class="semantic-provider-card__surface"
            >
              <div class="query-mode-switch semantic-provider-switch">
                <button
                  class="query-mode-switch__button"
                  :class="{
                    'query-mode-switch__button--active':
                      semanticQuerySettings.provider === 'openai',
                  }"
                  type="button"
                  @click="setSemanticProvider('openai')"
                >
                  OpenAI
                </button>

                <button
                  class="query-mode-switch__button"
                  :class="{
                    'query-mode-switch__button--active':
                      semanticQuerySettings.provider === 'ollama',
                  }"
                  type="button"
                  @click="setSemanticProvider('ollama')"
                >
                  Ollama
                </button>
              </div>

              <div
                v-if="semanticQuerySettings.provider === 'openai'"
                class="semantic-provider-grid"
              >
                <label class="field">
                  <span class="field__label">OpenAI API key</span>
                  <span class="field__hint">
                    Kept only in this session and not written into local browser
                    storage.
                  </span>
                  <input
                    v-model="semanticQueryApiKey"
                    type="password"
                    placeholder="sk-..."
                    autocomplete="off"
                  />
                </label>

                <label class="field">
                  <span class="field__label">OpenAI model</span>
                  <input
                    v-model="semanticQuerySettings.openaiModel"
                    type="text"
                    placeholder="text-embedding-3-small"
                  />
                </label>

                <label class="field">
                  <span class="field__label">Base URL</span>
                  <span class="field__hint">
                    Default: <code>https://api.openai.com/v1</code>
                  </span>
                  <input
                    v-model="semanticQuerySettings.openaiBaseUrl"
                    type="text"
                    placeholder="https://api.openai.com/v1"
                  />
                </label>

                <label class="field">
                  <span class="field__label">Dimensions</span>
                  <span class="field__hint">
                    Optional. Set this to the detected collection size when you
                    need a shorter vector.
                  </span>
                  <input
                    v-model="semanticQuerySettings.openaiDimensions"
                    type="number"
                    min="1"
                    :placeholder="
                      currentCollectionEmbeddingDimension
                        ? `${currentCollectionEmbeddingDimension}`
                        : '1536'
                    "
                  />
                </label>
              </div>

              <div v-else class="semantic-provider-grid">
                <label class="field">
                  <span class="field__label">Ollama model</span>
                  <input
                    v-model="semanticQuerySettings.ollamaModel"
                    type="text"
                    placeholder="embeddinggemma"
                  />
                </label>

                <label class="field">
                  <span class="field__label">Ollama URL</span>
                  <span class="field__hint">
                    Default: <code>http://localhost:11434</code>
                  </span>
                  <input
                    v-model="semanticQuerySettings.ollamaBaseUrl"
                    type="text"
                    placeholder="http://localhost:11434"
                  />
                </label>
              </div>
            </div>

            <p v-if="showQueryAutoEmbedSettings" class="query-panel__hint">
              Current provider: {{ semanticProviderLabel }} /
              {{ semanticProviderModelLabel }}
            </p>
          </section>

          <div class="query-panel__controls">
            <label class="field field--compact query-panel__count">
              <span class="field__label">Result count</span>
              <input
                v-model="queryResultCount"
                type="number"
                min="1"
                max="25"
              />
            </label>

            <button
              class="ui-button ui-button--primary"
              type="button"
              :disabled="!currentCollection || isQueryingCollection"
              @click="runCollectionQuery"
            >
              <i
                :class="
                  isQueryingCollection
                    ? 'pi pi-spin pi-spinner'
                    : 'pi pi-search'
                "
              ></i>
              <span>Run query</span>
            </button>
          </div>
        </section>

        <section class="query-history query-panel__history-section">
          <div class="query-history__header">
            <div>
              <p class="section-kicker">Recent queries</p>
              <h3>
                {{
                  currentCollectionQueryHistory.length
                    ? `${currentCollectionQueryHistory.length} saved`
                    : "No saved queries yet"
                }}
              </h3>
            </div>

            <button
              v-if="currentCollectionQueryHistory.length"
              class="mini-button mini-button--ghost"
              type="button"
              @click="clearCurrentCollectionQueryHistory"
            >
              Clear history
            </button>
          </div>

          <div
            v-if="currentCollectionQueryHistory.length"
            class="query-history__list scroll-container"
          >
            <article
              v-for="entry in currentCollectionQueryHistory"
              :key="entry.id"
              class="query-history-card"
            >
              <div class="query-history-card__top">
                <span class="query-history-card__mode">
                  {{
                    entry.mode === "embedding"
                      ? "Embedding JSON"
                      : "Semantic text"
                  }}
                </span>
                <span class="query-history-card__time">
                  {{ formatQueryHistoryTimestamp(entry.timestamp) }}
                </span>
              </div>

              <strong class="query-history-card__preview">
                {{ entry.preview }}
              </strong>

              <p class="query-history-card__summary">
                {{ entry.summary }} • {{ entry.resultCount }} requested
              </p>

              <p
                v-if="getQueryHistoryFilterLabel(entry)"
                class="query-history-card__filters"
              >
                Filters: {{ getQueryHistoryFilterLabel(entry) }}
              </p>

              <div class="query-history-card__actions">
                <button
                  class="mini-button mini-button--ghost"
                  type="button"
                  @click="applyQueryHistoryEntry(entry)"
                >
                  Restore
                </button>

                <button
                  class="mini-button"
                  type="button"
                  @click="rerunQueryHistoryEntry(entry)"
                >
                  <i class="pi pi-history"></i>
                  <span>Run again</span>
                </button>
              </div>
            </article>
          </div>

          <div v-else class="query-history__empty">
            Successful queries from this collection will appear here for quick
            reuse.
          </div>
        </section>
      </div>

      <div ref="queryResultsSection" class="query-panel__results">
        <div class="query-panel__results-header">
          <div>
            <p class="section-kicker">Results</p>
            <h2>
              {{
                hasQueryResults
                  ? `${queryResults.length} matches`
                  : "No query results yet"
              }}
            </h2>
          </div>

          <span v-if="lastQuerySummary" class="query-panel__summary">
            {{ lastQuerySummary }}
          </span>
        </div>

        <div v-if="hasQueryResults" class="query-results-grid scroll-container">
          <article
            v-for="result in queryResults"
            :key="result.id"
            class="query-result-card"
          >
            <div class="query-result-card__top">
              <strong>{{ result.id }}</strong>
              <span>{{ getQueryResultLabel(result) }}</span>
            </div>

            <div class="query-result-card__body">
              <section class="query-result-card__section">
                <p class="section-kicker query-result-card__label">Document</p>

                <div
                  class="query-result-card__document-shell"
                  :class="{
                    'query-result-card__document-shell--empty':
                      !result.document,
                  }"
                >
                  <p v-if="result.document" class="query-result-card__document">
                    {{ result.document }}
                  </p>

                  <div
                    v-else
                    class="query-result-card__document query-result-card__document--empty"
                  >
                    <span class="query-result-card__document-empty-icon">
                      <i class="pi pi-file"></i>
                    </span>
                    <strong class="query-result-card__document-empty-title">
                      No document returned
                    </strong>
                    <span class="query-result-card__document-empty-copy">
                      This match came back without stored document text.
                    </span>
                  </div>
                </div>
              </section>

              <section
                class="query-result-card__section query-result-card__section--metadata"
              >
                <p class="section-kicker query-result-card__label">Metadata</p>

                <code
                  class="query-result-card__metadata hljs json-highlight"
                  v-html="highlightJsonValue(result.metadata ?? 'null')"
                ></code>
              </section>
            </div>

            <div class="query-result-card__actions">
              <button
                class="mini-button mini-button--ghost"
                type="button"
                @click="focusQueryResult(result.id)"
              >
                Find in table
              </button>

              <button
                class="mini-button mini-button--ghost"
                type="button"
                @click="openEmbeddingDialog(result.id)"
              >
                Vector
              </button>
            </div>
          </article>
        </div>

        <div v-else class="query-panel__empty">
          {{
            hasCompletedQuery
              ? "No results found for the last query."
              : "Run a query to see the nearest matches from the selected collection."
          }}
        </div>
      </div>
    </div>
  </Dialog>

  <Dialog
    v-model:visible="embeddingDialog.visible"
    modal
    :draggable="false"
    class="embedding-dialog"
    @hide="closeEmbeddingDialog"
  >
    <template #header>
      <div class="dialog-heading">
        <p class="section-kicker">Embedding viewer</p>
        <h2>{{ embeddingDialog.id ?? "No record selected" }}</h2>
      </div>
    </template>

    <div class="dialog-body">
      <div
        v-if="isEmbeddingPreviewLoading(embeddingDialog.id)"
        class="embedding-dialog__loading"
      >
        <i class="pi pi-spin pi-spinner"></i>
        <span>Loading vector values...</span>
      </div>

      <template v-else-if="activeEmbeddingPreview">
        <div class="embedding-dialog__summary">
          <div class="embedding-summary-card">
            <span>Dimensions</span>
            <strong>{{
              formatNumber(activeEmbeddingPreview.dimensions)
            }}</strong>
          </div>
          <div class="embedding-summary-card">
            <span>Norm</span>
            <strong>{{ activeEmbeddingPreview.normLabel }}</strong>
          </div>
          <div class="embedding-summary-card">
            <span>Min</span>
            <strong>{{ activeEmbeddingPreview.minLabel }}</strong>
          </div>
          <div class="embedding-summary-card">
            <span>Max</span>
            <strong>{{ activeEmbeddingPreview.maxLabel }}</strong>
          </div>
        </div>

        <div class="embedding-dialog__toolbar">
          <p>{{ activeEmbeddingWindowRange }}</p>

          <div class="embedding-dialog__toolbar-actions">
            <button
              class="mini-button mini-button--ghost"
              type="button"
              @click="startEmbeddingEdit(embeddingDialog.id)"
            >
              <span>{{
                isEmbeddingEditing(embeddingDialog.id)
                  ? "Editing"
                  : "Edit vector"
              }}</span>
            </button>

            <button
              class="mini-button mini-button--ghost"
              type="button"
              :disabled="embeddingDialogOffset === 0"
              @click="moveEmbeddingDialogWindow(-1)"
            >
              Previous
            </button>

            <button
              class="mini-button mini-button--ghost"
              type="button"
              :disabled="
                embeddingDialogOffset + EMBEDDING_DIALOG_WINDOW_SIZE >=
                activeEmbeddingVector.length
              "
              @click="moveEmbeddingDialogWindow(1)"
            >
              Next
            </button>
          </div>
        </div>

        <div
          v-if="isEmbeddingEditing(embeddingDialog.id)"
          class="embedding-editor embedding-editor--dialog"
        >
          <div class="embedding-editor__header">
            <div>
              <p class="section-kicker">Edit embedding</p>
              <p class="embedding-editor__copy">
                Edit the full vector as JSON. Saving updates the record in
                Chroma immediately.
              </p>
            </div>
          </div>

          <textarea
            class="embedding-editor__textarea scroll-container"
            rows="12"
            :value="getEmbeddingDraft(embeddingDialog.id)"
            @input="
              updateEmbeddingDraft(embeddingDialog.id, $event.target.value)
            "
          ></textarea>

          <div class="embedding-editor__footer">
            <span class="embedding-editor__hint">
              {{
                activeEmbeddingPreview
                  ? `${formatNumber(activeEmbeddingPreview.dimensions)} values expected`
                  : "Vector dimension unavailable"
              }}
            </span>

            <div class="embedding-editor__actions">
              <button
                class="mini-button mini-button--ghost"
                type="button"
                :disabled="isSavingEmbedding(embeddingDialog.id)"
                @click="cancelEmbeddingEdit(embeddingDialog.id)"
              >
                Cancel
              </button>

              <button
                class="mini-button"
                type="button"
                :disabled="isSavingEmbedding(embeddingDialog.id)"
                @click="saveEmbedding(embeddingDialog.id)"
              >
                <i
                  :class="
                    isSavingEmbedding(embeddingDialog.id)
                      ? 'pi pi-spin pi-spinner'
                      : 'pi pi-check'
                  "
                ></i>
                <span>Save vector</span>
              </button>
            </div>
          </div>
        </div>

        <div class="embedding-dialog__grid scroll-container">
          <article
            v-for="chunk in activeEmbeddingChunks"
            :key="`${chunk.start}-${chunk.end}`"
            class="embedding-vector-chunk"
          >
            <div class="embedding-vector-chunk__label">
              v[{{ chunk.start }}-{{ chunk.end }}]
            </div>
            <code>{{ chunk.values.join(", ") }}</code>
          </article>
        </div>
      </template>

      <div v-else class="embedding-dialog__empty">
        No embedding values are loaded for this record yet.
      </div>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <button
          class="ui-button ui-button--ghost"
          type="button"
          @click="closeEmbeddingDialog"
        >
          Close
        </button>

        <button
          class="ui-button ui-button--secondary"
          type="button"
          :disabled="!activeEmbeddingVector.length"
          @click="copyActiveEmbedding"
        >
          <i class="pi pi-copy"></i>
          <span>Copy vector JSON</span>
        </button>
      </div>
    </template>
  </Dialog>

  <Dialog
    v-model:visible="showCreateRecordForm"
    modal
    :draggable="false"
    class="record-dialog"
    @hide="resetCreateRecordState"
  >
    <template #header>
      <div class="dialog-heading">
        <p class="section-kicker">Create record</p>
        <h2>Add a new row to this collection</h2>
      </div>
    </template>

    <div class="dialog-body record-dialog__body">
      <div class="record-dialog__meta">
        <span class="tag-chip">
          {{
            currentCollection ? currentCollection.name : "Select a collection"
          }}
        </span>
        <p>
          Add a single record with either a pasted embedding or a document that
          can be embedded automatically with
          <code>{{ semanticProviderLabel }}</code> using
          <code>{{ semanticProviderModelLabel }}</code
          >.
        </p>
      </div>

      <section class="semantic-provider-card">
        <div class="semantic-provider-card__header">
          <div>
            <p class="section-kicker">Auto-embed provider</p>
            <h3>{{ semanticProviderLabel }}</h3>
            <p class="semantic-provider-card__copy">
              Leave the embedding field empty to generate the vector from the
              document text with this provider.
            </p>
          </div>

          <button
            class="mini-button mini-button--ghost semantic-provider-card__toggle"
            type="button"
            :aria-expanded="showCreateRecordAutoEmbedSettings"
            @click="
              showCreateRecordAutoEmbedSettings =
                !showCreateRecordAutoEmbedSettings
            "
          >
            <span>{{
              showCreateRecordAutoEmbedSettings
                ? "Hide settings"
                : "Show settings"
            }}</span>
            <i
              :class="
                showCreateRecordAutoEmbedSettings
                  ? 'pi pi-angle-up'
                  : 'pi pi-angle-down'
              "
            ></i>
          </button>
        </div>

        <div
          v-if="showCreateRecordAutoEmbedSettings"
          class="semantic-provider-card__status"
        >
          <span class="tag-chip semantic-provider-card__status-chip">
            <i
              :class="
                isResolvingCollectionEmbeddingDimension
                  ? 'pi pi-spin pi-spinner'
                  : 'pi pi-sparkles'
              "
            ></i>
            <span>{{ semanticProviderDimensionLabel }}</span>
          </span>

          <p class="semantic-provider-card__status-copy">
            {{ semanticProviderDimensionNote }}
          </p>
        </div>

        <div
          v-if="showCreateRecordAutoEmbedSettings"
          class="semantic-provider-card__surface"
        >
          <div class="query-mode-switch semantic-provider-switch">
            <button
              class="query-mode-switch__button"
              :class="{
                'query-mode-switch__button--active':
                  semanticQuerySettings.provider === 'openai',
              }"
              type="button"
              @click="setSemanticProvider('openai')"
            >
              OpenAI
            </button>

            <button
              class="query-mode-switch__button"
              :class="{
                'query-mode-switch__button--active':
                  semanticQuerySettings.provider === 'ollama',
              }"
              type="button"
              @click="setSemanticProvider('ollama')"
            >
              Ollama
            </button>
          </div>

          <div
            v-if="semanticQuerySettings.provider === 'openai'"
            class="semantic-provider-grid"
          >
            <label class="field">
              <span class="field__label">OpenAI API key</span>
              <span class="field__hint">
                Kept only in this session and not written into local browser
                storage.
              </span>
              <input
                v-model="semanticQueryApiKey"
                type="password"
                placeholder="sk-..."
                autocomplete="off"
              />
            </label>

            <label class="field">
              <span class="field__label">OpenAI model</span>
              <input
                v-model="semanticQuerySettings.openaiModel"
                type="text"
                placeholder="text-embedding-3-small"
              />
            </label>

            <label class="field">
              <span class="field__label">Base URL</span>
              <span class="field__hint">
                Default: <code>https://api.openai.com/v1</code>
              </span>
              <input
                v-model="semanticQuerySettings.openaiBaseUrl"
                type="text"
                placeholder="https://api.openai.com/v1"
              />
            </label>

            <label class="field">
              <span class="field__label">Dimensions</span>
              <span class="field__hint">
                Optional. Set this to the detected collection size when you need
                a shorter vector.
              </span>
              <input
                v-model="semanticQuerySettings.openaiDimensions"
                type="number"
                min="1"
                :placeholder="
                  currentCollectionEmbeddingDimension
                    ? `${currentCollectionEmbeddingDimension}`
                    : '1536'
                "
              />
            </label>
          </div>

          <div v-else class="semantic-provider-grid">
            <label class="field">
              <span class="field__label">Ollama model</span>
              <input
                v-model="semanticQuerySettings.ollamaModel"
                type="text"
                placeholder="embeddinggemma"
              />
            </label>

            <label class="field">
              <span class="field__label">Ollama URL</span>
              <span class="field__hint">
                Default: <code>http://localhost:11434</code>
              </span>
              <input
                v-model="semanticQuerySettings.ollamaBaseUrl"
                type="text"
                placeholder="http://localhost:11434"
              />
            </label>
          </div>
        </div>

        <p v-if="showCreateRecordAutoEmbedSettings" class="query-panel__hint">
          Current provider: {{ semanticProviderLabel }} /
          {{ semanticProviderModelLabel }}
        </p>
      </section>

      <div class="record-dialog__grid">
        <label class="field record-dialog__field--wide">
          <span class="field__label">Record ID</span>
          <span class="field__hint">Use a unique ID.</span>
          <input
            v-model="createRecordData.id"
            type="text"
            placeholder="support-004"
          />
        </label>

        <label class="field">
          <span class="field__label">Document</span>
          <span class="field__hint"
            >Optional plain text stored alongside the vector.</span
          >
          <textarea
            v-model="createRecordData.document"
            rows="7"
            placeholder="Customer asked how to rotate an API key safely."
          ></textarea>
        </label>

        <label class="field">
          <span class="field__label">Metadata</span>
          <span class="field__hint">Optional JSON object.</span>
          <textarea
            v-model="createRecordData.metadata"
            rows="7"
            placeholder='{"topic":"security","lang":"en"}'
          ></textarea>
        </label>

        <label class="field record-dialog__field--wide">
          <span class="field__label">Embedding</span>
          <span class="field__hint"
            >Optional JSON array of finite numbers. Leave this empty to
            auto-generate the vector from the document text.</span
          >
          <textarea
            v-model="createRecordData.embedding"
            rows="9"
            placeholder="[0.12, -0.44, 0.87, 0.03]"
          ></textarea>
        </label>
      </div>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <button
          class="ui-button ui-button--ghost"
          type="button"
          :disabled="isCreatingRecord"
          @click="resetCreateRecordState"
        >
          Cancel
        </button>

        <button
          class="ui-button ui-button--primary"
          type="button"
          :disabled="!currentCollection || isCreatingRecord"
          @click="handleCreateRecord"
        >
          <i
            :class="
              isCreatingRecord ? 'pi pi-spin pi-spinner' : 'pi pi-plus-circle'
            "
          ></i>
          <span>Create record</span>
        </button>
      </div>
    </template>
  </Dialog>

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
          <i
            :class="
              isCreatingCollection ? 'pi pi-spin pi-spinner' : 'pi pi-plus'
            "
          ></i>
          <span>Create collection</span>
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
          <i
            :class="
              isEditingCollection ? 'pi pi-spin pi-spinner' : 'pi pi-check'
            "
          ></i>
          <span>Save changes</span>
        </button>
      </div>
    </template>
  </Dialog>

  <Dialog
    v-model:visible="showCloneCollectionForm"
    modal
    :draggable="false"
    :closable="!isCloningCollection"
    class="collection-dialog collection-clone-dialog"
    @hide="resetCloneCollectionState"
  >
    <template #header>
      <div class="dialog-heading">
        <p class="section-kicker">Clone collection</p>
        <h2>Copy this namespace into a new one</h2>
      </div>
    </template>

    <div class="dialog-body">
      <div class="record-dialog__meta collection-clone-dialog__summary">
        <strong>{{
          selectedCollection?.name ?? "No collection selected"
        }}</strong>
        <p>
          Duplicate the collection settings, then decide whether the new
          namespace should also copy every stored row.
        </p>

        <div class="collection-clone-dialog__facts">
          <div class="collection-clone-dialog__fact">
            <span>Source collection</span>
            <strong>{{ selectedCollection?.name ?? "Unknown" }}</strong>
          </div>

          <div class="collection-clone-dialog__fact">
            <span>Copy plan</span>
            <strong>
              {{
                selectedCollection &&
                currentCollection &&
                selectedCollection.id === currentCollection.id
                  ? `${formatNumber(currentCollectionData.length)} loaded rows ready to copy`
                  : cloneCollectionData.includeRecords
                    ? "Rows will be fetched directly from Chroma"
                    : "Create an empty copy"
              }}
            </strong>
          </div>
        </div>
      </div>

      <div class="query-mode-switch collection-clone-dialog__mode-switch">
        <button
          class="query-mode-switch__button"
          :class="{
            'query-mode-switch__button--active':
              cloneCollectionData.includeRecords,
          }"
          type="button"
          :disabled="isCloningCollection"
          @click="cloneCollectionData.includeRecords = true"
        >
          Copy rows
        </button>

        <button
          class="query-mode-switch__button"
          :class="{
            'query-mode-switch__button--active':
              !cloneCollectionData.includeRecords,
          }"
          type="button"
          :disabled="isCloningCollection"
          @click="cloneCollectionData.includeRecords = false"
        >
          Settings only
        </button>
      </div>

      <p class="field__hint collection-clone-dialog__mode-hint">
        {{
          cloneCollectionData.includeRecords
            ? "The clone keeps the same row IDs, documents, embeddings, metadata, and URIs in the new collection."
            : "Only the collection shell and metadata are copied. No rows are written to the new collection."
        }}
      </p>

      <label class="field">
        <span class="field__label">New collection name</span>
        <span class="field__hint"
          >Choose a fresh namespace for the cloned collection.</span
        >
        <input
          v-model="cloneCollectionData.name"
          type="text"
          placeholder="customer-support-copy"
        />
      </label>

      <label class="field">
        <span class="field__label">Metadata</span>
        <span class="field__hint"
          >Review or edit the cloned collection metadata before creating
          it.</span
        >
        <textarea
          v-model="cloneCollectionData.metadata"
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
          :disabled="isCloningCollection"
          @click="resetCloneCollectionState"
        >
          Cancel
        </button>

        <button
          class="ui-button ui-button--primary"
          type="button"
          :disabled="isCloningCollection"
          @click="handleCloneCollection"
        >
          <i
            :class="
              isCloningCollection ? 'pi pi-spin pi-spinner' : 'pi pi-copy'
            "
          ></i>
          <span>Clone collection</span>
        </button>
      </div>
    </template>
  </Dialog>

  <OverlayPanel
    ref="metadataFilterOverlayPanel"
    class="collection-menu-panel metadata-filter-panel"
  >
    <div class="metadata-filter-menu">
      <div class="metadata-filter-menu__header">
        <p class="section-kicker">Metadata filters</p>
        <h3>Refine the current table</h3>
        <p>
          Build rules for metadata keys. Results update instantly and exports
          follow the same visible rows.
        </p>
      </div>

      <div class="metadata-filter-mode-switch">
        <button
          class="metadata-filter-mode-switch__button"
          :class="{
            'metadata-filter-mode-switch__button--active':
              metadataFilterMode === 'all',
          }"
          type="button"
          @click="metadataFilterMode = 'all'"
        >
          Match all
        </button>

        <button
          class="metadata-filter-mode-switch__button"
          :class="{
            'metadata-filter-mode-switch__button--active':
              metadataFilterMode === 'any',
          }"
          type="button"
          @click="metadataFilterMode = 'any'"
        >
          Match any
        </button>
      </div>

      <div class="metadata-filter-menu__toolbar">
        <button
          class="mini-button"
          type="button"
          @click="addMetadataFilterRule"
        >
          <i class="pi pi-plus"></i>
          <span>Add rule</span>
        </button>

        <button
          class="mini-button mini-button--ghost"
          type="button"
          :disabled="!metadataFilterRules.length"
          @click="clearMetadataFilters"
        >
          Clear all
        </button>
      </div>

      <div v-if="metadataFilterRules.length" class="metadata-filter-rule-list">
        <article
          v-for="rule in metadataFilterRules"
          :key="rule.id"
          class="metadata-filter-rule"
        >
          <div class="metadata-filter-rule__fields">
            <label class="field field--compact metadata-filter-key-field">
              <span class="field__label">Key</span>
              <div class="metadata-filter-key-input-wrap">
                <input
                  v-model="rule.key"
                  type="text"
                  @focus="handleMetadataFilterKeyFocus(rule.id)"
                  @blur="handleMetadataFilterKeyBlur"
                />

                <div
                  v-if="shouldShowMetadataFilterSuggestions(rule)"
                  class="metadata-filter-key-dropdown"
                >
                  <button
                    v-for="suggestion in getMetadataFilterSuggestions(rule)"
                    :key="suggestion"
                    class="metadata-filter-key-option"
                    type="button"
                    @mousedown.prevent="
                      selectMetadataFilterKey(rule, suggestion)
                    "
                  >
                    <span>{{ suggestion }}</span>
                    <small>Detected key</small>
                  </button>
                </div>
              </div>
            </label>

            <label class="field field--compact">
              <span class="field__label">Operator</span>
              <select v-model="rule.operator" class="metadata-filter-select">
                <option
                  v-for="operator in METADATA_FILTER_OPERATORS"
                  :key="operator.value"
                  :value="operator.value"
                >
                  {{ operator.label }}
                </option>
              </select>
            </label>

            <label
              v-if="doesMetadataFilterOperatorNeedValue(rule.operator)"
              class="field field--compact"
            >
              <span class="field__label">Value</span>
              <input v-model="rule.value" type="text" />
            </label>

            <div v-else class="metadata-filter-rule__message">
              {{
                rule.operator === "exists"
                  ? "Keeps rows where this metadata key is present."
                  : "Keeps rows where this metadata key is absent."
              }}
            </div>
          </div>

          <button
            class="mini-button mini-button--ghost mini-button--icon metadata-filter-rule__remove"
            type="button"
            aria-label="Remove metadata filter"
            @click="removeMetadataFilterRule(rule.id)"
          >
            <i class="pi pi-times"></i>
          </button>
        </article>
      </div>

      <div v-else class="metadata-filter-menu__empty">
        No filters added yet. Click <code>Add rule</code> to start refining the
        table
      </div>
    </div>
  </OverlayPanel>

  <OverlayPanel
    ref="exportOverlayPanel"
    class="collection-menu-panel export-menu-panel"
  >
    <div class="export-menu">
      <div class="export-menu__header">
        <p class="section-kicker">Export options</p>
        <h3>Choose your CSV</h3>
        <p>
          Export {{ formatNumber(filteredCollectionData.length) }} visible
          {{ filteredCollectionData.length === 1 ? "row" : "rows" }}
          {{
            hasActiveTableFilters
              ? "from the filtered table view."
              : "from the current table view."
          }}
        </p>
      </div>

      <button class="export-action" type="button" @click="exportCSV(false)">
        <span class="export-action__icon">
          <i class="pi pi-file-export"></i>
        </span>

        <span class="export-action__copy">
          <strong>Quick export</strong>
          <span>ID, document, and metadata only.</span>
        </span>
      </button>

      <button class="export-action" type="button" @click="exportCSV(true)">
        <span class="export-action__icon">
          <i class="pi pi-database"></i>
        </span>

        <span class="export-action__copy">
          <strong>Include embeddings</strong>
          <span
            >Fetches vector JSON for every exported row. Larger file, slower
            export.</span
          >
        </span>
      </button>
    </div>
  </OverlayPanel>

  <OverlayPanel ref="collectionOverlayPanel" class="collection-menu-panel">
    <div class="collection-menu">
      <button class="menu-action" type="button" @click="handleCollectionEdit">
        <i class="pi pi-pencil"></i>
        <span>Edit collection</span>
      </button>

      <button class="menu-action" type="button" @click="handleCollectionClone">
        <i class="pi pi-copy"></i>
        <span>Clone collection</span>
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
