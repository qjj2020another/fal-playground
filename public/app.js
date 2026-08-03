const HISTORY_KEY = 'fal-workbench-history';
const DELETE_PREFERENCE_KEY = 'fal-workbench-delete-preference';
const CLEAR_INPUTS_PREFERENCE_KEY = 'fal-workbench-clear-inputs-preference';
const NOTIFICATION_PREFERENCE_KEY = 'fal-workbench-notification-preference';
const DISMISSED_RESULT_KEY = 'fal-workbench-dismissed-result';
const MODEL_ORDER_KEY = 'fal-workbench-model-order';
const MODEL_ORDER_MODELS_KEY = 'fal-workbench-model-order-models';
const MODEL_PAGE_SIZE = 30;
const PREFERRED_MODEL_KEY = 'fal-workbench-preferred-model';
const TERMINAL_TASK_STATUSES = new Set(['completed', 'failed', 'error', 'cancelled', 'canceled']);

const state = {
  health: null,
  models: [],
  catalogRemoteModels: new Map(),
  catalogVisibleLimit: MODEL_PAGE_SIZE,
  modelOrder: loadModelOrder(),
  modelSnapshots: loadModelSnapshots(),
  preferredModel: loadPreferredModel(),
  preferredModelCandidate: null,
  preferredModelResults: [],
  preferredModelRequest: 0,
  draggedModelId: null,
  suppressModelClick: false,
  selectedModel: null,
  promotedModel: null,
  balance: null,
  balanceCurrency: 'USD',
  balanceStatus: 'idle',
  balanceError: '',
  balanceRequest: 0,
  notificationsEnabled: loadNotificationPreference(),
  notifiedTaskStates: new Set(),
  schema: null,
  schemaPayload: null,
  formSchema: null,
  category: 'all',
  query: '',
  cursor: null,
  hasMore: false,
  mode: 'visual',
  inputs: {},
  modelDrafts: new Map(),
  schemaReady: false,
  submittingActions: { run: 0, queue: 0 },
  result: null,
  history: loadHistory(),
  activeTaskId: null,
  dismissedResultTaskId: loadDismissedResultTaskId(),
  historyExpandedTaskId: null,
  multiTaskMode: false,
  multiTaskIds: new Set(),
  pollTimers: new Map(),
  pollingTasks: new Set(),
  uploadMetadata: new Map(),
  pendingDeleteTaskId: null,
  catalogRequest: 0,
  schemaRequest: 0
};
state.activeTaskId = state.history[0]?.id
  && state.history[0]?.resultPresentation !== 'history'
  && state.history[0].id !== state.dismissedResultTaskId
  ? state.history[0].id
  : null;
const restoredPendingTasks = state.history.filter((task) => !isTerminalStatus(statusText(task.response)));
if (restoredPendingTasks.length > 1 || restoredPendingTasks.some((task) => task.resultPresentation === 'history')) {
  state.multiTaskMode = true;
  restoredPendingTasks.forEach((task) => {
    task.resultPresentation = 'history';
    state.multiTaskIds.add(task.id);
  });
  state.activeTaskId = null;
}

const refs = {
  search: document.querySelector('#model-search'),
  catalogState: document.querySelector('#catalog-state'),
  refresh: document.querySelector('#refresh-button'),
  connect: document.querySelector('#connect-button'),
  connectLabel: document.querySelector('#connect-label'),
  balanceControl: document.querySelector('#balance-control'),
  balanceValue: document.querySelector('#balance-value'),
  balanceTooltip: document.querySelector('#balance-tooltip'),
  categoryFilter: document.querySelector('#category-filter'),
  categoryScrollLeft: document.querySelector('#category-scroll-left'),
  categoryScrollRight: document.querySelector('#category-scroll-right'),
  catalogNotice: document.querySelector('#catalog-notice'),
  modelCount: document.querySelector('#model-count'),
  modelList: document.querySelector('#model-list'),
  preferredModelButton: document.querySelector('#preferred-model-button'),
  preferredModelDialog: document.querySelector('#preferred-model-dialog'),
  preferredModelCurrent: document.querySelector('#preferred-model-current'),
  preferredModelSearch: document.querySelector('#preferred-model-search'),
  preferredModelResults: document.querySelector('#preferred-model-results'),
  resetPreferredModel: document.querySelector('#reset-preferred-model'),
  savePreferredModel: document.querySelector('#save-preferred-model'),
  loadMore: document.querySelector('#load-more-button'),
  modelCategory: document.querySelector('#model-category'),
  modelTitle: document.querySelector('#model-title'),
  endpointId: document.querySelector('#endpoint-id'),
  modelDescription: document.querySelector('#model-description'),
  officialLink: document.querySelector('#official-link'),
  copyEndpoint: document.querySelector('#copy-endpoint'),
  visualTab: document.querySelector('#visual-tab'),
  jsonTab: document.querySelector('#json-tab'),
  schemaSource: document.querySelector('#schema-source'),
  reloadSchema: document.querySelector('#reload-schema'),
  schemaNotice: document.querySelector('#schema-notice'),
  visualForm: document.querySelector('#visual-form'),
  jsonWrap: document.querySelector('#json-editor-wrap'),
  jsonEditor: document.querySelector('#json-editor'),
  jsonError: document.querySelector('#json-error'),
  inspectRequest: document.querySelector('#inspect-request'),
  clearInputs: document.querySelector('#clear-inputs-button'),
  clearInputsDialog: document.querySelector('#clear-inputs-dialog'),
  clearInputsDontAsk: document.querySelector('#clear-inputs-dont-ask'),
  confirmClearInputs: document.querySelector('#confirm-clear-inputs'),
  runButton: document.querySelector('#run-button'),
  queueButton: document.querySelector('#queue-button'),
  resultTabs: [...document.querySelectorAll('.result-tab')],
  resultView: document.querySelector('#result-view'),
  responseJson: document.querySelector('#response-json'),
  historyView: document.querySelector('#history-view'),
  historyCount: document.querySelector('#history-count'),
  clearHistory: document.querySelector('#clear-history'),
  notificationControl: document.querySelector('#notification-control'),
  notificationEnabled: document.querySelector('#notification-enabled'),
  authDialog: document.querySelector('#auth-dialog'),
  keyInput: document.querySelector('#fal-key-input'),
  toggleKey: document.querySelector('#toggle-key'),
  authError: document.querySelector('#auth-error'),
  saveKey: document.querySelector('#save-key-button'),
  disconnect: document.querySelector('#disconnect-button'),
  proxySettingsButton: document.querySelector('#proxy-settings-button'),
  proxyDialog: document.querySelector('#proxy-dialog'),
  proxyEnabled: document.querySelector('#proxy-enabled'),
  proxyProtocolInputs: [...document.querySelectorAll('input[name="proxy-protocol"]')],
  proxyHost: document.querySelector('#proxy-host'),
  proxyPort: document.querySelector('#proxy-port'),
  proxyAuthEnabled: document.querySelector('#proxy-auth-enabled'),
  proxyUsername: document.querySelector('#proxy-username'),
  proxyPassword: document.querySelector('#proxy-password'),
  proxyTestUrl: document.querySelector('#proxy-test-url'),
  proxyStatus: document.querySelector('#proxy-status'),
  testProxy: document.querySelector('#test-proxy-button'),
  resetProxy: document.querySelector('#reset-proxy-button'),
  saveProxy: document.querySelector('#save-proxy-button'),
  requestDialog: document.querySelector('#request-dialog'),
  requestPreview: document.querySelector('#request-preview'),
  copyRequest: document.querySelector('#copy-request'),
  deleteDialog: document.querySelector('#delete-task-dialog'),
  deleteTaskName: document.querySelector('#delete-task-name'),
  deleteSavedFiles: document.querySelector('#delete-saved-files'),
  deleteSavedFilesLabel: document.querySelector('#delete-saved-files-label'),
  deleteSavedFilesHint: document.querySelector('#delete-saved-files-hint'),
  deleteDontAsk: document.querySelector('#delete-dont-ask'),
  confirmDeleteTask: document.querySelector('#confirm-delete-task'),
  imageLightbox: document.querySelector('#image-lightbox'),
  imageLightboxImage: document.querySelector('#image-lightbox-image'),
  imageLightboxClose: document.querySelector('#image-lightbox-close'),
  toastRegion: document.querySelector('#toast-region')
};

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function loadModelOrder() {
  try {
    const value = JSON.parse(localStorage.getItem(MODEL_ORDER_KEY) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === 'string' && item))] : [];
  } catch {
    localStorage.removeItem(MODEL_ORDER_KEY);
    return [];
  }
}

function loadModelSnapshots() {
  try {
    const value = JSON.parse(localStorage.getItem(MODEL_ORDER_MODELS_KEY) || '{}');
    const entries = Array.isArray(value)
      ? value.map((model) => [model?.endpoint_id, model])
      : Object.entries(value || {});
    return new Map(entries.filter(([endpointId, model]) => typeof endpointId === 'string' && endpointId && model?.endpoint_id));
  } catch {
    localStorage.removeItem(MODEL_ORDER_MODELS_KEY);
    return new Map();
  }
}

function saveModelSnapshots() {
  try {
    localStorage.setItem(MODEL_ORDER_MODELS_KEY, JSON.stringify(Object.fromEntries(state.modelSnapshots)));
  } catch (error) {
    console.warn(`Unable to persist model snapshots: ${error.message}`);
  }
}

function modelSnapshot(model) {
  const endpointId = model?.endpoint_id;
  if (!endpointId) return null;
  return {
    endpoint_id: endpointId,
    title: model.title || model.display_name || model.name || endpointId,
    description: model.description || model.summary || '',
    category: model.category || model.modality || model.type || 'other',
    status: model.status || 'active',
    model_url: model.model_url || `https://fal.ai/models/${endpointId}`,
    run_url: model.run_url || `https://fal.run/${endpointId}`,
    thumbnail_url: model.thumbnail_url || null
  };
}

function fallbackModel(endpointId) {
  return {
    endpoint_id: endpointId,
    title: endpointId,
    description: '',
    category: 'other',
    status: 'active',
    model_url: `https://fal.ai/models/${endpointId}`,
    run_url: `https://fal.run/${endpointId}`,
    thumbnail_url: null
  };
}

function modelForCatalog(endpointId) {
  return state.modelSnapshots.get(endpointId) || fallbackModel(endpointId);
}

function rememberModels(models) {
  let changed = false;
  for (const model of models || []) {
    const snapshot = modelSnapshot(model);
    if (!snapshot) continue;
    const previous = state.modelSnapshots.get(snapshot.endpoint_id);
    if (JSON.stringify(previous) === JSON.stringify(snapshot)) continue;
    state.modelSnapshots.set(snapshot.endpoint_id, snapshot);
    changed = true;
  }
  if (changed) saveModelSnapshots();
}

function modelMatchesCatalogFilter(model) {
  if (!model?.endpoint_id) return false;
  const query = state.query.trim().toLowerCase();
  const text = `${model.endpoint_id} ${modelTitle(model)} ${model.description || ''}`.toLowerCase();
  return (!query || text.includes(query)) && (state.category === 'all' || model.category === state.category);
}

function uniqueModels(...groups) {
  const seen = new Set();
  return groups.flat().filter((model) => {
    const endpointId = model?.endpoint_id;
    if (!endpointId || seen.has(endpointId)) return false;
    seen.add(endpointId);
    return true;
  });
}

function catalogCandidates() {
  // Rehydrate older order-only storage until the live catalog supplies full metadata.
  const persistedModels = state.modelOrder
    .slice(0, state.catalogVisibleLimit)
    .map(modelForCatalog);
  return uniqueModels([...state.catalogRemoteModels.values()], persistedModels)
    .filter(modelMatchesCatalogFilter);
}

function refreshCatalogModels() {
  state.models = orderedCatalogModels(catalogCandidates()).slice(0, state.catalogVisibleLimit);
}

function saveModelOrder() {
  try {
    localStorage.setItem(MODEL_ORDER_KEY, JSON.stringify(state.modelOrder));
  } catch (error) {
    console.warn(`Unable to persist model order: ${error.message}`);
  }
}

function normalizePreferredModel(value) {
  if (!value || typeof value !== 'object') return null;
  const endpointId = String(value.endpointId || value.endpoint_id || '').trim();
  if (!endpointId) return null;
  const model = value.model && typeof value.model === 'object' ? cloneJson(value.model) : null;
  return {
    endpointId,
    model: model || {
      endpoint_id: endpointId,
      title: String(value.title || endpointId),
      category: String(value.category || 'other'),
      status: 'active',
      model_url: `https://fal.ai/models/${endpointId}`
    }
  };
}

function loadPreferredModel() {
  try {
    return normalizePreferredModel(JSON.parse(localStorage.getItem(PREFERRED_MODEL_KEY) || 'null'));
  } catch {
    localStorage.removeItem(PREFERRED_MODEL_KEY);
    return null;
  }
}

function savePreferredModel(preferredModel) {
  if (!preferredModel) {
    localStorage.removeItem(PREFERRED_MODEL_KEY);
    state.preferredModel = null;
    return;
  }
  const normalized = normalizePreferredModel(preferredModel);
  localStorage.setItem(PREFERRED_MODEL_KEY, JSON.stringify(normalized));
  state.preferredModel = normalized;
}

function orderedCatalogModels(models = state.models) {
  if (!state.modelOrder.length) return models;
  const ranks = new Map(state.modelOrder.map((endpointId, index) => [endpointId, index]));
  return models
    .map((model, index) => ({ model, index, rank: ranks.get(model.endpoint_id) }))
    .sort((left, right) => {
      const leftSaved = left.rank !== undefined;
      const rightSaved = right.rank !== undefined;
      if (leftSaved && rightSaved) return left.rank - right.rank;
      if (leftSaved) return -1;
      if (rightSaved) return 1;
      return left.index - right.index;
    })
    .map(({ model }) => model);
}

function saveCurrentModelDraft() {
  const endpointId = state.selectedModel?.endpoint_id;
  if (!endpointId || !state.schemaReady) return;
  state.modelDrafts.set(endpointId, {
    inputs: cloneJson(state.inputs),
    jsonText: refs.jsonEditor.value,
    uploadMetadata: [...state.uploadMetadata.entries()].map(([key, value]) => [key, cloneJson(value)])
  });
}

function restoreModelDraft(endpointId, defaults) {
  const draft = state.modelDrafts.get(endpointId);
  state.inputs = draft ? cloneJson(draft.inputs || {}) : defaults;
  state.uploadMetadata = new Map(draft?.uploadMetadata || []);
  syncJsonEditor();
  if (state.mode === 'json' && draft?.jsonText) refs.jsonEditor.value = draft.jsonText;
}

function updateSubmitControls() {
  const ready = Boolean(state.selectedModel && state.schemaReady);
  refs.runButton.disabled = !ready || state.submittingActions.run > 0;
  refs.queueButton.disabled = !ready || state.submittingActions.queue > 0;
  refs.clearInputs.disabled = !ready;
}

function setSubmittingAction(action, active) {
  if (!action) return;
  state.submittingActions[action] = Math.max(0, state.submittingActions[action] + (active ? 1 : -1));
  updateSubmitControls();
}

function cryptoRandomId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeStatus(value) {
  return String(value || '').toLowerCase().replaceAll(' ', '_');
}

function statusText(result) {
  if (result?.error) return 'failed';
  return normalizeStatus(result?.status || result?.state || (result?.request_id ? 'in_queue' : 'completed'));
}

function isTerminalStatus(status) {
  return TERMINAL_TASK_STATUSES.has(normalizeStatus(status));
}

function loadHistory() {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Task history must be an array.');
    return parsed.slice(0, 30).map((item) => {
      const updatedAt = item.updatedAt || item.createdAt || new Date().toISOString();
      const status = statusText(item.response);
      return {
        ...item,
        id: item.id || cryptoRandomId(),
        status,
        updatedAt,
        completedAt: item.completedAt || (isTerminalStatus(status) ? updatedAt : null)
      };
    });
  } catch (error) {
    try {
      localStorage.setItem(`${HISTORY_KEY}-corrupt-${Date.now()}`, raw);
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      localStorage.removeItem(HISTORY_KEY);
    }
    console.warn(`Discarded invalid task history: ${error.message}`);
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0, 30)));
  } catch (error) {
    console.warn(`Unable to persist task history: ${error.message}`);
  }
  if (refs.historyCount) refs.historyCount.textContent = String(state.history.length);
}

function loadDeletePreference() {
  try {
    const value = JSON.parse(localStorage.getItem(DELETE_PREFERENCE_KEY) || '{}');
    return {
      skipConfirmation: Boolean(value.skipConfirmation),
      deleteSavedFiles: Boolean(value.deleteSavedFiles)
    };
  } catch {
    localStorage.removeItem(DELETE_PREFERENCE_KEY);
    return { skipConfirmation: false, deleteSavedFiles: false };
  }
}

function saveDeletePreference(preference) {
  localStorage.setItem(DELETE_PREFERENCE_KEY, JSON.stringify(preference));
}

function loadClearInputsPreference() {
  try {
    const value = JSON.parse(localStorage.getItem(CLEAR_INPUTS_PREFERENCE_KEY) || '{}');
    return { skipConfirmation: Boolean(value.skipConfirmation) };
  } catch {
    localStorage.removeItem(CLEAR_INPUTS_PREFERENCE_KEY);
    return { skipConfirmation: false };
  }
}

function saveClearInputsPreference(preference) {
  localStorage.setItem(CLEAR_INPUTS_PREFERENCE_KEY, JSON.stringify(preference));
}

function notificationPreferenceFromCookie() {
  const prefix = `${encodeURIComponent(NOTIFICATION_PREFERENCE_KEY)}=`;
  const entry = document.cookie.split('; ').find((item) => item.startsWith(prefix));
  if (!entry) return null;
  return decodeURIComponent(entry.slice(prefix.length)) === '1';
}

function saveNotificationPreference(enabled) {
  document.cookie = `${encodeURIComponent(NOTIFICATION_PREFERENCE_KEY)}=${enabled ? '1' : '0'}; Max-Age=315360000; Path=/; SameSite=Strict`;
}

function loadNotificationPreference() {
  try {
    const cookieValue = notificationPreferenceFromCookie();
    if (cookieValue !== null) return cookieValue;

    const stored = localStorage.getItem(NOTIFICATION_PREFERENCE_KEY);
    localStorage.removeItem(NOTIFICATION_PREFERENCE_KEY);
    if (stored === null) return false;
    const value = JSON.parse(stored);
    const enabled = typeof value === 'boolean' ? value : Boolean(value?.enabled);
    saveNotificationPreference(enabled);
    return enabled;
  } catch {
    localStorage.removeItem(NOTIFICATION_PREFERENCE_KEY);
    return false;
  }
}

function loadDismissedResultTaskId() {
  try {
    return localStorage.getItem(DISMISSED_RESULT_KEY) || null;
  } catch {
    return null;
  }
}

function setDismissedResultTaskId(taskId) {
  state.dismissedResultTaskId = taskId || null;
  try {
    if (taskId) localStorage.setItem(DISMISSED_RESULT_KEY, taskId);
    else localStorage.removeItem(DISMISSED_RESULT_KEY);
  } catch {
    // Dismissal still applies for the current page session.
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const text = await response.text();
  let payload = {};
  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      const error = new Error(`本地服务返回了无效 JSON（HTTP ${response.status}）。`);
      error.code = 'INVALID_SERVER_JSON';
      throw error;
    }
  }
  if (!response.ok || payload.ok === false) {
    const error = new Error(payload?.error?.message || `HTTP ${response.status}`);
    error.code = payload?.error?.code || 'REQUEST_FAILED';
    error.details = payload?.details;
    throw error;
  }
  return payload;
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function humanize(value) {
  return String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function categoryLabel(category) {
  const labels = {
    'text-to-image': 'T2I',
    'image-to-image': 'I2I',
    'text-to-video': 'T2V',
    'image-to-video': 'I2V',
    'text-to-speech': 'TTS',
    'speech-to-text': 'STT',
    'image-to-3d': '3D',
    'text-to-3d': '3D',
    other: 'API'
  };
  return labels[category] || 'API';
}

function modelTitle(model) {
  return model?.title || model?.display_name || model?.name || model?.endpoint_id || 'Untitled model';
}

function modelDescription(model) {
  return model?.description || model?.summary || '该 endpoint 的参数会从 schema 动态加载。';
}

function officialUrl(model) {
  return model?.model_url || `https://fal.ai/models/${model?.endpoint_id || ''}`;
}

function toast(message, type = 'info') {
  const element = document.createElement('div');
  element.className = `toast ${type === 'error' ? 'error' : ''}`;
  element.textContent = message;
  refs.toastRegion.append(element);
  window.setTimeout(() => element.remove(), 4200);
}

function formatBalance(value, currency = 'USD') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '--';
  if (String(currency).toUpperCase() === 'USD') {
    return `${amount < 0 ? '-' : ''}$${Math.abs(amount).toFixed(2)}`;
  }
  return `${amount.toFixed(2)} ${String(currency).toUpperCase()}`;
}

function renderBalance() {
  if (!refs.balanceControl || !refs.balanceValue || !refs.balanceTooltip) return;
  const connected = Boolean(state.health?.hasKey);
  refs.balanceControl.classList.toggle('hidden', !connected);
  if (!connected) {
    refs.balanceValue.textContent = '--';
    refs.balanceControl.classList.remove('is-loading', 'is-error', 'is-negative');
    return;
  }

  const hasBalance = state.balance !== null && state.balance !== '' && Number.isFinite(Number(state.balance));
  refs.balanceValue.textContent = hasBalance
    ? formatBalance(state.balance, state.balanceCurrency)
    : state.balanceStatus === 'loading'
      ? '读取中'
      : '--';
  refs.balanceControl.classList.toggle('is-loading', state.balanceStatus === 'loading');
  refs.balanceControl.classList.toggle('is-error', state.balanceStatus === 'error');
  refs.balanceControl.classList.toggle('is-negative', hasBalance && Number(state.balance) < 0);
  refs.balanceControl.setAttribute('aria-label', hasBalance
    ? `fal.ai 余额 ${formatBalance(state.balance, state.balanceCurrency)}`
    : 'fal.ai 余额暂不可用');
  refs.balanceTooltip.textContent = state.balanceError
    ? `余额不足时，请前往 fal.ai 充值后再继续生成。当前余额读取失败：${state.balanceError}`
    : '余额不足时，请前往 fal.ai 充值后再继续生成。';
}

async function refreshBalance() {
  if (!state.health?.hasKey) {
    state.balanceRequest += 1;
    state.balance = null;
    state.balanceStatus = 'idle';
    state.balanceError = '';
    renderBalance();
    return;
  }

  const request = ++state.balanceRequest;
  state.balanceStatus = 'loading';
  state.balanceError = '';
  renderBalance();
  try {
    const payload = await api('/api/balance');
    if (request !== state.balanceRequest) return;
    state.balance = Number(payload.balance);
    state.balanceCurrency = payload.currency || 'USD';
    state.balanceStatus = 'ready';
  } catch (error) {
    if (request !== state.balanceRequest) return;
    state.balance = null;
    state.balanceStatus = 'error';
    state.balanceError = error.message;
    console.warn(`Unable to refresh fal.ai balance: ${error.message}`);
  }
  renderBalance();
}

function renderNotificationControl() {
  if (!refs.notificationEnabled || !refs.notificationControl) return;
  const supported = 'Notification' in window;
  const permission = supported ? Notification.permission : 'unsupported';
  const active = supported && permission === 'granted' && state.notificationsEnabled;
  refs.notificationEnabled.disabled = !supported;
  refs.notificationEnabled.checked = active;
  refs.notificationControl.classList.toggle('is-denied', permission === 'denied');
  refs.notificationControl.classList.toggle('is-unavailable', !supported);
  refs.notificationControl.title = !supported
    ? '当前浏览器不支持系统通知'
    : permission === 'denied'
      ? '浏览器已阻止通知，请在站点权限中重新允许'
      : active
        ? '任务完成或失败时发送浏览器通知'
        : '开启任务完成和失败通知';
}

async function toggleNotifications() {
  if (!('Notification' in window)) {
    state.notificationsEnabled = false;
    saveNotificationPreference(false);
    renderNotificationControl();
    toast('当前浏览器不支持系统通知。', 'error');
    return;
  }
  if (!refs.notificationEnabled.checked) {
    state.notificationsEnabled = false;
    saveNotificationPreference(false);
    renderNotificationControl();
    toast('浏览器任务通知已关闭。');
    return;
  }
  let permission = Notification.permission;
  try {
    if (permission === 'default') permission = await Notification.requestPermission();
  } catch {
    permission = Notification.permission;
  }
  state.notificationsEnabled = permission === 'granted';
  saveNotificationPreference(state.notificationsEnabled);
  renderNotificationControl();
  if (state.notificationsEnabled) toast('浏览器任务通知已开启。');
  else toast('浏览器未允许通知，请在站点权限中重新开启。', 'error');
}

function taskErrorMessage(task) {
  const result = task?.response || {};
  return result?.error?.message || result?.message || task?.pollError || '生成过程中发生错误。';
}

function notifyTaskTerminal(task, previousStatus, nextStatus) {
  if (!task || !state.notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  if (!['completed', 'failed', 'error'].includes(nextStatus) || previousStatus === nextStatus) return;
  const notificationKey = `${task.id}:${nextStatus}`;
  if (state.notifiedTaskStates.has(notificationKey)) return;
  state.notifiedTaskStates.add(notificationKey);
  const completed = nextStatus === 'completed';
  const assets = completed ? findAssets(task.response) : [];
  try {
    const notification = new Notification(completed ? 'FAL Workbench：生成完成' : 'FAL Workbench：生成失败', {
      body: completed
        ? `${task.modelTitle || task.endpointId}${assets.length ? ` · ${assets.length} 个输出` : ''}`
        : `${task.modelTitle || task.endpointId} · ${taskErrorMessage(task)}`,
      tag: `fal-workbench-${task.id}-${nextStatus}`
    });
    notification.onclick = () => {
      window.focus();
      if (task.resultPresentation === 'history') {
        state.historyExpandedTaskId = task.id;
        renderHistory();
        showResultTab('history');
        refs.historyView.querySelector(`[data-history-entry="${CSS.escape(task.id)}"]`)?.scrollIntoView({ block: 'start' });
      } else {
        showTask(task, { switchTab: true });
        refs.resultView.querySelector('[data-task-detail]')?.scrollIntoView({ block: 'start' });
      }
      notification.close();
    };
  } catch (error) {
    console.warn(`Unable to create task notification: ${error.message}`);
  }
}

function setStatus(kind, label) {
  refs.catalogState.className = `status-chip status-${kind}`;
  refs.catalogState.querySelector('span').textContent = label;
}

function setButtonBusy(button, busy, label) {
  if (!button) return;
  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? label : button.dataset.defaultLabel;
}

async function copyText(text, successMessage = '已复制') {
  await navigator.clipboard.writeText(String(text));
  toast(successMessage);
}

function renderHealth() {
  const connected = Boolean(state.health?.hasKey);
  refs.connect.classList.toggle('connected', connected);
  refs.connectLabel.textContent = connected ? '已连接' : '连接 fal.ai';
  refs.disconnect.classList.toggle('hidden', !connected || state.health?.keySource === 'environment');
  if (connected) setStatus('live', state.health.keySource === 'environment' ? '环境密钥' : '已保存连接');
  else {
    state.balanceRequest += 1;
    state.balance = null;
    state.balanceStatus = 'idle';
    state.balanceError = '';
  }
  renderBalance();
}

async function loadHealth() {
  try {
    state.health = await api('/api/health');
    renderHealth();
  } catch (error) {
    setStatus('error', '本地服务异常');
    toast(error.message, 'error');
  }
}

function renderCatalogLoading() {
  refs.modelList.innerHTML = `
    <div class="catalog-loading">
      <strong>读取模型目录</strong>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    </div>`;
}

function renderCatalogNotice(payload) {
  const message = payload.notice || (payload.demo ? '当前显示离线 DEMO 模型；连接密钥后加载实时目录。' : '');
  refs.catalogNotice.textContent = message;
  refs.catalogNotice.classList.toggle('hidden', !message);
}

function preferredModelDisplay(preferred = state.preferredModel) {
  if (!preferred) return '原始预设';
  const model = state.models.find((item) => item.endpoint_id === preferred.endpointId) || preferred.model;
  return modelTitle(model || { endpoint_id: preferred.endpointId });
}

function renderPreferredModelButton() {
  if (!refs.preferredModelButton) return;
  const configured = Boolean(state.preferredModel);
  refs.preferredModelButton.classList.toggle('configured', configured);
  refs.preferredModelButton.textContent = configured ? '★' : '☆';
  refs.preferredModelButton.title = configured
    ? `启动首选模型：${preferredModelDisplay()}`
    : '设置启动首选模型';
  refs.preferredModelButton.setAttribute('aria-label', refs.preferredModelButton.title);
}

function renderPreferredModelCurrent() {
  if (!refs.preferredModelCurrent) return;
  const preferred = state.preferredModel;
  const model = preferred && (state.models.find((item) => item.endpoint_id === preferred.endpointId) || preferred.model);
  refs.preferredModelCurrent.innerHTML = preferred
    ? `<span>当前首选</span><strong>${escapeHtml(modelTitle(model))}</strong><code>${escapeHtml(preferred.endpointId)}</code>`
    : '<span>当前首选</span><strong>原始预设</strong><small>启动时选择模型目录有效顺序中的第一项。</small>';
}

function renderPreferredModelResults() {
  if (!refs.preferredModelResults) return;
  const results = state.preferredModelResults;
  if (!results.length) {
    refs.preferredModelResults.innerHTML = `<div class="preferred-model-empty">${refs.preferredModelSearch.value.trim() ? '没有找到符合条件的模型。' : '输入名称或 Endpoint ID 查找模型。'}</div>`;
    refs.savePreferredModel.disabled = !state.preferredModelCandidate;
    return;
  }
  refs.preferredModelResults.innerHTML = results.map((model) => {
    const selected = state.preferredModelCandidate?.endpointId === model.endpoint_id;
    return `<button class="preferred-model-result ${selected ? 'selected' : ''}" type="button" role="option" aria-selected="${selected ? 'true' : 'false'}" data-preferred-endpoint="${escapeHtml(model.endpoint_id)}"><strong>${escapeHtml(modelTitle(model))}</strong><code>${escapeHtml(model.endpoint_id)}</code><span>${escapeHtml(model.category || 'other')}</span></button>`;
  }).join('');
  refs.preferredModelResults.querySelectorAll('[data-preferred-endpoint]').forEach((button) => button.addEventListener('click', () => {
    const model = state.preferredModelResults.find((item) => item.endpoint_id === button.dataset.preferredEndpoint);
    if (!model) return;
    state.preferredModelCandidate = { endpointId: model.endpoint_id, model: cloneJson(model) };
    renderPreferredModelResults();
  }));
  refs.savePreferredModel.disabled = !state.preferredModelCandidate;
}

function openPreferredModelSettings() {
  state.preferredModelCandidate = state.preferredModel ? cloneJson(state.preferredModel) : null;
  state.preferredModelResults = [];
  refs.preferredModelSearch.value = '';
  renderPreferredModelCurrent();
  renderPreferredModelResults();
  refs.preferredModelDialog.showModal();
  refs.preferredModelSearch.focus();
}

async function searchPreferredModels() {
  const query = refs.preferredModelSearch.value.trim();
  const requestId = ++state.preferredModelRequest;
  if (!query) {
    state.preferredModelResults = [];
    renderPreferredModelResults();
    return;
  }
  refs.preferredModelResults.innerHTML = '<div class="preferred-model-empty">正在查找模型…</div>';
  try {
    const payload = await api(`/api/models?${new URLSearchParams({ limit: '30', status: 'active', q: query })}`);
    if (requestId !== state.preferredModelRequest) return;
    const incoming = Array.isArray(payload.models) ? payload.models : [];
    const combined = [...state.models, ...incoming].filter((model, index, items) => model?.endpoint_id && items.findIndex((item) => item.endpoint_id === model.endpoint_id) === index);
    const normalizedQuery = query.toLowerCase();
    state.preferredModelResults = combined
      .filter((model) => `${modelTitle(model)} ${model.endpoint_id} ${model.description || ''}`.toLowerCase().includes(normalizedQuery))
      .slice(0, 30);
    renderPreferredModelResults();
  } catch (error) {
    if (requestId !== state.preferredModelRequest) return;
    refs.preferredModelResults.innerHTML = `<div class="preferred-model-empty error">查找失败：${escapeHtml(error.message)}</div>`;
  }
}

function savePreferredModelSelection() {
  if (!state.preferredModelCandidate) return;
  savePreferredModel(state.preferredModelCandidate);
  renderModels();
  renderPreferredModelButton();
  refs.preferredModelDialog.close();
  toast(`启动首选模型已保存并固定在目录顶部：${preferredModelDisplay()}。`);
}

function resetPreferredModelSelection() {
  savePreferredModel(null);
  state.preferredModelCandidate = null;
  renderModels();
  renderPreferredModelButton();
  renderPreferredModelCurrent();
  renderPreferredModelResults();
  refs.preferredModelDialog.close();
  toast('启动首选模型已恢复为原始预设；下次载入会选择有效目录顺序的第一项。');
}

function displayedModels() {
  const catalogModels = orderedCatalogModels();
  const preferred = state.preferredModel;
  const promoted = state.promotedModel;
  const preferredModel = preferred && (catalogModels.find((model) => model.endpoint_id === preferred.endpointId) || preferred.model);
  const promotedModel = promoted && (catalogModels.find((model) => model.endpoint_id === promoted.endpointId) || promoted.model);
  const pinnedModels = [];
  if (promotedModel) pinnedModels.push(promotedModel);
  if (preferredModel && preferred.endpointId !== promoted?.endpointId) pinnedModels.push(preferredModel);
  const pinnedIds = new Set(pinnedModels.map((model) => model.endpoint_id));
  return [...pinnedModels, ...catalogModels.filter((model) => !pinnedIds.has(model.endpoint_id))];
}

function reorderModel(draggedEndpointId, targetEndpointId, placeAfter = false) {
  if (!draggedEndpointId || !targetEndpointId || draggedEndpointId === targetEndpointId) return;
  const pinnedIds = new Set([state.preferredModel?.endpointId, state.promotedModel?.endpointId].filter(Boolean));
  if (pinnedIds.has(draggedEndpointId) || pinnedIds.has(targetEndpointId)) return;
  const catalogModels = orderedCatalogModels();
  const reorderableIds = catalogModels.map((model) => model.endpoint_id).filter((endpointId) => !pinnedIds.has(endpointId));
  if (!reorderableIds.includes(draggedEndpointId) || !reorderableIds.includes(targetEndpointId)) return;
  const reorderedIds = reorderableIds.filter((endpointId) => endpointId !== draggedEndpointId);
  const targetIndex = reorderedIds.indexOf(targetEndpointId);
  reorderedIds.splice(targetIndex + (placeAfter ? 1 : 0), 0, draggedEndpointId);

  const catalogIds = catalogModels.map((model) => model.endpoint_id);
  const baseline = state.modelOrder.length ? [...state.modelOrder] : [...catalogIds];
  catalogIds.forEach((endpointId) => {
    if (!baseline.includes(endpointId)) baseline.push(endpointId);
  });
  const reorderableSet = new Set(reorderableIds);
  const remainingIds = [...reorderedIds];
  state.modelOrder = baseline.map((endpointId) => (
    reorderableSet.has(endpointId) ? remainingIds.shift() : endpointId
  ));
  state.modelOrder.push(...remainingIds);
  rememberModels(state.models);
  saveModelOrder();
  renderModels();
}

function clearModelDragState() {
  state.draggedModelId = null;
  refs.modelList.classList.remove('is-dragging');
  refs.modelList.querySelectorAll('.model-card').forEach((card) => card.classList.remove('dragging', 'drop-before', 'drop-after'));
  window.setTimeout(() => { state.suppressModelClick = false; }, 0);
}

function bindModelDragAndDrop(button) {
  if (button.dataset.pinned === 'true') return;
  button.addEventListener('dragstart', (event) => {
    const pinnedIds = new Set([state.preferredModel?.endpointId, state.promotedModel?.endpointId].filter(Boolean));
    if (pinnedIds.has(button.dataset.endpoint)) {
      event.preventDefault();
      return;
    }
    state.suppressModelClick = true;
    state.draggedModelId = button.dataset.endpoint;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', state.draggedModelId);
    refs.modelList.classList.add('is-dragging');
    window.requestAnimationFrame(() => button.classList.add('dragging'));
  });
  button.addEventListener('dragover', (event) => {
    if (!state.draggedModelId || state.draggedModelId === button.dataset.endpoint) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const after = event.clientY >= button.getBoundingClientRect().top + button.offsetHeight / 2;
    button.classList.toggle('drop-before', !after);
    button.classList.toggle('drop-after', after);
  });
  button.addEventListener('dragleave', () => button.classList.remove('drop-before', 'drop-after'));
  button.addEventListener('drop', (event) => {
    if (!state.draggedModelId) return;
    event.preventDefault();
    const after = event.clientY >= button.getBoundingClientRect().top + button.offsetHeight / 2;
    reorderModel(state.draggedModelId, button.dataset.endpoint, after);
    clearModelDragState();
  });
  button.addEventListener('dragend', clearModelDragState);
}

function renderModels() {
  const models = displayedModels();
  refs.modelCount.textContent = String(models.length);
  refs.loadMore.classList.toggle('hidden', !state.hasMore);
  if (!models.length) {
    refs.modelList.innerHTML = '<div class="catalog-loading">没有找到符合条件的模型。</div>';
    return;
  }
  refs.modelList.innerHTML = models.map((model) => {
    const active = state.selectedModel?.endpoint_id === model.endpoint_id;
    const preferred = state.preferredModel?.endpointId === model.endpoint_id;
    const promoted = state.promotedModel?.endpointId === model.endpoint_id;
    const pinned = preferred || promoted;
    return `
      <button class="model-card ${active ? 'active' : ''} ${preferred ? 'preferred' : ''} ${promoted ? 'promoted' : ''} ${pinned ? 'pinned' : ''}" type="button" data-endpoint="${escapeHtml(model.endpoint_id)}" data-pinned="${pinned ? 'true' : 'false'}" draggable="${pinned ? 'false' : 'true'}">
        <span class="model-card-icon ${model.thumbnail_url ? 'has-thumbnail' : ''}" aria-hidden="true">
          ${model.thumbnail_url ? `<img src="${escapeHtml(model.thumbnail_url)}" alt="" loading="lazy">` : escapeHtml(categoryLabel(model.category))}
        </span>
        <span>
          <strong>${escapeHtml(modelTitle(model))}</strong>
          <code>${escapeHtml(model.endpoint_id)}</code>
          <span class="model-card-meta"><span>${escapeHtml(model.category || 'other')}</span><span>•</span><span>${escapeHtml(model.status || 'active')}</span></span>
        </span>
      </button>`;
  }).join('');
  refs.modelList.querySelectorAll('.model-card').forEach((button) => {
    button.addEventListener('click', () => {
      if (state.suppressModelClick) return;
      const model = displayedModels().find((item) => item.endpoint_id === button.dataset.endpoint);
      if (model) selectModel(model, { userInitiated: true });
    });
    bindModelDragAndDrop(button);
  });
}

async function loadModels({ append = false } = {}) {
  const requestId = ++state.catalogRequest;
  if (!append) {
    state.catalogVisibleLimit = MODEL_PAGE_SIZE;
    state.catalogRemoteModels = new Map();
    renderCatalogLoading();
  }
  refs.refresh.classList.add('busy');
  if (append) {
    refs.loadMore.disabled = true;
    refs.loadMore.textContent = '加载中…';
  }
  try {
    const params = new URLSearchParams({ limit: String(MODEL_PAGE_SIZE), status: 'active' });
    if (state.query) params.set('q', state.query);
    if (state.category !== 'all') params.set('category', state.category);
    if (append && state.cursor) params.set('cursor', state.cursor);
    const payload = await api(`/api/models?${params}`);
    if (requestId !== state.catalogRequest) return;
    const incomingModels = Array.isArray(payload.models) ? payload.models : [];
    rememberModels(incomingModels);
    incomingModels.forEach((model) => {
      if (model?.endpoint_id) state.catalogRemoteModels.set(model.endpoint_id, model);
    });
    if (append) state.catalogVisibleLimit += Math.max(incomingModels.length, MODEL_PAGE_SIZE);
    refreshCatalogModels();
    state.cursor = payload.nextCursor;
    state.hasMore = payload.hasMore;
    renderCatalogNotice(payload);
    renderModels();
    renderPreferredModelButton();
    if (!state.health?.hasKey) setStatus(payload.live ? 'live' : 'demo', payload.live ? '实时目录' : 'DEMO 目录');
    if (!append && !state.selectedModel && state.models.length) {
      const preferred = state.preferredModel;
      const preferredModel = preferred && (state.models.find((item) => item.endpoint_id === preferred.endpointId) || preferred.model);
      await selectModel(preferredModel || orderedCatalogModels()[0]);
    }
  } catch (error) {
    if (requestId !== state.catalogRequest) return;
    refs.modelList.innerHTML = `<div class="catalog-loading">目录读取失败：${escapeHtml(error.message)}</div>`;
    setStatus('error', '目录读取失败');
    toast(error.message, 'error');
  } finally {
    refs.refresh.classList.remove('busy');
    refs.loadMore.disabled = false;
    refs.loadMore.textContent = '加载更多模型';
  }
}

async function selectModel(model, { userInitiated = false, promote = false } = {}) {
  if (!model?.endpoint_id) return;
  saveCurrentModelDraft();
  if (promote) {
    const catalogModel = state.models.find((item) => item.endpoint_id === model.endpoint_id);
    state.promotedModel = {
      endpointId: model.endpoint_id,
      model: cloneJson(catalogModel || model)
    };
  } else if (userInitiated && state.promotedModel?.endpointId !== model.endpoint_id) {
    state.promotedModel = null;
  }
  state.selectedModel = state.models.find((item) => item.endpoint_id === model.endpoint_id) || model;
  state.schema = null;
  state.formSchema = null;
  state.schemaReady = false;
  state.inputs = {};
  state.uploadMetadata = new Map();
  renderModels();
  if (promote) refs.modelList.scrollTop = 0;
  renderModelHeader();
  updateSubmitControls();
  refs.visualForm.innerHTML = '<div class="catalog-loading">正在读取 endpoint schema…</div>';
  await loadSchema();
}

function renderModelHeader() {
  const model = state.selectedModel;
  if (!model) return;
  refs.modelCategory.textContent = model.category || 'MODEL ENDPOINT';
  refs.modelTitle.textContent = modelTitle(model);
  refs.endpointId.textContent = model.endpoint_id;
  refs.modelDescription.textContent = modelDescription(model);
  refs.officialLink.href = officialUrl(model);
  refs.officialLink.classList.remove('disabled');
}

function resolveSchemaRef(schema, root) {
  if (!schema || typeof schema !== 'object') return schema;
  if (schema.$ref?.startsWith('#/')) {
    return schema.$ref.slice(2).split('/').reduce((value, key) => value?.[key], root) || schema;
  }
  if (Array.isArray(schema.allOf)) {
    return schema.allOf.reduce((merged, item) => {
      const resolved = resolveSchemaRef(item, root) || {};
      return {
        ...merged,
        ...resolved,
        properties: { ...(merged.properties || {}), ...(resolved.properties || {}) },
        required: [...new Set([...(merged.required || []), ...(resolved.required || [])])]
      };
    }, {});
  }
  return schema;
}

function schemaFromOpenApi(openapi) {
  if (!openapi || typeof openapi !== 'object') return null;
  const direct = openapi.input_schema || openapi.inputSchema || openapi.request_schema;
  if (direct?.properties) return resolveSchemaRef(direct, openapi);
  for (const pathItem of Object.values(openapi.paths || {})) {
    for (const method of ['post', 'put', 'patch']) {
      const content = pathItem?.[method]?.requestBody?.content || {};
      for (const media of Object.values(content)) {
        const schema = resolveSchemaRef(media?.schema, openapi);
        if (schema?.properties) return schema;
      }
    }
  }
  const likely = Object.entries(openapi.components?.schemas || {}).find(([name, schema]) => /input|request/i.test(name) && schema?.properties);
  return likely ? resolveSchemaRef(likely[1], openapi) : null;
}

async function loadSchema() {
  if (!state.selectedModel) return;
  if (state.schemaReady) saveCurrentModelDraft();
  const endpointId = state.selectedModel.endpoint_id;
  const requestId = ++state.schemaRequest;
  state.schemaReady = false;
  updateSubmitControls();
  refs.schemaSource.textContent = '读取中…';
  refs.schemaNotice.classList.add('hidden');
  try {
    const payload = await api(`/api/schema/${encodeURIComponent(endpointId)}`);
    if (requestId !== state.schemaRequest || state.selectedModel?.endpoint_id !== endpointId) return;
    state.schemaPayload = payload;
    state.schema = payload.schema;
    state.formSchema = schemaFromOpenApi(payload.schema) || payload.schema?.schema || payload.schema;
    restoreModelDraft(endpointId, defaultsFromSchema(state.formSchema));
    refs.schemaSource.textContent = `${payload.live ? 'LIVE' : 'DEMO'} · ${payload.source}`;
    refs.schemaNotice.textContent = payload.notice || '';
    refs.schemaNotice.classList.toggle('hidden', !payload.notice);
    renderVisualForm();
    state.schemaReady = true;
    updateSubmitControls();
  } catch (error) {
    if (requestId !== state.schemaRequest || state.selectedModel?.endpoint_id !== endpointId) return;
    state.schemaReady = false;
    updateSubmitControls();
    refs.schemaSource.textContent = 'schema 读取失败';
    refs.visualForm.innerHTML = `<div class="catalog-loading">${escapeHtml(error.message)}</div>`;
    toast(error.message, 'error');
  }
}

function collectSchemaVariants(property, variants = [], seen = new Set()) {
  const resolved = resolveSchemaRef(property, state.schema || property) || property;
  if (!resolved || typeof resolved !== 'object' || seen.has(resolved)) return variants;
  seen.add(resolved);
  variants.push(resolved);
  for (const key of ['anyOf', 'oneOf']) {
    for (const item of resolved[key] || []) collectSchemaVariants(item, variants, seen);
  }
  return variants;
}

function propertyType(property) {
  for (const variant of collectSchemaVariants(property)) {
    const types = Array.isArray(variant.type) ? variant.type : [variant.type];
    const type = types.find((item) => item && item !== 'null');
    if (type) return type;
  }
  return 'string';
}

function propertyDefault(property) {
  for (const variant of collectSchemaVariants(property)) {
    if (variant.default !== undefined) return variant.default;
  }
  return undefined;
}

function propertyFormat(property) {
  return collectSchemaVariants(property).find((variant) => variant.format)?.format || '';
}

function propertyItems(property) {
  const variant = collectSchemaVariants(property).find((item) => item.items);
  return variant?.items ? (resolveSchemaRef(variant.items, state.schema || variant) || variant.items) : null;
}

function enumOptions(property) {
  const options = [];
  for (const variant of collectSchemaVariants(property)) {
    for (const option of variant.enum || []) {
      if (option !== null && !options.some((item) => Object.is(item, option))) options.push(option);
    }
  }
  return options;
}

function isAssetField(name, property) {
  const lowerName = String(name).toLowerCase();
  const type = propertyType(property);
  const format = propertyFormat(property);
  if (['uri', 'url'].includes(format) || /(?:_url|_uri|_urls|_uris)$/.test(lowerName)) return true;
  if (type === 'array') {
    const items = propertyItems(property);
    const itemFormat = items ? propertyFormat(items) : '';
    const itemType = items ? propertyType(items) : '';
    return ['uri', 'url'].includes(itemFormat) || (/^(?:images|input_images|reference_images|control_images|mask_images|videos|audios|files)$/.test(lowerName) && itemType === 'string');
  }
  return /^(?:image|input_image|reference_image|control_image|mask_image|video|audio|file)$/.test(lowerName) && type === 'string';
}

function assetAccept(name) {
  if (/image|mask/i.test(name)) return 'image/*';
  if (/video/i.test(name)) return 'video/*';
  if (/audio/i.test(name)) return 'audio/*';
  return 'image/*,video/*,audio/*,application/pdf';
}

function defaultsFromSchema(schema) {
  const result = {};
  for (const [name, property] of Object.entries(schema?.properties || {})) {
    const resolved = resolveSchemaRef(property, state.schema || property) || property;
    const defaultValue = propertyDefault(resolved);
    if (defaultValue !== undefined) result[name] = defaultValue;
    else if (propertyType(resolved) === 'boolean') result[name] = false;
  }
  return result;
}

function fieldPriority(name, property) {
  const lowerName = String(name).toLowerCase();
  if (lowerName === 'prompt') return 0;
  if (['system_prompt', 'system_instruction'].includes(lowerName)) return 1;
  if (isAssetField(name, property)) return 2;
  return 3;
}

function orderedSchemaEntries(schema) {
  const declaredOrder = new Map((schema?.['x-fal-order-properties'] || []).map((name, index) => [name, index]));
  return Object.entries(schema?.properties || {})
    .map(([name, property], index) => ({ name, property: resolveSchemaRef(property, state.schema || schema) || property, index }))
    .sort((left, right) => {
      const priorityDifference = fieldPriority(left.name, left.property) - fieldPriority(right.name, right.property);
      if (priorityDifference) return priorityDifference;
      return (declaredOrder.get(left.name) ?? left.index) - (declaredOrder.get(right.name) ?? right.index);
    })
    .map(({ name, property }) => [name, property]);
}

function isAdvancedField(name, property) {
  const common = ['prompt', 'system_prompt', 'system_instruction', 'image_url', 'image_urls', 'video_url', 'audio_url', 'duration', 'aspect_ratio', 'image_size', 'num_images', 'negative_prompt', 'thinking_level'];
  if (common.includes(name) || isAssetField(name, property) || enumOptions(property).length) return false;
  return propertyType(property) === 'object' || /advanced|guidance|strength|steps|seed|safety|sync|output/i.test(name);
}

function renderVisualForm() {
  const schema = state.formSchema;
  if (!schema?.properties || !Object.keys(schema.properties).length) {
    refs.visualForm.innerHTML = '<div class="empty-state"><div class="empty-glyph">JSON</div><h3>该 schema 无法映射为普通表单</h3><p>已经保留完整 JSON 编辑器，可直接填写并提交任意参数对象。</p></div>';
    setMode('json', { syncFromJson: false });
    return;
  }
  const required = new Set(schema.required || []);
  const entries = orderedSchemaEntries(schema);
  const primary = entries.filter(([name, property]) => !isAdvancedField(name, property));
  const advanced = entries.filter(([name, property]) => isAdvancedField(name, property));
  refs.visualForm.innerHTML = [
    renderSection('核心参数', 'required & common', primary, required),
    advanced.length ? renderSection('高级参数', 'optional', advanced, required) : ''
  ].join('');
  bindFields();
}

function renderSection(title, note, entries, required) {
  if (!entries.length) return '';
  return `<section class="form-section"><div class="form-section-heading"><h3>${escapeHtml(title)}</h3><span>${escapeHtml(note)}</span></div><div class="form-grid">${entries.map(([name, property]) => renderField(name, property, required.has(name))).join('')}</div></section>`;
}

function numericPropertyConfig(property, fallback = 512) {
  const variants = collectSchemaVariants(property);
  const firstValue = (key) => variants.find((variant) => variant[key] !== undefined)?.[key];
  const exclusiveMinimum = firstValue('exclusiveMinimum');
  const exclusiveMaximum = firstValue('exclusiveMaximum');
  return {
    min: firstValue('minimum') ?? (typeof exclusiveMinimum === 'number' ? exclusiveMinimum + 1 : 1),
    max: firstValue('maximum') ?? (typeof exclusiveMaximum === 'number' ? exclusiveMaximum - 1 : 14142),
    step: firstValue('multipleOf') || 1,
    defaultValue: propertyDefault(property) ?? fallback
  };
}

function usesGptImage2CustomSizeRules(endpointIdentity) {
  return String(endpointIdentity || '').split(/\s+/).some((endpoint) => /^(?:openai|fal-ai)\/gpt-image-2(?:\/edit)?$/i.test(endpoint));
}

function customImageSizeConfig(name, property) {
  if (name !== 'image_size') return null;
  const objectSchema = collectSchemaVariants(property).find((variant) => variant.type === 'object' && variant.properties?.width && variant.properties?.height);
  if (!objectSchema) return null;
  const endpointId = state.selectedModel?.endpoint_id || '';
  const metadataEndpoint = state.schema?.info?.['x-fal-metadata']?.endpointId || '';
  return {
    options: enumOptions(property),
    width: numericPropertyConfig(resolveSchemaRef(objectSchema.properties.width, state.schema || objectSchema) || objectSchema.properties.width),
    height: numericPropertyConfig(resolveSchemaRef(objectSchema.properties.height, state.schema || objectSchema) || objectSchema.properties.height),
    usesGptImage2Rules: usesGptImage2CustomSizeRules(`${endpointId} ${metadataEndpoint}`)
  };
}

function imageSizeOptionLabel(option) {
  const labels = { auto: 'Auto', square_hd: 'Square HD', square: 'Square', portrait_4_3: 'Portrait 3:4', portrait_16_9: 'Portrait 9:16', landscape_4_3: 'Landscape 4:3', landscape_16_9: 'Landscape 16:9' };
  return labels[option] || humanize(option);
}

function renderCustomImageSizeControl(name, property, config, required) {
  const value = state.inputs[name];
  const custom = value && typeof value === 'object' && !Array.isArray(value);
  const selected = value === undefined
    ? ''
    : custom
      ? '__custom__'
      : JSON.stringify(value);
  const width = custom ? Number(value.width ?? config.width.defaultValue) : config.width.defaultValue;
  const height = custom ? Number(value.height ?? config.height.defaultValue) : config.height.defaultValue;
  const optionMarkup = config.options.map((option) => {
    const encoded = JSON.stringify(option);
    return `<option value="${escapeHtml(encoded)}" ${encoded === selected ? 'selected' : ''}>${escapeHtml(imageSizeOptionLabel(option))}</option>`;
  }).join('');
  const rules = config.usesGptImage2Rules
    ? '宽和高都须为 16 px 的倍数；最长边不超过 3840 px；宽高比不超过 3:1；总像素须在 655,360 至 8,294,400 之间。'
    : `按当前 endpoint schema 提交：宽 ${config.width.min}–${config.width.max} px，步进 ${config.width.step}；高 ${config.height.min}–${config.height.max} px，步进 ${config.height.step}。`;
  return `<div class="image-size-control" data-image-size-control="${escapeHtml(name)}" data-gpt-image-2-rules="${config.usesGptImage2Rules ? 'true' : 'false'}"><select id="field-${escapeHtml(name)}" data-image-size-mode="${escapeHtml(name)}" ${required ? 'required' : ''}><option value="" ${selected === '' ? 'selected' : ''}>${required ? '请选择' : '未设置'}</option>${optionMarkup}<option value="__custom__" ${custom ? 'selected' : ''}>Custom</option></select><input type="number" inputmode="numeric" value="${width}" min="${config.width.min}" max="${config.width.max}" step="${config.width.step}" aria-label="自定义图片宽度" data-image-size-width="${escapeHtml(name)}" ${custom ? '' : 'disabled'}><span class="image-size-separator" aria-hidden="true">×</span><input type="number" inputmode="numeric" value="${height}" min="${config.height.min}" max="${config.height.max}" step="${config.height.step}" aria-label="自定义图片高度" data-image-size-height="${escapeHtml(name)}" ${custom ? '' : 'disabled'}><div class="image-size-hint" role="note"><strong>自定义尺寸格式：宽 × 高（px），例如 1024 × 1024。</strong><span>${escapeHtml(rules)}</span></div></div>`;
}

function assetValues(name, arrayMode) {
  const value = state.inputs[name];
  if (arrayMode) return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item) : [];
  return typeof value === 'string' && value ? [value] : [];
}

function assetKind(url, name) {
  const metadata = state.uploadMetadata.get(`${name}:${url}`);
  if (metadata?.type?.startsWith('image/')) return 'image';
  if (metadata?.type?.startsWith('video/')) return 'video';
  if (metadata?.type?.startsWith('audio/')) return 'audio';
  if (metadata?.type === 'application/pdf') return 'pdf';
  const clean = String(url).split('?')[0].toLowerCase();
  if (/image|mask/i.test(name) || /\.(png|jpe?g|webp|gif|avif)$/.test(clean)) return 'image';
  if (/video/i.test(name) || /\.(mp4|webm|mov|m4v)$/.test(clean)) return 'video';
  if (/audio/i.test(name) || /\.(mp3|wav|ogg|m4a|flac)$/.test(clean)) return 'audio';
  if (/\.pdf$/.test(clean)) return 'pdf';
  return 'file';
}

function assetReferenceLabel(name, kind, index) {
  if (/image|mask/i.test(name) || kind === 'image') return `#image${index + 1}`;
  if (kind === 'video') return `#video${index + 1}`;
  if (kind === 'audio') return `#audio${index + 1}`;
  return `#file${index + 1}`;
}

function referencePreviewMarkup(name, arrayMode) {
  const values = assetValues(name, arrayMode);
  if (!values.length) return '<div class="reference-empty">尚未添加参考资料</div>';
  return values.map((url, index) => {
    const kind = assetKind(url, name);
    const label = assetReferenceLabel(name, kind, index);
    const media = kind === 'image' ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" loading="lazy">`
      : kind === 'video' ? `<video src="${escapeHtml(url)}" controls preload="metadata"></video>`
        : kind === 'audio' ? `<div class="reference-file-icon">AUDIO</div><audio src="${escapeHtml(url)}" controls preload="metadata"></audio>`
          : `<div class="reference-file-icon">${kind === 'pdf' ? 'PDF' : 'FILE'}</div>`;
    return `<article class="reference-item" data-reference-index="${index}"><div class="reference-media">${media}</div><div class="reference-info"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(url)}</span></div><div class="reference-actions">${arrayMode ? `<button type="button" data-reference-move="-1" data-reference-index="${index}" title="上移" aria-label="上移" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-reference-move="1" data-reference-index="${index}" title="下移" aria-label="下移" ${index === values.length - 1 ? 'disabled' : ''}>↓</button>` : ''}<button class="danger" type="button" data-reference-remove="${index}" title="删除" aria-label="删除">×</button></div></article>`;
  }).join('');
}

function renderAssetManager(name, arrayMode, required) {
  const accept = assetAccept(name);
  const current = arrayMode ? '' : (assetValues(name, false)[0] || '');
  const hint = /image|mask/i.test(name)
    ? '参考图顺序会原样写入请求；提示词中的 #image1、#image2 分别对应列表第 1、2 项。'
    : '资料只有在上传成功并取得 fal CDN URL 后才会加入请求。';
  return `<div class="asset-manager" data-asset-manager="${escapeHtml(name)}" data-array-mode="${arrayMode ? 'true' : 'false'}"><div class="asset-entry-row"><input type="url" value="${escapeHtml(current)}" placeholder="https://…" data-asset-url="${escapeHtml(name)}" ${required && !arrayMode ? 'required' : ''}><button class="secondary-button asset-url-button" type="button" data-add-asset-url="${escapeHtml(name)}">${arrayMode ? '添加 URL' : '应用 URL'}</button><button class="upload-button" type="button" data-upload-for="${escapeHtml(name)}">添加文件</button><input class="hidden" type="file" data-file-for="${escapeHtml(name)}" ${arrayMode ? 'multiple' : ''} accept="${escapeHtml(accept)}"></div><p class="asset-order-hint">${escapeHtml(hint)}</p><div class="reference-list" data-reference-list="${escapeHtml(name)}">${referencePreviewMarkup(name, arrayMode)}</div></div>`;
}

function renderField(name, property, required) {
  const type = propertyType(property);
  const options = enumOptions(property);
  const customImageSize = customImageSizeConfig(name, property);
  const title = property.title || humanize(name);
  const description = property.description || '';
  const value = state.inputs[name] ?? '';
  const assetField = isAssetField(name, property);
  const assetArray = assetField && type === 'array';
  const wide = type === 'array' || type === 'object' || assetField || /prompt|url|text|description/i.test(name);
  const label = `<label class="field-label" for="field-${escapeHtml(name)}"><span>${escapeHtml(title)}${required ? ' <b class="required-mark">*</b>' : ''}</span><code>${escapeHtml(name)}</code></label>`;
  let control;
  if (customImageSize) {
    control = renderCustomImageSizeControl(name, property, customImageSize, required);
  } else if (options.length && type !== 'object') {
    const current = value === '' ? '' : JSON.stringify(value);
    control = `<select id="field-${escapeHtml(name)}" data-field="${escapeHtml(name)}" data-enum-json="true" ${required ? 'required' : ''}><option value="" ${current === '' ? 'selected' : ''}>${required ? '请选择' : '未设置'}</option>${options.map((option) => { const encoded = JSON.stringify(option); return `<option value="${escapeHtml(encoded)}" ${encoded === current ? 'selected' : ''}>${escapeHtml(String(option))}</option>`; }).join('')}</select>`;
  } else if (type === 'boolean') {
    control = `<label class="boolean-row"><input id="field-${escapeHtml(name)}" data-field="${escapeHtml(name)}" type="checkbox" ${value ? 'checked' : ''}><span>${escapeHtml(title)}</span></label>`;
  } else if (type === 'number' || type === 'integer') {
    const min = property.minimum ?? property.exclusiveMinimum ?? '';
    const max = property.maximum ?? property.exclusiveMaximum ?? '';
    const step = type === 'integer' ? 1 : (property.multipleOf || 'any');
    control = min !== '' && max !== ''
      ? `<div class="range-row"><input id="range-${escapeHtml(name)}" data-range="${escapeHtml(name)}" type="range" min="${min}" max="${max}" step="${step === 'any' ? 0.01 : step}" value="${value !== '' ? value : min}"><input id="field-${escapeHtml(name)}" data-field="${escapeHtml(name)}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" ${required ? 'required' : ''}></div>`
      : `<input id="field-${escapeHtml(name)}" data-field="${escapeHtml(name)}" type="number" ${min !== '' ? `min="${min}"` : ''} ${max !== '' ? `max="${max}"` : ''} step="${step}" value="${value}" ${required ? 'required' : ''}>`;
  } else if (assetField) {
    control = renderAssetManager(name, assetArray, required);
  } else if (type === 'array' || type === 'object') {
    const serialized = value === '' ? '' : JSON.stringify(value, null, 2);
    control = `<textarea id="field-${escapeHtml(name)}" data-field="${escapeHtml(name)}" data-json="true" placeholder="${type === 'array' ? '[]' : '{}'}" ${required ? 'required' : ''}>${escapeHtml(serialized)}</textarea>`;
  } else if (/prompt|text|description|instruction|caption/i.test(name) || Number(property.maxLength || 0) > 160) {
    control = `<textarea id="field-${escapeHtml(name)}" data-field="${escapeHtml(name)}" placeholder="${escapeHtml(property.examples?.[0] || property.example || '')}" ${required ? 'required' : ''}>${escapeHtml(value)}</textarea>`;
  } else {
    control = `<input id="field-${escapeHtml(name)}" data-field="${escapeHtml(name)}" type="text" value="${escapeHtml(value)}" placeholder="${escapeHtml(property.examples?.[0] || property.example || '')}" ${required ? 'required' : ''}>`;
  }
  return `<div class="field-block ${wide ? 'wide' : ''}" data-field-wrap="${escapeHtml(name)}">${label}${control}${description ? `<p class="field-description">${escapeHtml(description)}</p>` : ''}<p class="field-error hidden" data-error-for="${escapeHtml(name)}"></p></div>`;
}

function bindFields() {
  refs.visualForm.querySelectorAll('[data-field]').forEach((element) => {
    const update = () => updateInputFromElement(element);
    element.addEventListener(element.type === 'checkbox' || element.tagName === 'SELECT' ? 'change' : 'input', update);
  });
  refs.visualForm.querySelectorAll('[data-range]').forEach((range) => {
    const numberInput = refs.visualForm.querySelector(`[data-field="${CSS.escape(range.dataset.range)}"]`);
    range.addEventListener('input', () => {
      numberInput.value = range.value;
      updateInputFromElement(numberInput);
    });
    numberInput?.addEventListener('input', () => { if (numberInput.value !== '') range.value = numberInput.value; });
  });
  refs.visualForm.querySelectorAll('[data-image-size-mode]').forEach(bindImageSizeControl);
  refs.visualForm.querySelectorAll('[data-asset-manager]').forEach((manager) => bindAssetManager(manager.dataset.assetManager));
}

function bindImageSizeControl(select) {
  const name = select.dataset.imageSizeMode;
  const widthInput = refs.visualForm.querySelector(`[data-image-size-width="${CSS.escape(name)}"]`);
  const heightInput = refs.visualForm.querySelector(`[data-image-size-height="${CSS.escape(name)}"]`);
  const error = refs.visualForm.querySelector(`[data-error-for="${CSS.escape(name)}"]`);
  const usesGptImage2Rules = select.closest('[data-image-size-control]')?.dataset.gptImage2Rules === 'true';
  const sync = () => {
    const custom = select.value === '__custom__';
    widthInput.disabled = !custom;
    heightInput.disabled = !custom;
    if (!custom) {
      if (select.value === '') delete state.inputs[name];
      else state.inputs[name] = JSON.parse(select.value);
      error?.classList.add('hidden');
    } else {
      const width = Number(widthInput.value);
      const height = Number(heightInput.value);
      const validationError = validateCustomImageSize(width, height, {
        minWidth: Number(widthInput.min), maxWidth: Number(widthInput.max), widthStep: Number(widthInput.step),
        minHeight: Number(heightInput.min), maxHeight: Number(heightInput.max), heightStep: Number(heightInput.step), usesGptImage2Rules
      });
      if (validationError) {
        error.textContent = validationError;
        error.classList.remove('hidden');
        delete state.inputs[name];
      } else {
        error.classList.add('hidden');
        state.inputs[name] = { width, height };
      }
    }
    syncJsonEditor();
    saveCurrentModelDraft();
  };
  select.addEventListener('change', sync);
  widthInput.addEventListener('input', sync);
  heightInput.addEventListener('input', sync);
}

function validateCustomImageSize(width, height, rules = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return '宽和高必须填写为正整数像素。';
  if (Number.isFinite(rules.minWidth) && width < rules.minWidth) return `宽度不能小于 ${rules.minWidth} px。`;
  if (Number.isFinite(rules.maxWidth) && width > rules.maxWidth) return `宽度不能超过 ${rules.maxWidth} px。`;
  if (Number.isFinite(rules.minHeight) && height < rules.minHeight) return `高度不能小于 ${rules.minHeight} px。`;
  if (Number.isFinite(rules.maxHeight) && height > rules.maxHeight) return `高度不能超过 ${rules.maxHeight} px。`;
  if (Number.isFinite(rules.widthStep) && rules.widthStep > 1 && width % rules.widthStep !== 0) return `宽度必须是 ${rules.widthStep} px 的倍数。`;
  if (Number.isFinite(rules.heightStep) && rules.heightStep > 1 && height % rules.heightStep !== 0) return `高度必须是 ${rules.heightStep} px 的倍数。`;
  if (!rules.usesGptImage2Rules) return '';
  if (width % 16 !== 0 || height % 16 !== 0) return '宽和高都必须是 16 px 的倍数。';
  if (Math.max(width, height) > 3840) return '最长边不能超过 3840 px。';
  if (Math.max(width / height, height / width) > 3) return '宽高比不能超过 3:1。';
  const pixels = width * height;
  if (pixels < 655360 || pixels > 8294400) return '总像素必须在 655,360 至 8,294,400 之间。';
  return '';
}

function updateInputFromElement(element) {
  const name = element.dataset.field;
  let value;
  try {
    if (element.dataset.json === 'true') value = element.value.trim() ? JSON.parse(element.value) : undefined;
    else if (element.dataset.enumJson === 'true') value = element.value === '' ? undefined : JSON.parse(element.value);
    else if (element.type === 'checkbox') value = element.checked;
    else if (element.type === 'number') value = element.value === '' ? undefined : Number(element.value);
    else value = element.value === '' ? undefined : element.value;
    refs.visualForm.querySelector(`[data-error-for="${CSS.escape(name)}"]`)?.classList.add('hidden');
  } catch (error) {
    const target = refs.visualForm.querySelector(`[data-error-for="${CSS.escape(name)}"]`);
    if (target) {
      target.textContent = `JSON 格式无效：${error.message}`;
      target.classList.remove('hidden');
    }
    return;
  }
  if (value === undefined) delete state.inputs[name];
  else state.inputs[name] = value;
  syncJsonEditor();
  saveCurrentModelDraft();
}

function syncJsonEditor() {
  refs.jsonEditor.value = JSON.stringify(state.inputs, null, 2);
}

function bindAssetManager(name) {
  const manager = refs.visualForm.querySelector(`[data-asset-manager="${CSS.escape(name)}"]`);
  if (!manager) return;
  const arrayMode = manager.dataset.arrayMode === 'true';
  const urlInput = manager.querySelector(`[data-asset-url="${CSS.escape(name)}"]`);
  const addUrl = manager.querySelector(`[data-add-asset-url="${CSS.escape(name)}"]`);
  const uploadButton = manager.querySelector(`[data-upload-for="${CSS.escape(name)}"]`);
  const fileInput = manager.querySelector(`[data-file-for="${CSS.escape(name)}"]`);
  addUrl.addEventListener('click', () => applyAssetUrl(name, urlInput.value, arrayMode));
  if (!arrayMode) {
    urlInput.addEventListener('change', () => applyAssetUrl(name, urlInput.value, false));
  }
  uploadButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const files = [...(fileInput.files || [])];
    if (files.length) await uploadFiles(name, files, uploadButton, arrayMode);
    fileInput.value = '';
  });
  bindReferenceActions(name, manager);
}

function applyAssetUrl(name, rawUrl, arrayMode) {
  const url = String(rawUrl || '').trim();
  if (!url) {
    if (!arrayMode) {
      delete state.inputs[name];
      refreshAssetManager(name);
      syncJsonEditor();
      saveCurrentModelDraft();
    }
    return;
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('只接受 HTTP 或 HTTPS URL。');
  } catch (error) {
    toast(error.message === 'Invalid URL' ? '请输入有效 URL。' : error.message, 'error');
    return;
  }
  if (arrayMode) {
    const current = assetValues(name, true);
    if (!current.includes(url)) state.inputs[name] = [...current, url];
  } else {
    state.inputs[name] = url;
  }
  syncJsonEditor();
  saveCurrentModelDraft();
  refreshAssetManager(name, { clearUrlInput: arrayMode });
}

function refreshAssetManager(name, { clearUrlInput = false } = {}) {
  const manager = refs.visualForm.querySelector(`[data-asset-manager="${CSS.escape(name)}"]`);
  if (!manager) return;
  const arrayMode = manager.dataset.arrayMode === 'true';
  const input = manager.querySelector(`[data-asset-url="${CSS.escape(name)}"]`);
  if (clearUrlInput) input.value = '';
  else if (!arrayMode) input.value = assetValues(name, false)[0] || '';
  manager.querySelector(`[data-reference-list="${CSS.escape(name)}"]`).innerHTML = referencePreviewMarkup(name, arrayMode);
  bindReferenceActions(name, manager);
}

function bindReferenceActions(name, manager) {
  manager.querySelectorAll('[data-reference-move]').forEach((button) => {
    button.addEventListener('click', () => moveReference(name, Number(button.dataset.referenceIndex), Number(button.dataset.referenceMove)));
  });
  manager.querySelectorAll('[data-reference-remove]').forEach((button) => {
    button.addEventListener('click', () => removeReference(name, Number(button.dataset.referenceRemove)));
  });
}

function moveReference(name, index, delta) {
  const values = assetValues(name, true);
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= values.length) return;
  [values[index], values[nextIndex]] = [values[nextIndex], values[index]];
  state.inputs[name] = values;
  syncJsonEditor();
  saveCurrentModelDraft();
  refreshAssetManager(name);
}

function removeReference(name, index) {
  const manager = refs.visualForm.querySelector(`[data-asset-manager="${CSS.escape(name)}"]`);
  const arrayMode = manager?.dataset.arrayMode === 'true';
  const values = assetValues(name, arrayMode);
  const removed = values[index];
  if (removed) state.uploadMetadata.delete(`${name}:${removed}`);
  if (arrayMode) {
    const next = values.filter((_, itemIndex) => itemIndex !== index);
    if (next.length) state.inputs[name] = next;
    else delete state.inputs[name];
  } else {
    delete state.inputs[name];
  }
  syncJsonEditor();
  saveCurrentModelDraft();
  refreshAssetManager(name);
}

async function uploadFiles(name, files, button, arrayMode) {
  if (!state.health?.hasKey) {
    openAuth();
    toast('上传前需要连接 fal.ai。', 'error');
    return;
  }
  if (files.some((file) => file.size > 90 * 1024 * 1024)) {
    toast('单文件上限为 90 MB。', 'error');
    return;
  }
  const original = button.textContent;
  let uploadedCount = 0;
  let failedCount = 0;
  button.disabled = true;
  try {
    for (const [index, file] of files.entries()) {
      button.textContent = files.length > 1 ? `上传中 ${index + 1}/${files.length}` : '上传中';
      try {
        const payload = await api('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'X-File-Name': encodeURIComponent(file.name)
          },
          body: file
        });
        if (!payload.url) throw new Error('上传响应缺少可用的 CDN URL。');
        state.uploadMetadata.set(`${name}:${payload.url}`, { name: file.name, type: file.type });
        if (arrayMode) state.inputs[name] = [...assetValues(name, true), payload.url];
        else state.inputs[name] = payload.url;
        uploadedCount += 1;
        syncJsonEditor();
        saveCurrentModelDraft();
        refreshAssetManager(name, { clearUrlInput: arrayMode });
      } catch (error) {
        failedCount += 1;
        toast(`${file.name} 上传失败：${error.message}`, 'error');
      }
    }
    if (uploadedCount > 0 && failedCount === 0) toast(`${uploadedCount} 个参考资料已上传并加入请求。`);
    else if (uploadedCount > 0) toast(`${uploadedCount} 个上传成功，${failedCount} 个失败。`);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function parseJsonEditor() {
  try {
    const value = JSON.parse(refs.jsonEditor.value || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON 顶层必须是对象。');
    refs.jsonError.classList.add('hidden');
    return value;
  } catch (error) {
    refs.jsonError.textContent = `请求 JSON 无效：${error.message}`;
    refs.jsonError.classList.remove('hidden');
    throw error;
  }
}

function setMode(mode, { syncFromJson = true } = {}) {
  if (mode === 'visual' && state.mode === 'json' && syncFromJson) {
    state.inputs = parseJsonEditor();
    renderVisualForm();
  }
  state.mode = mode;
  const visual = mode === 'visual';
  refs.visualTab.classList.toggle('active', visual);
  refs.jsonTab.classList.toggle('active', !visual);
  refs.visualTab.setAttribute('aria-selected', String(visual));
  refs.jsonTab.setAttribute('aria-selected', String(!visual));
  refs.visualForm.classList.toggle('hidden', !visual);
  refs.jsonWrap.classList.toggle('hidden', visual);
  if (!visual) syncJsonEditor();
}

function validateRequiredInputs(inputs) {
  for (const name of state.formSchema?.required || []) {
    const value = inputs[name];
    const missing = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
    if (missing) throw new Error(`请完成必填参数：${name}`);
  }
}

function currentInputs() {
  if (state.mode === 'json') {
    state.inputs = parseJsonEditor();
  } else {
    if (!document.querySelector('#model-form').reportValidity()) throw new Error('请完成必填参数。');
    const invalid = refs.visualForm.querySelector('.field-error:not(.hidden)');
    if (invalid) throw new Error('请修正表单中的参数错误。');
  }
  validateRequiredInputs(state.inputs);
  return state.inputs;
}

function requestObject(asyncMode) {
  return { endpointId: state.selectedModel?.endpoint_id, async: Boolean(asyncMode), inputs: cloneJson(currentInputs()) };
}

function requestClearInputs() {
  if (!state.selectedModel || !state.formSchema) return;
  if (loadClearInputsPreference().skipConfirmation) {
    clearCurrentInputs();
    return;
  }
  refs.clearInputsDontAsk.checked = false;
  refs.clearInputsDialog.showModal();
}

function confirmClearInputs() {
  if (refs.clearInputsDontAsk.checked) saveClearInputsPreference({ skipConfirmation: true });
  refs.clearInputsDialog.close();
  clearCurrentInputs();
}

function clearCurrentInputs() {
  if (!state.selectedModel || !state.formSchema) return;
  const form = document.querySelector('#model-form');
  const formScrollTop = form?.scrollTop || 0;
  const windowScrollX = window.scrollX;
  const windowScrollY = window.scrollY;
  state.inputs = defaultsFromSchema(state.formSchema);
  state.uploadMetadata.clear();
  refs.jsonError.textContent = '';
  refs.jsonError.classList.add('hidden');
  syncJsonEditor();
  saveCurrentModelDraft();
  renderVisualForm();
  if (form) form.scrollTop = formScrollTop;
  window.scrollTo(windowScrollX, windowScrollY);
  window.requestAnimationFrame(() => {
    if (form) form.scrollTop = formScrollTop;
    window.scrollTo(windowScrollX, windowScrollY);
  });
  toast('当前提示词和附件已清除，请求配置已恢复为当前模型的 Schema 默认值；所选模型保持不变。');
}

function openRequestPreview() {
  try {
    refs.requestPreview.textContent = JSON.stringify({
      endpointId: state.selectedModel?.endpoint_id,
      mode: '选择“提交任务”同步等待，或选择“队列任务”异步提交',
      inputs: currentInputs()
    }, null, 2);
    refs.requestDialog.showModal();
  } catch (error) {
    toast(error.message, 'error');
  }
}

function statusLabel(status) {
  const labels = { submitting: '提交中', in_queue: '队列中', queued: '队列中', pending: '等待中', in_progress: '生成中', processing: '生成中', running: '生成中', completed: '已完成', cancelled: '已取消', canceled: '已取消', failed: '失败', error: '错误' };
  return labels[status] || humanize(status);
}

function requestIdFrom(result) {
  return result?.request_id || result?.requestId || result?.id || '';
}

function queueUrlsFrom(result) {
  return { statusUrl: result?.status_url || result?.statusUrl || '', responseUrl: result?.response_url || result?.responseUrl || '', cancelUrl: result?.cancel_url || result?.cancelUrl || '' };
}

function addHistory(item) {
  item.status = statusText(item.response);
  if (isTerminalStatus(item.status) && !item.completedAt) item.completedAt = item.updatedAt || new Date().toISOString();
  setDismissedResultTaskId(null);
  state.history.unshift(item);
  state.history = state.history.slice(0, 30);
  if (item.resultPresentation === 'result') state.activeTaskId = item.id;
  saveHistory();
  renderHistory();
  return item;
}

function currentTask() {
  return state.history.find((item) => item.id === state.activeTaskId) || null;
}

function enterMultiTaskMode() {
  state.multiTaskMode = true;
  state.history
    .filter((task) => !isTerminalStatus(statusText(task.response)))
    .forEach((task) => {
      task.resultPresentation = 'history';
      state.multiTaskIds.add(task.id);
    });
  state.activeTaskId = null;
  state.result = null;
  saveHistory();
  renderHistory();
  renderTaskEmpty('多个任务生成中', '各任务状态和参考输出已分开记录在历史中，完成后会逐项提醒。', '▦');
  showResultTab('result');
}

function settleMultiTaskPresentation() {
  if (!state.multiTaskMode) return;
  const trackedTasks = [...state.multiTaskIds]
    .map((taskId) => state.history.find((task) => task.id === taskId))
    .filter(Boolean);
  const pendingCount = trackedTasks.filter((task) => !isTerminalStatus(statusText(task.response))).length;
  if (pendingCount > 0) {
    if (!state.activeTaskId) {
      renderTaskEmpty('多个任务生成中', `${pendingCount} 个任务仍在运行；各任务状态和输出分别保留在历史中。`, '▦');
    }
    return;
  }
  state.multiTaskMode = false;
  state.multiTaskIds.clear();
  state.activeTaskId = null;
  state.result = null;
  renderTaskEmpty('暂无任务生成', '多个任务均已结束，生成结果请在历史中查看。');
}

function updateTask(taskId, response, changes = {}) {
  const task = state.history.find((item) => item.id === taskId);
  if (!task) return null;
  const previousStatus = statusText(task.response);
  const updatedAt = new Date().toISOString();
  const nextStatus = statusText(response);
  Object.assign(task, changes, { response, status: nextStatus, updatedAt });
  if (isTerminalStatus(nextStatus) && !task.completedAt) task.completedAt = updatedAt;
  saveHistory();
  if (state.activeTaskId === taskId && task.resultPresentation !== 'history') {
    state.result = response;
    refs.responseJson.textContent = JSON.stringify(response, null, 2);
    renderResult(task);
  }
  renderHistory();
  notifyTaskTerminal(task, previousStatus, nextStatus);
  if (['completed', 'failed', 'error'].includes(nextStatus) && !['completed', 'failed', 'error'].includes(previousStatus)) {
    void refreshBalance();
    window.setTimeout(() => { void refreshBalance(); }, 30_000);
  }
  settleMultiTaskPresentation();
  return task;
}

async function submitRun(asyncMode = false) {
  if (!state.selectedModel) return;
  if (!state.health?.hasKey) {
    openAuth();
    toast('提交任务前需要连接 fal.ai。', 'error');
    return;
  }
  let request;
  try {
    request = requestObject(asyncMode);
    saveCurrentModelDraft();
  } catch (error) {
    toast(error.message, 'error');
    return;
  }
  const hasPendingTasks = state.history.some((task) => !isTerminalStatus(statusText(task.response)));
  const multiTask = state.multiTaskMode || hasPendingTasks;
  if (multiTask) enterMultiTaskMode();
  const task = await runRequest(request, { model: cloneJson(state.selectedModel), switchToResult: !multiTask, resultPresentation: multiTask ? 'history' : 'result' });
  if (!multiTask && task && !isTerminalStatus(statusText(task.response))) {
    window.setTimeout(() => {
      const hasAnotherPendingTask = state.history.some((item) => item.id !== task.id && !isTerminalStatus(statusText(item.response)));
      if (hasAnotherPendingTask) enterMultiTaskMode();
    }, 0);
  }
}

async function runRequest(request, { model = null, retriedFrom = null, switchToResult = true, sourceButton = null, resultPresentation = 'result' } = {}) {
  const submitAction = request.async ? 'queue' : 'run';
  const activeButton = sourceButton || (request.async ? refs.queueButton : refs.runButton);
  const createdAt = new Date().toISOString();
  const task = addHistory({
    id: cryptoRandomId(), endpointId: request.endpointId, modelTitle: modelTitle(model || state.selectedModel), model: cloneJson(model || state.selectedModel),
    createdAt, updatedAt: createdAt, request: cloneJson(request), response: { status: 'submitting' }, retriedFrom, resultPresentation
  });
  if (state.multiTaskMode) state.multiTaskIds.add(task.id);
  if (resultPresentation === 'result') {
    state.result = task.response;
    refs.responseJson.textContent = JSON.stringify(task.response, null, 2);
    renderResult(task);
  }
  if (switchToResult && resultPresentation === 'result') showResultTab('result');
  setSubmittingAction(submitAction, true);
  activeButton?.classList.add('busy');
  const label = activeButton?.querySelector?.('[data-submit-label]');
  if (label) label.textContent = '提交中';
  try {
    const payload = await api('/api/run', { method: 'POST', body: JSON.stringify({ ...request, taskId: task.id }) });
    const updated = updateTask(task.id, payload.result, { pollError: '' });
    if (updated && requestIdFrom(payload.result) && !isTerminalStatus(statusText(payload.result))) scheduleTaskPoll(task.id, 1200);
    toast(request.async ? '队列任务已提交，任务台会自动更新。' : '任务已提交，完成后会自动显示结果。');
    return updated;
  } catch (error) {
    const failure = { status: 'failed', error: { code: error.code, message: error.message, details: error.details } };
    updateTask(task.id, failure, { pollError: '' });
    toast(error.message, 'error');
    return null;
  } finally {
    activeButton?.classList.remove('busy');
    if (label) label.textContent = request.async ? '队列任务' : '提交任务';
    setSubmittingAction(submitAction, false);
    if (sourceButton && !sourceButton.querySelector?.('[data-submit-label]')) sourceButton.disabled = false;
  }
}

function clearTaskPoll(taskId) {
  const timer = state.pollTimers.get(taskId);
  if (timer) window.clearTimeout(timer);
  state.pollTimers.delete(taskId);
}

function scheduleTaskPoll(taskId, delay = 3000) {
  clearTaskPoll(taskId);
  const task = state.history.find((item) => item.id === taskId);
  if (!task || !state.health?.hasKey || isTerminalStatus(statusText(task.response)) || !requestIdFrom(task.response)) return;
  state.pollTimers.set(taskId, window.setTimeout(() => pollTask(taskId), delay));
}

async function pollTask(taskId, { announce = false } = {}) {
  const task = state.history.find((item) => item.id === taskId);
  if (!task || state.pollingTasks.has(taskId) || isTerminalStatus(statusText(task.response))) return;
  const requestId = requestIdFrom(task.response);
  if (!requestId) return;
  state.pollingTasks.add(taskId);
  clearTaskPoll(taskId);
  try {
    const payload = await api('/api/task/status', {
      method: 'POST',
      body: JSON.stringify({ endpointId: task.endpointId, requestId, taskId: task.id, ...queueUrlsFrom(task.response) })
    });
    const previousStatus = statusText(task.response);
    const updated = updateTask(taskId, payload.result, { pollError: '' });
    const nextStatus = statusText(payload.result);
    if (announce) toast('任务状态已更新。');
    if (nextStatus === 'completed' && previousStatus !== 'completed') toast('任务已完成，输出已经载入。');
    if (updated && !isTerminalStatus(nextStatus)) scheduleTaskPoll(taskId);
  } catch (error) {
    task.pollError = error.message;
    task.updatedAt = new Date().toISOString();
    saveHistory();
    if (state.activeTaskId === taskId) renderResult(task);
    renderHistory();
    if (announce) toast(error.message, 'error');
    scheduleTaskPoll(taskId, 5000);
  } finally {
    state.pollingTasks.delete(taskId);
    const latest = state.history.find((item) => item.id === taskId);
    if (latest && !isTerminalStatus(statusText(latest.response)) && !state.pollTimers.has(taskId)) scheduleTaskPoll(taskId);
  }
}

function resumePendingTasks() {
  if (!state.health?.hasKey) return;
  state.history.forEach((task, index) => {
    if (!isTerminalStatus(statusText(task.response)) && requestIdFrom(task.response)) scheduleTaskPoll(task.id, 700 + index * 350);
  });
}

function findAssets(value, path = '', results = [], seen = new Set()) {
  if (value === null || value === undefined || seen.has(value)) return results;
  if (typeof value === 'object') seen.add(value);
  if (typeof value === 'string' && /^(?:https?:\/\/|data:(?:image|video|audio)\/)/i.test(value)) {
    if (/(?:status|response|cancel)_url$/i.test(path)) return results;
    const lower = value.split('?')[0].toLowerCase();
    const kind = /^data:image\//i.test(value) || /\.(png|jpe?g|webp|gif|avif)$/.test(lower) || /(?:^|\.)images?(?:\[|\.|$)/i.test(path) ? 'image'
      : /^data:video\//i.test(value) || /\.(mp4|webm|mov|m4v)$/.test(lower) || /(?:^|\.)videos?(?:\[|\.|$)/i.test(path) ? 'video'
        : /^data:audio\//i.test(value) || /\.(mp3|wav|ogg|m4a|flac)$/.test(lower) || /(?:^|\.)audios?(?:\[|\.|$)/i.test(path) ? 'audio'
          : /\.(glb|gltf|obj|fbx|zip|pdf)$/.test(lower) || /(?:^|\.)files?(?:\[|\.|$)/i.test(path) ? 'file' : null;
    if (kind && !results.some((item) => item.url === value)) results.push({ url: value, kind, path });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => findAssets(item, `${path}[${index}]`, results, seen));
  } else if (typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => findAssets(item, path ? `${path}.${key}` : key, results, seen));
  }
  return results;
}

function taskLogs(result) {
  const logs = result?.logs;
  if (!logs) return [];
  if (Array.isArray(logs)) return logs.map((entry) => typeof entry === 'string' ? entry : entry?.message || entry?.text || JSON.stringify(entry)).filter(Boolean);
  if (typeof logs === 'object') return Object.entries(logs).map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
  return [String(logs)];
}

function formatTaskTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分 ${seconds % 60} 秒`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`;
}

function taskStatusMessage(status, result) {
  if (status === 'submitting') return '任务已经提交，正在等待 fal.ai 返回完整生成结果。';
  if (['in_queue', 'queued', 'pending'].includes(status)) return Number.isInteger(result?.queue_position) ? `正在等待可用算力，当前队列位置 ${result.queue_position}。` : '正在等待可用算力，任务台会自动检查状态。';
  if (['in_progress', 'processing', 'running'].includes(status)) return 'fal.ai 正在生成，完成后输出会自动出现在这里。';
  if (status === 'completed') return '生成完成，输出文件已载入。';
  if (['cancelled', 'canceled'].includes(status)) return '任务已取消。';
  if (['failed', 'error'].includes(status)) return result?.error?.message || result?.message || '任务执行失败。';
  return '任务状态已记录。';
}

function renderAsset(asset, index, taskId) {
  const url = escapeHtml(asset.url);
  const media = asset.kind === 'image' ? `<img class="output-image-preview" src="${url}" alt="模型输出图片" loading="lazy" data-lightbox-image="${url}" title="单击查看全图">`
    : asset.kind === 'video' ? `<video src="${url}" controls preload="metadata"></video>`
      : asset.kind === 'audio' ? `<audio src="${url}" controls preload="metadata"></audio>`
        : `<div class="file-asset">${escapeHtml(asset.path || 'output file')}</div>`;
  return `<figure class="asset-card">${media}<div class="asset-actions"><a href="${url}" target="_blank" rel="noreferrer" title="打开原始文件" aria-label="打开原始文件">↗</a><button type="button" data-save-asset="${escapeHtml(taskId)}" data-asset-index="${index}" title="另存为" aria-label="另存为">⇩</button></div><figcaption>OUTPUT ${index + 1}<span>${escapeHtml(asset.kind)}</span></figcaption></figure>`;
}

function taskDetailMarkup(task, context = 'result') {
  const result = task?.response || {};
  const status = statusText(result);
  const requestId = requestIdFrom(result);
  const assets = findAssets(result);
  const logs = taskLogs(result);
  const createdAt = task?.createdAt || new Date().toISOString();
  const endAt = task?.completedAt || (isTerminalStatus(status) ? task?.updatedAt : null);
  const elapsed = formatDuration(new Date(endAt || Date.now()).getTime() - new Date(createdAt).getTime());
  const queuePosition = Number.isInteger(result?.queue_position) ? String(result.queue_position) : '—';
  const polling = Boolean(task?.id && state.pollingTasks.has(task.id));
  const pending = status === 'submitting' || Boolean(requestId && !isTerminalStatus(status));
  const statusClass = escapeHtml(status.replace(/[^a-z0-9_-]/g, ''));
  const outputMarkup = assets.length
    ? `<section class="task-output-section"><div class="section-label"><span>OUTPUT</span><strong>${assets.length} 个文件</strong></div><div class="asset-grid ${assets.length === 1 ? 'single' : ''}">${assets.map((asset, index) => renderAsset(asset, index, task.id)).join('')}</div></section>`
    : `<div class="task-output-placeholder ${pending ? 'working' : ''}"><div class="output-loader" aria-hidden="true"></div><strong>${pending ? statusLabel(status) : '没有可预览输出'}</strong><span>${pending ? '输出会在生成完成后自动显示' : '完整返回内容仍保留在响应 JSON 中'}</span></div>`;
  const errorMarkup = task?.pollError ? `<div class="task-inline-error"><strong>状态更新暂时失败</strong><span>${escapeHtml(task.pollError)}</span></div>` : '';
  const logsMarkup = logs.length ? `<details class="task-log"><summary>运行日志 <span>${logs.length}</span></summary><div>${logs.slice(-12).map((line) => `<code>${escapeHtml(line)}</code>`).join('')}</div></details>` : '';
  return `<article class="task-detail" data-task-detail="${escapeHtml(task.id)}" data-task-context="${escapeHtml(context)}"><header class="task-detail-header"><div class="task-title-block"><span class="task-kicker">${task?.request?.async ? 'QUEUE TASK' : 'DIRECT RUN'}</span><h3>${escapeHtml(task?.modelTitle || task?.endpointId)}</h3><code>${escapeHtml(task?.endpointId)}</code></div><span class="run-status ${statusClass}"><i></i>${escapeHtml(statusLabel(status))}</span></header><div class="task-progress ${pending ? 'active' : ''} ${statusClass}" aria-hidden="true"><i></i></div><p class="task-status-copy">${escapeHtml(taskStatusMessage(status, result))}</p>${requestId ? `<div class="request-id-row"><span>REQUEST ID</span><code>${escapeHtml(requestId)}</code><button type="button" data-copy-value="${escapeHtml(requestId)}" title="复制 Request ID" aria-label="复制 Request ID">□</button></div>` : ''}<dl class="task-metrics"><div><dt>创建时间</dt><dd>${escapeHtml(formatTaskTime(createdAt))}</dd></div><div><dt>已用时间</dt><dd>${escapeHtml(elapsed)}</dd></div><div><dt>队列位置</dt><dd>${escapeHtml(queuePosition)}</dd></div><div><dt>输出</dt><dd>${assets.length || '—'}</dd></div></dl><div class="task-toolbar">${pending ? `<button type="button" data-task-refresh="${escapeHtml(task.id)}" ${polling ? 'disabled' : ''}>${polling ? '更新中' : '刷新'}</button><button class="danger" type="button" data-task-cancel="${escapeHtml(task.id)}">取消</button>` : ''}${task?.request ? `<button type="button" data-task-retry="${escapeHtml(task.id)}">重试</button><button type="button" data-task-load-request="${escapeHtml(task.id)}">复制请求</button>` : ''}<button type="button" data-task-copy-response="${escapeHtml(task.id)}">复制响应</button><button class="icon-only" type="button" data-toggle-task-json title="查看响应 JSON" aria-label="查看响应 JSON">{ }</button></div><pre class="task-inline-json hidden">${escapeHtml(JSON.stringify(result, null, 2))}</pre></article>${errorMarkup}${outputMarkup}${logsMarkup}`;
}

function renderResult(task = currentTask()) {
  if (!task) {
    renderTaskEmpty();
    return;
  }
  refs.resultView.innerHTML = taskDetailMarkup(task, 'result');
  const header = refs.resultView.querySelector('.task-detail-header');
  if (header) {
    const status = header.querySelector('.run-status');
    const actions = document.createElement('div');
    actions.className = 'task-detail-header-actions';
    if (status) status.replaceWith(actions);
    else header.append(actions);
    if (status) actions.append(status);

    const dismiss = document.createElement('button');
    dismiss.className = 'task-result-dismiss';
    dismiss.type = 'button';
    dismiss.dataset.dismissResult = task.id;
    dismiss.title = '关闭当前结果';
    dismiss.setAttribute('aria-label', '关闭当前结果');
    dismiss.textContent = '×';
    actions.append(dismiss);
  }
  bindTaskActions(refs.resultView);
}

function bindTaskActions(container) {
  container.querySelectorAll('[data-lightbox-image]').forEach((image) => image.addEventListener('click', () => openImageLightbox(image.dataset.lightboxImage, image.alt)));
  container.querySelectorAll('[data-dismiss-result]').forEach((button) => button.addEventListener('click', () => dismissResultPresentation(button.dataset.dismissResult)));
  container.querySelectorAll('[data-copy-value]').forEach((button) => button.addEventListener('click', () => copyText(button.dataset.copyValue, 'Request ID 已复制。')));
  container.querySelectorAll('[data-task-refresh]').forEach((button) => button.addEventListener('click', () => pollTask(button.dataset.taskRefresh, { announce: true })));
  container.querySelectorAll('[data-task-cancel]').forEach((button) => button.addEventListener('click', () => cancelTask(button.dataset.taskCancel)));
  container.querySelectorAll('[data-task-retry]').forEach((button) => button.addEventListener('click', () => retryTask(button.dataset.taskRetry, button)));
  container.querySelectorAll('[data-task-load-request]').forEach((button) => button.addEventListener('click', () => loadTaskRequest(button.dataset.taskLoadRequest, { announce: true })));
  container.querySelectorAll('[data-task-copy-response]').forEach((button) => button.addEventListener('click', () => copyTaskJson(button.dataset.taskCopyResponse, 'response')));
  container.querySelectorAll('[data-toggle-task-json]').forEach((button) => button.addEventListener('click', () => button.closest('[data-task-detail]')?.querySelector('.task-inline-json')?.classList.toggle('hidden')));
  container.querySelectorAll('[data-save-asset]').forEach((button) => button.addEventListener('click', () => saveAsset(button.dataset.saveAsset, Number(button.dataset.assetIndex), button)));
}

function openImageLightbox(url, alt = '生成图片全图预览') {
  if (!url || !refs.imageLightbox || !refs.imageLightboxImage) return;
  refs.imageLightboxImage.src = url;
  refs.imageLightboxImage.alt = alt || '生成图片全图预览';
  refs.imageLightbox.classList.remove('hidden');
  refs.imageLightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lightbox-open');
  refs.imageLightboxClose?.focus({ preventScroll: true });
}

function closeImageLightbox() {
  if (!refs.imageLightbox || refs.imageLightbox.classList.contains('hidden')) return;
  refs.imageLightbox.classList.add('hidden');
  refs.imageLightbox.setAttribute('aria-hidden', 'true');
  refs.imageLightboxImage.removeAttribute('src');
  document.body.classList.remove('lightbox-open');
}

function dismissResultPresentation(taskId) {
  if (!taskId || state.activeTaskId !== taskId) return;
  setDismissedResultTaskId(taskId);
  state.activeTaskId = null;
  state.result = null;
  renderTaskEmpty('暂无任务生成');
  renderHistory();
  showResultTab('result');
}

function copyTaskJson(taskId, key) {
  const task = state.history.find((item) => item.id === taskId);
  if (!task) return;
  copyText(JSON.stringify(task[key], null, 2), key === 'request' ? '请求 JSON 已复制。' : '响应 JSON 已复制。');
}

async function loadTaskRequest(taskId, { announce = false } = {}) {
  const task = state.history.find((item) => item.id === taskId);
  if (!task?.request) return false;
  const model = state.models.find((item) => item.endpoint_id === task.endpointId) || task.model || {
    endpoint_id: task.endpointId, title: task.modelTitle || task.endpointId, category: 'other', status: 'active', model_url: `https://fal.ai/models/${task.endpointId}`
  };
  await selectModel(model, { promote: true });
  state.inputs = cloneJson(task.request.inputs || {});
  state.uploadMetadata = new Map();
  syncJsonEditor();
  renderVisualForm();
  setMode('visual', { syncFromJson: false });
  saveCurrentModelDraft();
  if (announce) toast('原模型已临时置顶，提示词和全部请求参数已载入左侧表单。');
  return true;
}

function fileNameFromAsset(asset, index) {
  try {
    const name = decodeURIComponent(new URL(asset.url).pathname.split('/').filter(Boolean).at(-1) || '');
    if (name && name.includes('.')) return name;
  } catch {
    // Use the output fallback below.
  }
  const extensions = { image: 'png', video: 'mp4', audio: 'mp3', file: 'bin' };
  return `fal-output-${index + 1}.${extensions[asset.kind] || 'bin'}`;
}

async function saveAsset(taskId, assetIndex, button) {
  const task = state.history.find((item) => item.id === taskId);
  const asset = task ? findAssets(task.response)[assetIndex] : null;
  if (!asset) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = '…';
  try {
    const fileName = fileNameFromAsset(asset, assetIndex);
    const saveHandle = 'showSaveFilePicker' in window
      ? await window.showSaveFilePicker({ suggestedName: fileName })
      : null;
    const response = await fetch('/api/task/asset/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, assetIndex, url: asset.url, fileName })
    });
    if (!response.ok) {
      let message = `下载失败：HTTP ${response.status}`;
      try {
        const payload = await response.json();
        message = payload?.error?.message || message;
      } catch {
        // Keep the HTTP fallback when the server response is not JSON.
      }
      throw new Error(message);
    }
    if (saveHandle) {
      const writable = await saveHandle.createWritable();
      try {
        if (response.body) await response.body.pipeTo(writable);
        else {
          await writable.write(await response.blob());
          await writable.close();
        }
      } catch (error) {
        await writable.abort().catch(() => {});
        throw error;
      }
      task.savedOutputs = [...(task.savedOutputs || []).filter((item) => item.assetIndex !== assetIndex), { assetIndex, fileName, savedAt: new Date().toISOString(), external: true }];
      saveHistory();
    } else {
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
    toast('输出文件已保存。');
  } catch (error) {
    if (error?.name !== 'AbortError') toast(error.message || '文件保存失败。', 'error');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function cancelTask(taskId) {
  const task = state.history.find((item) => item.id === taskId);
  if (!task || !requestIdFrom(task.response)) return;
  clearTaskPoll(taskId);
  try {
    const payload = await api('/api/task/status', {
      method: 'POST',
      body: JSON.stringify({ endpointId: task.endpointId, requestId: requestIdFrom(task.response), action: 'cancel', ...queueUrlsFrom(task.response) })
    });
    updateTask(taskId, payload.result, { pollError: '' });
    toast('已发送取消请求。');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function retryTask(taskId, button) {
  const original = state.history.find((item) => item.id === taskId);
  if (!original?.request) return;
  button.disabled = true;
  try {
    await loadTaskRequest(taskId, { announce: false });
    const multiTask = state.multiTaskMode || state.history.some((task) => !isTerminalStatus(statusText(task.response)));
    if (multiTask) enterMultiTaskMode();
    await runRequest(cloneJson(original.request), { model: cloneJson(original.model), retriedFrom: original.id, switchToResult: !multiTask, sourceButton: button, resultPresentation: multiTask ? 'history' : 'result' });
    toast('原请求配置已恢复并重新提交。');
  } catch (error) {
    toast(error.message, 'error');
    button.disabled = false;
  }
}

function showTask(task, { switchTab = true } = {}) {
  if (!task) return;
  setDismissedResultTaskId(null);
  task.resultPresentation = 'result';
  state.activeTaskId = task.id;
  state.result = task.response;
  refs.responseJson.textContent = JSON.stringify(task.response, null, 2);
  saveHistory();
  renderResult(task);
  renderHistory();
  if (switchTab) showResultTab('result');
  if (!isTerminalStatus(statusText(task.response))) scheduleTaskPoll(task.id, 300);
}

function selectHistoryTask(taskId) {
  const task = state.history.find((item) => item.id === taskId);
  if (!task) return;
  state.historyExpandedTaskId = state.historyExpandedTaskId === task.id ? null : task.id;
  renderHistory();
  if (!isTerminalStatus(statusText(task.response))) scheduleTaskPoll(task.id, 300);
}

function renderTaskEmpty(title = '尚无生成结果', message = '提交后，队列状态、运行日志和输出文件会在这里自动更新。', symbol = '◇') {
  refs.resultView.innerHTML = `<div class="result-empty"><div class="result-symbol" aria-hidden="true">${escapeHtml(symbol)}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p></div>`;
  refs.responseJson.textContent = '{}';
}

function findHistoryPosterUrl(value, path = '', seen = new Set()) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    if (seen.has(value)) return null;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        const found = findHistoryPosterUrl(item, `${path}[${index}]`, seen);
        if (found) return found;
      }
    } else {
      for (const [key, item] of Object.entries(value)) {
        const found = findHistoryPosterUrl(item, path ? `${path}.${key}` : key, seen);
        if (found) return found;
      }
    }
    return null;
  }
  if (typeof value !== 'string' || !/^(?:https?:\/\/|data:image\/)/i.test(value)) return null;
  const keys = path.replace(/\[\d+\]/g, '').split('.').filter(Boolean);
  const posterKey = /^(?:thumbnail|thumb|poster|cover(?:_image)?|preview_image|first_frame|screenshot)(?:_url)?$/i;
  return keys.some((key) => posterKey.test(key)) ? value : null;
}

function historyVideoFrameUrl(value) {
  if (/^data:/i.test(value)) return value;
  try {
    const url = new URL(value);
    url.hash = 't=0.05';
    return url.href;
  } catch {
    return value;
  }
}

function historyPreviewMarkup(item) {
  const assets = findAssets(item.response);
  const video = assets.find((asset) => asset.kind === 'video');
  if (video) {
    const poster = findHistoryPosterUrl(item.response);
    return `<span class="history-video-preview" data-history-video-preview><video src="${escapeHtml(historyVideoFrameUrl(video.url))}" muted playsinline preload="metadata" aria-hidden="true"></video>${poster ? `<img class="history-video-poster" src="${escapeHtml(poster)}" alt="" loading="lazy">` : ''}<span class="history-video-fallback">VIDEO</span><span class="history-video-play" aria-hidden="true">▶</span></span>`;
  }
  const image = assets.find((asset) => asset.kind === 'image');
  if (image) return `<img src="${escapeHtml(image.url)}" alt="" loading="lazy">`;
  const asset = assets[0];
  return `<span>${asset ? asset.kind.toUpperCase() : 'RUN'}</span>`;
}

function bindHistoryVideoPreviews() {
  refs.historyView.querySelectorAll('[data-history-video-preview]').forEach((preview) => {
    const video = preview.querySelector('video');
    const poster = preview.querySelector('.history-video-poster');
    const reveal = () => preview.classList.add('ready');
    const fail = () => preview.classList.add('failed');

    if (poster) {
      poster.addEventListener('load', reveal, { once: true });
      poster.addEventListener('error', () => poster.remove(), { once: true });
      if (poster.complete && poster.naturalWidth > 0) reveal();
    }
    if (!video) return;
    video.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(video.duration) && video.duration > 0 && video.currentTime < 0.01) {
        try {
          video.currentTime = Math.min(0.05, video.duration / 2);
        } catch {
          // The media fragment still requests a frame when direct seeking is unavailable.
        }
      }
    }, { once: true });
    video.addEventListener('loadeddata', reveal, { once: true });
    video.addEventListener('error', fail, { once: true });
    if (video.readyState >= 2) reveal();
  });
}

function renderHistory() {
  refs.historyCount.textContent = String(state.history.length);
  if (!state.history.length) {
    refs.historyView.innerHTML = '<div class="catalog-loading">本地任务历史为空。</div>';
    return;
  }
  refs.historyView.innerHTML = state.history.map((item) => {
    const status = statusText(item.response);
    const preview = historyPreviewMarkup(item);
    const active = item.id === state.activeTaskId;
    const expanded = item.id === state.historyExpandedTaskId;
    return `<article class="history-entry ${active ? 'active' : ''}" data-history-entry="${escapeHtml(item.id)}"><div class="history-row"><button class="history-item-main" type="button" data-history-id="${escapeHtml(item.id)}" aria-expanded="${expanded ? 'true' : 'false'}"><span class="history-preview">${preview}</span><span class="history-body"><span class="history-item-top"><strong>${escapeHtml(item.modelTitle || item.endpointId)}</strong><span class="history-status ${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span></span><code>${escapeHtml(requestIdFrom(item.response) || item.endpointId)}</code><time>${escapeHtml(formatTaskTime(item.createdAt))}</time></span></button><button class="history-delete-button" type="button" data-delete-history-task="${escapeHtml(item.id)}" title="删除任务" aria-label="删除任务">×</button></div>${expanded ? `<div class="history-expanded"><button class="history-detail-close" type="button" data-close-history-detail="${escapeHtml(item.id)}" title="关闭详情" aria-label="关闭详情">×</button>${taskDetailMarkup(item, 'history')}</div>` : ''}</article>`;
  }).join('');
  bindHistoryVideoPreviews();
  refs.historyView.querySelectorAll('[data-history-id]').forEach((button) => button.addEventListener('click', () => selectHistoryTask(button.dataset.historyId)));
  refs.historyView.querySelectorAll('[data-close-history-detail]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (state.historyExpandedTaskId === button.dataset.closeHistoryDetail) state.historyExpandedTaskId = null;
    renderHistory();
  }));
  refs.historyView.querySelectorAll('[data-delete-history-task]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    requestDeleteTask(button.dataset.deleteHistoryTask);
  }));
  bindTaskActions(refs.historyView);
}

function taskHasManagedArchive(task) {
  return Array.isArray(task?.response?.local_archive?.files) && task.response.local_archive.files.length > 0;
}

function requestDeleteTask(taskId) {
  const task = state.history.find((item) => item.id === taskId);
  if (!task) return;
  const preference = loadDeletePreference();
  const hasManagedArchive = taskHasManagedArchive(task);
  if (preference.skipConfirmation) {
    performDeleteTask(taskId, preference.deleteSavedFiles && hasManagedArchive);
    return;
  }
  state.pendingDeleteTaskId = taskId;
  refs.deleteTaskName.textContent = task.modelTitle || task.endpointId;
  refs.deleteSavedFiles.disabled = !hasManagedArchive;
  refs.deleteSavedFiles.checked = hasManagedArchive && preference.deleteSavedFiles;
  refs.deleteSavedFilesLabel.classList.toggle('disabled', !hasManagedArchive);
  refs.deleteSavedFilesHint.textContent = hasManagedArchive
    ? `该任务有 ${task.response.local_archive.files.length} 个 images 自动归档文件可删除；另存为文件不会受影响。`
    : '该任务没有可管理的 images 自动归档文件；另存为文件始终不会被删除。';
  refs.deleteDontAsk.checked = false;
  refs.deleteDialog.showModal();
}

async function confirmDeleteTask() {
  const taskId = state.pendingDeleteTaskId;
  if (!taskId) return;
  const deleteSavedFiles = refs.deleteSavedFiles.checked && !refs.deleteSavedFiles.disabled;
  if (refs.deleteDontAsk.checked) saveDeletePreference({ skipConfirmation: true, deleteSavedFiles });
  refs.deleteDialog.close();
  await performDeleteTask(taskId, deleteSavedFiles);
}

async function performDeleteTask(taskId, deleteSavedFiles) {
  let archiveDeleteError = null;
  let removedArchiveFiles = 0;
  if (deleteSavedFiles) {
    try {
      const payload = await api('/api/task/archive/delete', {
        method: 'POST',
        body: JSON.stringify({ taskId })
      });
      removedArchiveFiles = Number(payload.removed || 0);
    } catch (error) {
      archiveDeleteError = error;
    }
  }
  if (archiveDeleteError) {
    toast(`images 归档删除失败，任务记录已保留：${archiveDeleteError.message}`, 'error');
    return;
  }
  clearTaskPoll(taskId);
  if (state.dismissedResultTaskId === taskId) setDismissedResultTaskId(null);
  state.multiTaskIds.delete(taskId);
  state.history = state.history.filter((item) => item.id !== taskId);
  if (state.historyExpandedTaskId === taskId) state.historyExpandedTaskId = null;
  if (state.activeTaskId === taskId) state.activeTaskId = null;
  saveHistory();
  renderHistory();
  const next = currentTask();
  if (next) {
    state.result = next.response;
    refs.responseJson.textContent = JSON.stringify(next.response, null, 2);
    renderResult(next);
  } else {
    state.result = null;
    renderTaskEmpty(state.multiTaskMode ? '多个任务生成中' : '暂无任务生成', state.multiTaskMode ? '各任务状态和输出分别保留在历史中。' : '提交新任务后，运行状态会显示在这里。', state.multiTaskMode ? '▦' : '◇');
  }
  settleMultiTaskPresentation();
  const archiveMessage = deleteSavedFiles ? `，并删除 ${removedArchiveFiles} 个 images 自动归档文件` : '';
  toast(`任务记录已删除${archiveMessage}；另存为文件未作任何处理。`);
}

function showResultTab(tab) {
  refs.resultTabs.forEach((button) => button.classList.toggle('active', button.dataset.resultTab === tab));
  refs.resultView.classList.toggle('hidden', tab !== 'result');
  refs.responseJson.classList.toggle('hidden', tab !== 'json');
  refs.historyView.classList.toggle('hidden', tab !== 'history');
}

function openAuth() {
  refs.keyInput.value = '';
  refs.authError.classList.add('hidden');
  refs.disconnect.classList.toggle('hidden', !state.health?.hasKey || state.health?.keySource === 'environment');
  refs.authDialog.showModal();
  window.setTimeout(() => refs.keyInput.focus(), 50);
}

async function connectKey() {
  const key = refs.keyInput.value.trim();
  if (!key) {
    refs.authError.textContent = '请输入 FAL_KEY。';
    refs.authError.classList.remove('hidden');
    return;
  }
  setButtonBusy(refs.saveKey, true, '验证中');
  refs.authError.classList.add('hidden');
  try {
    await api('/api/auth', { method: 'POST', body: JSON.stringify({ key }) });
    refs.keyInput.value = '';
    refs.authDialog.close();
    await loadHealth();
    await refreshBalance();
    await loadModels();
    resumePendingTasks();
    toast('fal.ai 已连接，密钥已保存到本机，服务重启后会自动恢复。');
  } catch (error) {
    refs.authError.textContent = error.message;
    refs.authError.classList.remove('hidden');
  } finally {
    setButtonBusy(refs.saveKey, false, '');
  }
}

async function disconnectKey() {
  try {
    await api('/api/auth', { method: 'POST', body: JSON.stringify({ key: '' }) });
    refs.authDialog.close();
    await loadHealth();
    await loadModels();
    toast('已断开 fal.ai，并删除本机保存的 API Key。');
  } catch (error) {
    toast(error.message, 'error');
  }
}

function setProxyStatus(message, type = 'info') {
  refs.proxyStatus.textContent = message;
  refs.proxyStatus.className = `proxy-status ${type}`;
}

function syncProxyAuthFields() {
  const enabled = refs.proxyAuthEnabled.checked;
  refs.proxyUsername.disabled = !enabled;
  refs.proxyPassword.disabled = !enabled;
}

function populateProxyForm(proxy) {
  refs.proxyEnabled.checked = Boolean(proxy.enabled);
  refs.proxyProtocolInputs.forEach((input) => { input.checked = input.value === proxy.protocol; });
  refs.proxyHost.value = proxy.host || '127.0.0.1';
  refs.proxyPort.value = proxy.port || 10808;
  refs.proxyAuthEnabled.checked = Boolean(proxy.authEnabled);
  refs.proxyUsername.value = proxy.username || '';
  refs.proxyPassword.value = '';
  refs.proxyPassword.placeholder = proxy.hasPassword ? '已保存，留空保持不变' : '代理密码';
  syncProxyAuthFields();
  refs.proxyStatus.classList.add('hidden');
}

async function openProxySettings() {
  setButtonBusy(refs.proxySettingsButton, true, '读取中');
  try {
    const payload = await api('/api/proxy');
    populateProxyForm(payload.proxy);
    refs.authDialog.close();
    refs.proxyDialog.showModal();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    setButtonBusy(refs.proxySettingsButton, false, '');
  }
}

function proxyFormPayload() {
  return {
    enabled: refs.proxyEnabled.checked,
    protocol: refs.proxyProtocolInputs.find((input) => input.checked)?.value || 'http',
    host: refs.proxyHost.value.trim(),
    port: Number(refs.proxyPort.value),
    authEnabled: refs.proxyAuthEnabled.checked,
    username: refs.proxyUsername.value,
    password: refs.proxyPassword.value
  };
}

async function saveProxySettings() {
  setButtonBusy(refs.saveProxy, true, '保存中');
  refs.proxyStatus.classList.add('hidden');
  try {
    const payload = await api('/api/proxy', { method: 'POST', body: JSON.stringify(proxyFormPayload()) });
    populateProxyForm(payload.proxy);
    setProxyStatus(payload.proxy.enabled ? '代理设置已保存并启用。' : '代理设置已保存，当前处于关闭状态。', 'success');
    toast('代理设置已保存。');
  } catch (error) {
    setProxyStatus(error.message, 'error');
  } finally {
    setButtonBusy(refs.saveProxy, false, '');
  }
}

async function resetProxySettings() {
  if (!window.confirm('确定重置代理设置吗？保存的地址、端口和认证信息都会删除。')) return;
  setButtonBusy(refs.resetProxy, true, '重置中');
  try {
    const payload = await api('/api/proxy/reset', { method: 'POST', body: '{}' });
    populateProxyForm(payload.proxy);
    setProxyStatus('代理设置已恢复默认值并关闭。', 'success');
    toast('代理设置已重置。');
  } catch (error) {
    setProxyStatus(error.message, 'error');
  } finally {
    setButtonBusy(refs.resetProxy, false, '');
  }
}

async function testProxyConnection() {
  setButtonBusy(refs.testProxy, true, '测试中');
  refs.proxyStatus.classList.add('hidden');
  try {
    const payload = await api('/api/proxy/test', { method: 'POST', body: JSON.stringify({ url: refs.proxyTestUrl.value.trim(), settings: proxyFormPayload() }) });
    const connectionLabel = payload.viaProxy ? '代理连接' : '直接连接';
    setProxyStatus(`${connectionLabel}成功：HTTP ${payload.statusCode}，${payload.durationMs} ms。`, 'success');
  } catch (error) {
    setProxyStatus(`连接测试失败：${error.message}`, 'error');
  } finally {
    setButtonBusy(refs.testProxy, false, '');
  }
}

function bindEvents() {
  refs.search.addEventListener('input', debounce(() => {
    state.query = refs.search.value.trim();
    state.cursor = null;
    loadModels();
  }, 350));
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      refs.search.focus();
    }
  });
  refs.refresh.addEventListener('click', () => loadModels());
  refs.preferredModelButton.addEventListener('click', openPreferredModelSettings);
  refs.preferredModelSearch.addEventListener('input', debounce(searchPreferredModels, 300));
  refs.preferredModelSearch.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') event.preventDefault();
  });
  refs.savePreferredModel.addEventListener('click', savePreferredModelSelection);
  refs.resetPreferredModel.addEventListener('click', resetPreferredModelSelection);
  refs.notificationEnabled.addEventListener('change', toggleNotifications);
  refs.loadMore.addEventListener('click', () => loadModels({ append: true }));
  const scrollCategories = (direction) => refs.categoryFilter.scrollBy({ left: direction * Math.max(160, refs.categoryFilter.clientWidth * 0.72), behavior: 'smooth' });
  refs.categoryScrollLeft.addEventListener('click', () => scrollCategories(-1));
  refs.categoryScrollRight.addEventListener('click', () => scrollCategories(1));
  refs.categoryFilter.addEventListener('wheel', (event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    refs.categoryFilter.scrollLeft += event.deltaY;
  }, { passive: false });
  refs.categoryFilter.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => {
    refs.categoryFilter.querySelectorAll('[data-category]').forEach((item) => item.classList.toggle('active', item === button));
    state.category = button.dataset.category;
    state.cursor = null;
    loadModels();
  }));
  refs.connect.addEventListener('click', openAuth);
  refs.toggleKey.addEventListener('click', () => { refs.keyInput.type = refs.keyInput.type === 'password' ? 'text' : 'password'; });
  refs.saveKey.addEventListener('click', connectKey);
  refs.disconnect.addEventListener('click', disconnectKey);
  refs.proxySettingsButton.addEventListener('click', openProxySettings);
  refs.proxyAuthEnabled.addEventListener('change', syncProxyAuthFields);
  refs.saveProxy.addEventListener('click', saveProxySettings);
  refs.resetProxy.addEventListener('click', resetProxySettings);
  refs.testProxy.addEventListener('click', testProxyConnection);
  refs.keyInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); connectKey(); } });
  refs.copyEndpoint.addEventListener('click', () => state.selectedModel && copyText(state.selectedModel.endpoint_id, 'Endpoint ID 已复制。'));
  refs.visualTab.addEventListener('click', () => { try { setMode('visual'); } catch (error) { toast(error.message, 'error'); } });
  refs.jsonTab.addEventListener('click', () => setMode('json'));
  refs.jsonEditor.addEventListener('input', saveCurrentModelDraft);
  refs.reloadSchema.addEventListener('click', loadSchema);
  refs.clearInputs.addEventListener('click', requestClearInputs);
  refs.confirmClearInputs.addEventListener('click', confirmClearInputs);
  refs.inspectRequest.addEventListener('click', openRequestPreview);
  refs.copyRequest.addEventListener('click', () => copyText(refs.requestPreview.textContent, '请求 JSON 已复制。'));
  refs.runButton.addEventListener('click', () => submitRun(false));
  refs.queueButton.addEventListener('click', () => submitRun(true));
  refs.resultTabs.forEach((button) => button.addEventListener('click', () => showResultTab(button.dataset.resultTab)));
  refs.confirmDeleteTask.addEventListener('click', confirmDeleteTask);
  refs.imageLightboxClose.addEventListener('click', closeImageLightbox);
  refs.imageLightbox.addEventListener('click', (event) => {
    if (event.target === refs.imageLightbox) closeImageLightbox();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !refs.imageLightbox.classList.contains('hidden')) closeImageLightbox();
  });
  refs.clearHistory.addEventListener('click', () => {
    if (state.history.length && !window.confirm('清除全部本地任务记录？正在运行的云端任务不会被取消。')) return;
    state.pollTimers.forEach((timer) => window.clearTimeout(timer));
    state.pollTimers.clear();
    state.history = [];
    setDismissedResultTaskId(null);
    state.activeTaskId = null;
    state.result = null;
    state.multiTaskMode = false;
    state.multiTaskIds.clear();
    saveHistory();
    renderHistory();
    renderTaskEmpty();
    toast('本地任务历史已清除。');
  });
}

async function init() {
  bindEvents();
  renderNotificationControl();
  renderHistory();
  refs.responseJson.textContent = '{}';
  if (state.activeTaskId) showTask(state.history.find((task) => task.id === state.activeTaskId), { switchTab: false });
  else renderTaskEmpty(state.dismissedResultTaskId ? '暂无任务生成' : '尚无生成结果');
  await loadHealth();
  if (state.health?.hasKey) await refreshBalance();
  resumePendingTasks();
  await loadModels();
}

init();
