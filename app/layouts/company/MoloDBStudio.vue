<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useLogger } from '~~/app/composables/useLogger'

const { addLog } = useLogger('MoloDB')
const admin = typeof useMoloDbAdmin === 'function' ? useMoloDbAdmin() : null

const booting = ref(true)
const fatal = ref('')
const dbs = ref([])
const eps = ref([])
const mods = ref([])
const canManage = ref(false)
const view = ref('collection')
const tab = ref('data')
const openDbs = reactive({})
const sel = reactive({ db: '', col: '' })
const syncing = ref(false)

const notice = reactive({
  show: false,
  title: '',
  text: '',
  type: 'notice'
})

const TYPES = [
  { v: 'string', t: 'Строка' },
  { v: 'text', t: 'Длинный текст' },
  { v: 'number', t: 'Число' },
  { v: 'boolean', t: 'Да / нет' },
  { v: 'date', t: 'Дата и время' },
  { v: 'select', t: 'Выбор из списка' },
  { v: 'json', t: 'JSON' }
]
const TYPE_TITLE = Object.fromEntries(TYPES.map((t) => [t.v, t.t]))
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const ACCESS = [
  { v: 'members', t: 'Участники предприятия (MoloFlow)' },
  { v: 'key', t: 'По секретному ключу (вебхуки)' },
  { v: 'public', t: 'Открытый (публичный доступ)' }
]

const msg = (e) => e?.message || e?.data?.message || 'Что-то пошло не так'

function notify(text, type = 'success', title = 'MoloDB') {
  notice.title = title
  notice.text = text
  notice.type = type === 'ok' ? 'success' : type === 'err' ? 'error' : type
  notice.show = true
}

async function guard(fn) {
  try {
    return await fn()
  } catch (e) {
    addLog('error', `Ошибка операции: ${msg(e)}`)
    notify(msg(e), 'error', 'Ошибка')
    return undefined
  }
}

const activeDb = computed(() => (dbs.value || []).find((d) => d.name === sel.db) || null)
const activeCol = computed(() => (activeDb.value?.collections || []).find((c) => c.name === sel.col) || null)
const colTitle = (c) => c?.title || c?.name || ''
const isReadOnlyCollection = computed(() => !!activeCol.value?.readOnly)

async function syncData() {
  syncing.value = true
  addLog('info', 'Запуск синхронизации данных предприятия с MoloDB...')
  try {
    const res = await admin.syncEnterpriseData()
    addLog('success', res.message || 'Синхронизация завершена')
    notify(res.message || 'Данные синхронизированы с MoloDB', 'success')
    await loadAll()
    sel.db = 'company'
    sel.col = 'profile'
    openDbs.company = true
    await loadRows()
  } catch (e) {
    addLog('error', `Ошибка синхронизации: ${msg(e)}`)
    notify(msg(e), 'error', 'Синхронизация')
  } finally {
    syncing.value = false
  }
}

async function loadAll() {
  addLog('info', 'Загрузка баз данных предприятия...')
  const r = await admin.list()

  dbs.value = (r.databases || []).map((db) => ({
    ...db,
    collections: (db.collections || []).map((col) => ({
      ...col,
      fields: Array.isArray(col.fields) ? col.fields : []
    }))
  }))

  addLog('success', `Загружено баз данных: ${dbs.value.length}`)
  if (!activeDb.value || (sel.col && !activeCol.value)) pickDefault()
}

function pickDefault() {
  const db = (dbs.value || []).find((d) => d.collections && d.collections.length) || dbs.value[0]
  sel.db = db?.name || ''
  sel.col = db?.collections?.[0]?.name || ''
  if (db) openDbs[db.name] = true
  if (sel.db) addLog('info', `Выбрана активная БД: [${sel.db} / ${sel.col || 'нет коллекций'}]`)
}

async function loadEndpoints() {
  try {
    const list = await admin.endpoints.list()
    eps.value = Array.isArray(list) ? list : []
    canManage.value = true
    addLog('info', `Загружено HTTP-эндпоинтов: ${eps.value.length}`)
  } catch (e) {
    eps.value = []
    addLog('warning', `Ограничение прав на эндпоинты: ${msg(e)}`)
    canManage.value = false
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKey)

  if (!admin) {
    addLog('error', 'useMoloDbAdmin не найден в контексте!')
    fatal.value = 'Не подключён useMoloDbAdmin: проверьте плагин moduleComposables.client.ts.'
    booting.value = false
    return
  }

  try {
    await loadAll()
    await loadEndpoints()
  } catch (e) {
    addLog('error', `Ошибка запуска MoloDB Studio: ${msg(e)}`)
    fatal.value = msg(e)
  } finally {
    booting.value = false
  }
})

onUnmounted(() => window.removeEventListener('keydown', onKey))

function pick(db, col) {
  view.value = 'collection'
  if (db.name === 'company' && col.name === 'modules') tab.value = 'data'
  sel.db = db.name
  sel.col = col.name
  addLog('info', `Открыта коллекция: [${db.name} -> ${col.name}]`)
}

function showEndpoints() {
  view.value = 'endpoints'
}

const PAGE = 25
const rows = ref([])
const total = ref(0)
const skip = ref(0)
const search = ref('')
const sortKey = ref('-createdAt')
const rowsLoading = ref(false)
const rowsError = ref('')
let searchTimer = null

async function loadRows() {
  if (!activeCol.value) {
    rows.value = []
    total.value = 0
    return
  }

  rowsLoading.value = true
  rowsError.value = ''

  try {
    const r = await admin.data(sel.db, sel.col, {
      op: 'find',
      limit: PAGE,
      skip: skip.value,
      search: search.value || undefined,
      sort: sortKey.value
    })

    rows.value = r.items || []
    total.value = r.total ?? 0
  } catch (e) {
    addLog('error', `Ошибка выборки записей [${sel.db}/${sel.col}]: ${msg(e)}`)
    rowsError.value = msg(e)
    rows.value = []
  } finally {
    rowsLoading.value = false
  }
}

watch(
    () => [sel.db, sel.col],
    () => {
      skip.value = 0
      search.value = ''
      sortKey.value = '-createdAt'
      confirmDrop.value = ''
      resetDraft()
      loadRows()
    }
)

watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    skip.value = 0
    loadRows()
  }, 300)
})

const activeColFields = computed(() => (
    activeCol.value && Array.isArray(activeCol.value.fields) ? activeCol.value.fields : []
))
const shownFields = computed(() => activeColFields.value.slice(0, 8))
const pageFrom = computed(() => (total.value ? skip.value + 1 : 0))
const pageTo = computed(() => Math.min(skip.value + PAGE, total.value))

function go(delta) {
  const next = skip.value + delta * PAGE
  if (next < 0 || next >= total.value) return
  skip.value = next
  loadRows()
}

function sortBy(key) {
  sortKey.value = sortKey.value === key
      ? '-' + key
      : sortKey.value === '-' + key
          ? key
          : '-' + key
  skip.value = 0
  loadRows()
}

const sortDir = (key) => (
    sortKey.value === key ? 'asc' : sortKey.value === '-' + key ? 'desc' : ''
)

const pad = (n) => String(n).padStart(2, '0')
const toLocalInput = (v) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime())
      ? ''
      : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fmtDate = (v) => (
    v ? new Date(v).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—'
)

function fmtCell(f, v) {
  if (v === undefined || v === null || v === '') return '—'
  if (f.type === 'boolean') return v ? '✓' : '✕'
  if (f.type === 'date') return fmtDate(v)
  if (f.type === 'json') return JSON.stringify(v)
  if (f.type === 'number') return Number(v).toLocaleString('ru-RU')
  return String(v)
}

const rec = reactive({
  open: false,
  id: '',
  values: {},
  error: '',
  saving: false,
  confirmDelete: false
})

function openRecord(row) {
  const values = {}
  const fields = activeColFields.value

  for (const f of fields) {
    const v = row ? row[f.name] : undefined

    if (f.type === 'boolean') {
      values[f.name] = v === undefined || v === null
          ? !!f.default && f.default !== 'false'
          : !!v
    } else if (f.type === 'date') {
      values[f.name] = v ? toLocalInput(v) : ''
    } else if (f.type === 'json') {
      values[f.name] = v === undefined || v === null ? '' : JSON.stringify(v, null, 2)
    } else {
      values[f.name] = v === undefined || v === null
          ? (row || f.default === undefined || f.default === 'now' ? '' : String(f.default))
          : v
    }
  }

  Object.assign(rec, {
    open: true,
    id: row?._id || '',
    values,
    error: '',
    saving: false,
    confirmDelete: false
  })
}

function recordPayload() {
  const doc = {}
  const editing = !!rec.id

  for (const f of activeColFields.value) {
    const v = rec.values[f.name]
    const empty = v === '' || v === undefined || v === null

    if (f.type === 'boolean') {
      doc[f.name] = !!v
    } else if (empty) {
      if (editing) doc[f.name] = null
    } else if (f.type === 'number') {
      doc[f.name] = Number(v)
    } else if (f.type === 'date') {
      doc[f.name] = new Date(v).toISOString()
    } else if (f.type === 'json') {
      try {
        doc[f.name] = JSON.parse(v)
      } catch {
        throw new Error(`Поле «${f.label || f.name}»: некорректный JSON`)
      }
    } else {
      doc[f.name] = v
    }
  }

  return doc
}

async function saveRecord() {
  rec.error = ''
  rec.saving = true

  try {
    const doc = recordPayload()

    if (rec.id) {
      await admin.data(sel.db, sel.col, { op: 'update', id: rec.id, patch: doc })
      addLog('success', `Запись [${rec.id}] обновлена`)
    } else {
      await admin.data(sel.db, sel.col, { op: 'insert', doc })
      addLog('success', `Добавлена новая запись в [${sel.col}]`)
    }

    rec.open = false
    notify(rec.id ? 'Запись сохранена' : 'Запись добавлена', 'success')
    await loadRows()
  } catch (e) {
    addLog('error', `Ошибка записи: ${msg(e)}`)
    rec.error = msg(e)
  } finally {
    rec.saving = false
  }
}

async function deleteRecord() {
  await guard(async () => {
    await admin.data(sel.db, sel.col, { op: 'delete', id: rec.id })
    addLog('warning', `Запись [${rec.id}] удалена`)
    rec.open = false
    notify('Запись удалена', 'warning')
    await loadRows()
  })
}

const draft = ref(null)
const dbDraft = reactive({ title: '', description: '' })
const confirmDrop = ref('')
const saving = ref(false)

const split = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean)
const dflt = (f) => (
    f.default === undefined || f.default === null
        ? ''
        : typeof f.default === 'object'
            ? JSON.stringify(f.default)
            : String(f.default)
)

function toDraft(c) {
  return {
    title: c.title || '',
    strict: c.strict !== false,
    ttlDays: c.ttlDays ?? '',
    maxDocs: c.maxDocs ?? '',
    readRoles: (c.access?.read || []).join(', '),
    writeRoles: (c.access?.write || []).join(', '),
    fields: (c.fields || []).map((f) => ({
      name: f.name,
      label: f.label || '',
      type: f.type,
      required: !!f.required,
      unique: !!f.unique,
      default: dflt(f),
      options: (f.options || []).join(', '),
      min: f.min ?? '',
      max: f.max ?? '',
      maxLength: f.maxLength ?? '',
      saved: true
    }))
  }
}

function parseDefault(f) {
  const v = f.default
  if (v === '' || v === undefined) return undefined
  if (f.type === 'number') return Number(v)
  if (f.type === 'boolean') return v === 'true'

  if (f.type === 'json') {
    try {
      return JSON.parse(v)
    } catch {
      throw new Error(`Поле «${f.name}»: значение по умолчанию — не JSON`)
    }
  }

  return v
}

function fromDraft(d, name) {
  const num = (v) => (
      v === '' || v === null || v === undefined ? undefined : Number(v)
  )

  return {
    name,
    title: d.title,
    strict: d.strict,
    ttlDays: num(d.ttlDays),
    maxDocs: num(d.maxDocs),
    access: {
      read: split(d.readRoles),
      write: split(d.writeRoles)
    },
    fields: (d.fields || []).map((f) => ({
      name: f.name.trim(),
      label: f.label.trim(),
      type: f.type,
      required: f.required,
      unique: f.unique,
      default: parseDefault(f),
      options: f.type === 'select' ? split(f.options) : undefined,
      min: f.type === 'number' ? num(f.min) : undefined,
      max: f.type === 'number' ? num(f.max) : undefined,
      maxLength: f.type === 'string' || f.type === 'text' ? num(f.maxLength) : undefined
    }))
  }
}

function resetDraft() {
  draft.value = activeCol.value ? toDraft(activeCol.value) : null
  dbDraft.title = activeDb.value?.title || ''
  dbDraft.description = activeDb.value?.description || ''
}

watch(activeCol, resetDraft)

const dirty = computed(() => (
    !!draft.value &&
    !!activeCol.value &&
    JSON.stringify(draft.value) !== JSON.stringify(toDraft(activeCol.value))
))

const dbDirty = computed(() => (
    !!activeDb.value &&
    (
        dbDraft.title !== (activeDb.value.title || '') ||
        dbDraft.description !== (activeDb.value.description || '')
    )
))

function addField() {
  if (!draft.value) return

  draft.value.fields.push({
    name: '',
    label: '',
    type: 'string',
    required: false,
    unique: false,
    default: '',
    options: '',
    min: '',
    max: '',
    maxLength: '',
    saved: false
  })
}

function moveField(i, d) {
  if (!draft.value) return

  const a = draft.value.fields
  const j = i + d
  if (j < 0 || j >= a.length) return
      ;[a[i], a[j]] = [a[j], a[i]]
}

const removeField = (i) => draft.value && draft.value.fields.splice(i, 1)

async function pushDb(
    collections,
    title = activeDb.value?.title,
    description = activeDb.value?.description,
    confirmDelete = false
) {
  if (!activeDb.value) return

  addLog('info', `Синхронизация структуры БД [${activeDb.value.name}]...`)
  await admin.updateDb(
      activeDb.value.name,
      { title, description, collections },
      { confirmDelete }
  )
  addLog('success', `Структура БД [${activeDb.value.name}] успешно обновлена`)
  await loadAll()
}

async function saveStructure() {
  saving.value = true

  await guard(async () => {
    const col = fromDraft(draft.value, sel.col)
    await pushDb(activeDb.value.collections.map((c) => (
        c.name === sel.col ? col : c
    )))
    resetDraft()
    notify('Структура сохранена', 'success')
  })

  saving.value = false
}

async function saveDbInfo() {
  await guard(async () => {
    await pushDb(
        activeDb.value.collections,
        dbDraft.title.trim(),
        dbDraft.description.trim()
    )
    notify('Настройки базы сохранены', 'success')
  })
}

async function dropCollection() {
  if (confirmDrop.value !== 'col') {
    confirmDrop.value = 'col'
    return
  }

  await guard(async () => {
    const left = activeDb.value.collections.filter((c) => c.name !== sel.col)
    await pushDb(left, undefined, undefined, true)
    sel.col = left[0]?.name || ''
    confirmDrop.value = ''
    addLog('warning', 'Коллекция удалена')
    notify('Коллекция удалена', 'warning')
  })
}

async function dropDatabase() {
  if (confirmDrop.value !== 'db') {
    confirmDrop.value = 'db'
    return
  }

  await guard(async () => {
    await admin.deleteDb(sel.db)
    confirmDrop.value = ''
    addLog('warning', `База [${sel.db}] полностью удалена`)
    await loadAll()
    pickDefault()
    notify('База удалена', 'warning')
  })
}

const nd = reactive({
  open: false,
  name: '',
  title: '',
  description: '',
  error: '',
  saving: false
})

const nc = reactive({
  open: false,
  name: '',
  title: '',
  error: '',
  saving: false
})

const NAME_RE = /^[a-z][a-z0-9_]{0,23}$/

function openNewDb() {
  Object.assign(nd, {
    open: true,
    name: '',
    title: '',
    description: '',
    error: '',
    saving: false
  })
}

async function createDb() {
  nd.error = ''

  if (!NAME_RE.test(nd.name)) {
    nd.error = 'Имя: строчные латинские буквы, цифры и «_», начинается с буквы, до 24 символов'
    return
  }

  nd.saving = true

  try {
    addLog('info', `Создание базы [${nd.name}]...`)
    await admin.createDb({
      name: nd.name,
      title: nd.title.trim(),
      description: nd.description.trim(),
      collections: []
    })

    nd.open = false
    await loadAll()
    sel.db = nd.name
    sel.col = ''
    openDbs[nd.name] = true
    addLog('success', `База [${nd.name}] создана`)
    notify('База создана. Добавьте первую коллекцию', 'success')
    openNewCol(activeDb.value)
  } catch (e) {
    addLog('error', `Ошибка создания БД: ${msg(e)}`)
    nd.error = msg(e)
  } finally {
    nd.saving = false
  }
}

function openNewCol(db) {
  if (!db) return

  sel.db = db.name
  Object.assign(nc, {
    open: true,
    name: '',
    title: '',
    error: '',
    saving: false
  })
}

async function createCol() {
  nc.error = ''

  if (!NAME_RE.test(nc.name)) {
    nc.error = 'Имя: строчные латинские буквы, цифры и «_», начинается с буквы, до 24 символов'
    return
  }

  nc.saving = true

  try {
    addLog('info', `Создание коллекции [${nc.name}] в [${activeDb.value.name}]...`)
    await pushDb([
      ...(activeDb.value?.collections || []),
      {
        name: nc.name,
        title: nc.title.trim(),
        fields: [],
        strict: true
      }
    ])

    nc.open = false
    view.value = 'collection'
    sel.col = nc.name
    tab.value = 'structure'
    addLog('success', `Коллекция [${nc.name}] создана`)
    notify('Коллекция создана. Добавьте поля', 'success')
  } catch (e) {
    addLog('error', `Ошибка создания коллекции: ${msg(e)}`)
    nc.error = msg(e)
  } finally {
    nc.saving = false
  }
}

/* -------------------------------------------------------------------------- */
/* HTTP ENDPOINTS + MOLO-KEY                                                  */
/* -------------------------------------------------------------------------- */

const ep = reactive({
  open: false,
  _id: '',
  slug: '',
  description: '',
  methods: ['POST'],
  moduleId: '',
  file: '',
  access: 'members',
  enabled: true,
  regenerateKey: false,
  regenerateConnectKey: false,
  files: [],
  error: '',
  saving: false
})

const connectKeyDialog = reactive({
  open: false,
  key: '',
  url: '',
  slug: ''
})
const connectKeyTab = ref('curl')

const connectKeyBusy = ref('')
const modName = (id) => (
    (mods.value || []).find((m) => m._id === id)?.name || 'модуль удалён'
)
const fileTitle = (f) => f.path || f.name

function getEndpointSavePayload(source = ep) {
  return {
    _id: source._id || undefined,
    slug: source.slug,
    description: source.description,
    methods: source.methods,
    moduleId: source.moduleId,
    file: source.file,
    access: source.access,
    enabled: source.enabled,
    regenerateKey: source.regenerateKey === true,
    regenerateConnectKey: source.regenerateConnectKey === true
  }
}

function showConnectKey(result, fallback = {}) {
  const key = result?.connectKey || result?.data?.connectKey || ''
  if (!key) return false

  connectKeyDialog.key = key
  connectKeyDialog.url =
      result?.connectUrl ||
      result?.data?.connectUrl ||
      fallback.connectUrl ||
      ''
  connectKeyDialog.slug = result?.slug || fallback.slug || ''
  connectKeyDialog.open = true

  return true
}

function connectCurl(url, key) {
  return `curl -X GET '${url || 'https://api.moloflow.ru/connect/...'}' \\\n  -H 'X-Molo-Key: ${key}'`
}

function connectFetch(url, key) {
  return `const response = await fetch('${url || 'https://api.moloflow.ru/connect/...'}', {
  method: 'GET',
  headers: {
    'X-Molo-Key': '${key}'
  }
})

if (!response.ok) {
  throw new Error(\`HTTP error \${response.status}\`)
}

const data = await response.json()
console.log(data)`
}

async function copyConnectKey() {
  if (!connectKeyDialog.key) return
  await copy(connectKeyDialog.key)
  notify('Molo-Key скопирован в буфер обмена', 'success')
}

async function copyConnectUrl(e) {
  if (!e?.connectUrl) return
  await copy(e.connectUrl)
  notify('Адрес MoloFlow Connect скопирован', 'success')
}

async function copyConnectCurlForEndpoint(e) {
  if (!e?.connectUrl) {
    notify('Сначала опубликуйте эндпоинт', 'warning')
    return
  }

  if (connectKeyDialog.key && connectKeyDialog.url === e.connectUrl) {
    await copy(connectCurl(e.connectUrl, connectKeyDialog.key))
    return
  }

  await copy(
      `curl -X GET '${e.connectUrl}' \\\n  -H 'X-Molo-Key: ВСТАВЬТЕ_MOLO_KEY'`
  )
  notify('Скопирован cURL-шаблон. Вставьте свой Molo-Key.', 'info')
}

async function openEndpoint(e) {
  if (!mods.value.length) {
    await guard(async () => {
      mods.value = await admin.modules()
    })
  }

  Object.assign(ep, {
    open: true,
    _id: e?._id || '',
    slug: e?.slug || '',
    description: e?.description || '',
    methods: e ? [...(e.methods || [])] : ['POST'],
    moduleId: e?.moduleId || '',
    file: e?.file || '',
    access: e?.access || 'members',
    enabled: e ? e.enabled : true,
    regenerateKey: false,
    regenerateConnectKey: !e || !e.connectKeyConfigured,
    files: [],
    error: '',
    saving: false
  })

  if (ep.moduleId) await loadModuleFiles(e?.file || '')
}

async function loadModuleFiles(keep = '') {
  ep.files = ep.moduleId
      ? (await guard(() => admin.moduleFiles(ep.moduleId))) || []
      : []

  ep.file = ep.files.some((f) => fileTitle(f) === keep) ? keep : ''
}

function toggleMethod(m) {
  const i = ep.methods.indexOf(m)
  if (i >= 0) ep.methods.splice(i, 1)
  else ep.methods.push(m)
}

async function saveEndpoint() {
  ep.error = ''
  ep.saving = true

  try {
    const saved = await admin.endpoints.save(getEndpointSavePayload())
    ep.open = false
    addLog('success', `Эндпоинт "${ep.slug}" сохранён`)

    const keyWasShown = showConnectKey(saved, {
      slug: ep.slug,
      connectUrl: saved?.connectUrl
    })

    await loadEndpoints()

    if (keyWasShown) {
      notify('Эндпоинт сохранён. Новый Molo-Key показан.', 'success')
    } else {
      notify('Эндпоинт сохранён', 'success')
    }
  } catch (e) {
    addLog('error', `Ошибка сохранения эндпоинта: ${msg(e)}`)
    ep.error = msg(e)
  } finally {
    ep.saving = false
  }
}

async function issueConnectKey(e) {
  if (!e?._id) return
  if (connectKeyBusy.value) return

  connectKeyBusy.value = e._id

  try {
    const saved = await admin.endpoints.save({
      _id: e._id,
      slug: e.slug,
      description: e.description || '',
      methods: e.methods || ['GET'],
      moduleId: e.moduleId,
      file: e.file || '',
      access: e.access || 'members',
      enabled: e.enabled !== false,
      regenerateKey: false,
      regenerateConnectKey: true
    })

    const shown = showConnectKey(saved, {
      slug: e.slug,
      connectUrl: saved?.connectUrl || e.connectUrl
    })

    await loadEndpoints()

    if (!shown) {
      notify('Сервер не вернул Molo-Key', 'warning')
    } else {
      addLog('success', `Molo-Key для "${e.slug}" перевыпущен`)
      notify('Новый Molo-Key создан', 'success')
    }
  } catch (error) {
    notify(msg(error), 'error', 'Ошибка выпуска Molo-Key')
  } finally {
    connectKeyBusy.value = ''
  }
}

async function publishEndpoint(e) {
  await guard(async () => {
    const result = await admin.endpoints.publish(e._id)
    addLog('success', `Эндпоинт опубликован: ${result.publicUrl || result.connectUrl || ''}`)
    notify('Эндпоинт опубликован в MoloFlow Connect', 'success')
    await loadEndpoints()
  })
}

async function unpublishEndpoint(e) {
  await guard(async () => {
    await admin.endpoints.unpublish(e._id)
    addLog('warning', `Публикация эндпоинта "${e.slug}" снята`)
    notify('Публичная публикация отключена', 'success')
    await loadEndpoints()
  })
}

async function toggleEndpoint(e) {
  await guard(async () => {
    if (e.connectPublished && e.enabled) {
      await admin.endpoints.unpublish(e._id)
    }

    await admin.endpoints.save({
      ...e,
      regenerateKey: false,
      regenerateConnectKey: false,
      enabled: !e.enabled
    })

    await loadEndpoints()
  })
}

const epDel = ref('')

async function removeEndpoint(e) {
  if (epDel.value !== e._id) {
    epDel.value = e._id
    return
  }

  await guard(async () => {
    await admin.endpoints.remove(e._id)
    epDel.value = ''
    addLog('warning', `Эндпоинт "${e.slug}" удалён`)
    await loadEndpoints()
    notify('Эндпоинт удалён', 'warning')
  })
}

/* -------------------------------------------------------------------------- */
/* CODE SNIPPETS                                                              */
/* -------------------------------------------------------------------------- */

const lang = ref('js')

const sample = (f) => ({
  string: 'текст',
  text: 'длинный текст',
  number: 1,
  boolean: true,
  date: new Date().toISOString(),
  select: f.options?.[0] || '',
  json: {}
})[f.type]

const exampleDoc = computed(() => {
  const fields = activeColFields.value
  const pick = [
    ...fields.filter((f) => f.required),
    ...fields.filter((f) => !f.required)
  ].slice(0, 4)

  return Object.fromEntries(pick.map((f) => [f.name, sample(f)]))
})

const filterField = computed(() => (
    activeColFields.value.find((f) => ['string', 'select', 'number'].includes(f.type))
))

const j = (v) => JSON.stringify(v)
const pyJson = (v) => (
    JSON.stringify(v, null, 2)
        .replace(/\btrue\b/g, 'True')
        .replace(/\bfalse\b/g, 'False')
        .replace(/\bnull\b/g, 'None')
)

const snippet = computed(() => {
  if (!activeCol.value) return ''

  const d = sel.db
  const c = sel.col
  const doc = exampleDoc.value
  const ff = filterField.value
  const flt = ff ? { [ff.name]: sample(ff) } : {}
  const acc = /^[a-z_][a-z0-9_]*$/i.test(c)
      ? `.${c}`
      : `.collection('${c}')`

  if (lang.value === 'js') {
    return `// Vue / JS модуль
const items = useMoloDb('${d}')${acc}

const created = await items.insert(${j(doc)})
const list    = await items.find(${j(flt)}, { sort: '-createdAt', limit: 20 })
const page    = await items.page({}, { search: 'текст', limit: 25, skip: 0 })
await items.update(created._id, ${j(doc)})
await items.update(${j(flt)}, {}, { upsert: true })
await items.delete(created._id)`
  }

  if (lang.value === 'server') {
    return `// Серверный файл модуля
export async function handler(context) {
  const items = db('${d}')${acc}

  const created = await items.insert(${j(doc)})
  const list    = await items.find(${j(flt)}, { sort: '-createdAt', limit: 20 })
  await items.update(created._id, ${j(doc)})

  return { status: 201, body: { created, count: list.length } }
}`
  }

  if (lang.value === 'py') {
    return `# Python-клиент
from moloflow_db import db

items = db("${d}").${/^[a-z_][a-z0-9_]*$/i.test(c) ? c : `collection("${c}")`}

created = items.insert(${pyJson(doc)})
rows = items.find(${pyJson(flt)}, sort="-createdAt", limit=20)
items.update(created["_id"], ${pyJson(doc)})`
  }

  return `POST /api/enterprises/${admin?.enterpriseId() || '<id>'}/moloDb/${d}/${c}
Content-Type: application/json

${JSON.stringify({ op: 'insert', doc }, null, 2)}`
})

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }

  addLog('info', 'Код скопирован в буфер обмена')
  notify('Код скопирован в буфер обмена', 'info')
}

function onKey(e) {
  if (e.key !== 'Escape') return

  if (connectKeyDialog.open) {
    connectKeyDialog.open = false
  } else if (rec.open) {
    rec.open = false
  } else if (nd.open) {
    nd.open = false
  } else if (nc.open) {
    nc.open = false
  } else if (ep.open) {
    ep.open = false
  }
}
</script>

<template>
  <div class="mdb-layout">
    <!-- Центр загрузки / фатальной ошибки -->
    <div v-if="booting" class="mdb-state-center">
      <UIMoloSticker name="refresh" :size="24" class="spin-anim" />
      <span>Инициализация окружения MoloDB…</span>
    </div>

    <div v-else-if="fatal" class="mdb-state-center err">
      <UIMoloSticker name="alert" :size="28" />
      <span>{{ fatal }}</span>
    </div>

    <template v-else>
      <!-- БОКОВАЯ ПАНЕЛЬ -->
      <aside class="mdb-sidebar">
        <header class="sidebar-head">
          <div class="brand">
            <UIMoloSticker name="nomenclature" :size="18" glow />
            <span class="brand-title">MoloDB</span>
          </div>

          <div class="btn-group">
            <UIMoloButton
                v-if="canManage"
                class="small"
                title="Синхронизировать реквизиты предприятия в базу"
                :disabled="syncing"
                @click="syncData"
            >
              <UIMoloSticker name="download" :size="12" :class="{ 'spin-anim': syncing }" />
            </UIMoloButton>

            <UIMoloButton
                v-if="canManage"
                class="small confirm"
                title="Создать базу данных"
                @click="openNewDb"
            >
              <UIMoloSticker name="plus" :size="12" />
            </UIMoloButton>
          </div>
        </header>

        <!-- Дерево баз и коллекций -->
        <nav class="sidebar-tree">
          <div v-for="db in dbs" :key="db.name" class="tree-db-node">
            <button class="db-header-row" @click="openDbs[db.name] = !openDbs[db.name]">
              <UIMoloSticker
                  :name="openDbs[db.name] ? 'down' : 'right'"
                  :size="11"
                  class="chev-icon"
              />
              <UIMoloSticker name="folder" :size="14" />
              <span class="db-title">{{ db.title || db.name }}</span>
              <span class="badge-pill">{{ (db.collections || []).length }}</span>
            </button>

            <ul v-show="openDbs[db.name]" class="cols-tree-branch">
              <li v-for="c in (db.collections || [])" :key="c.name">
                <button
                    class="col-tree-row"
                    :class="{ active: view === 'collection' && sel.db === db.name && sel.col === c.name }"
                    @click="pick(db, c)"
                >
                  <UIMoloSticker name="table" :size="12" />
                  <span class="col-name">{{ colTitle(c) }}</span>
                </button>
              </li>

              <li v-if="canManage">
                <button class="col-tree-row add-col-row" @click="openNewCol(db)">
                  <UIMoloSticker name="plus" :size="11" />
                  <span>Коллекция</span>
                </button>
              </li>
            </ul>
          </div>

          <div v-if="!dbs.length" class="sidebar-empty">
            <span>Баз данных не найдено</span>
          </div>
        </nav>

        <!-- Нижняя панель эндпоинтов -->
        <footer v-if="canManage" class="sidebar-foot">
          <button
              class="endpoint-nav-btn"
              :class="{ active: view === 'endpoints' }"
              @click="showEndpoints"
          >
            <UIMoloSticker name="it" :size="14" />
            <span>HTTP Эндпоинты</span>
            <span class="badge-pill">{{ eps.length }}</span>
          </button>
        </footer>
      </aside>

      <!-- ОСНОВНАЯ ЗОНА -->
      <main class="mdb-viewport">
        <!-- ПУСТОЙ ЭКРАН -->
        <section v-if="view === 'collection' && !activeCol" class="viewport-empty">
          <div class="empty-glass-card">
            <UIMoloSticker name="nomenclature" :size="42" glow />
            <h3>
              {{ activeDb ? 'В выбранной базе ещё нет таблиц' : 'База данных не инициализирована' }}
            </h3>
            <p>
              MoloDB хранит типизированные документы со схемой полей, валидацией и доступом по ролям.
            </p>

            <div v-if="canManage" class="empty-actions">
              <UIMoloButton v-if="!activeDb" class="small confirm" @click="openNewDb">
                <UIMoloSticker name="plus" :size="13" />
                <span>Создать базу</span>
              </UIMoloButton>

              <UIMoloButton v-if="!activeDb" class="small" :disabled="syncing" @click="syncData">
                <UIMoloSticker name="download" :size="13" :class="{ 'spin-anim': syncing }" />
                <span>Импортировать данные</span>
              </UIMoloButton>

              <UIMoloButton v-if="activeDb" class="small confirm" @click="openNewCol(activeDb)">
                <UIMoloSticker name="plus" :size="13" />
                <span>Добавить коллекцию</span>
              </UIMoloButton>
            </div>
          </div>
        </section>

        <!-- ПРОСМОТР КОЛЛЕКЦИИ -->
        <template v-else-if="view === 'collection'">
          <header class="viewport-header">
            <div class="header-breadcrumb">
              <div class="crumbs">
                <span class="db-badge">{{ activeDb?.title || activeDb?.name }}</span>
                <span class="sep">/</span>
                <span class="col-curr">{{ colTitle(activeCol) }}</span>
              </div>
            </div>

            <div class="btn-group">
              <UIMoloButton
                  class="small"
                  :class="{ confirm: tab === 'data' }"
                  @click="tab = 'data'"
              >
                <UIMoloSticker name="table" :size="12" />
                <span>Данные</span>
              </UIMoloButton>

              <UIMoloButton
                  v-if="canManage && !isReadOnlyCollection"
                  class="small"
                  :class="{ confirm: tab === 'structure' }"
                  @click="tab = 'structure'"
              >
                <UIMoloSticker name="pen" :size="12" />
                <span>Структура</span>
              </UIMoloButton>

              <UIMoloButton
                  class="small"
                  :class="{ confirm: tab === 'code' }"
                  @click="tab = 'code'"
              >
                <UIMoloSticker name="dev-json" :size="12" />
                <span>API</span>
              </UIMoloButton>
            </div>
          </header>

          <!-- 1. ДАННЫЕ ТАБЛИЦЫ -->
          <section v-if="tab === 'data'" class="tab-pane data-pane">
            <div class="data-toolbar">
              <div class="search-wrap">
                <UIMoloInput v-model="search" compact placeholder="Быстрый поиск по строкам..." />
              </div>

              <div
                  v-if="isReadOnlyCollection"
                  class="records-counter"
                  title="Редактирование выполняется в редакторе модулей"
              >
                <span>Только просмотр</span>
              </div>

              <div class="records-counter">
                <span class="count-val">{{ total }}</span>
                <span class="count-lbl">{{ total === 1 ? 'запись' : 'записей' }}</span>
              </div>

              <div class="actions-right">
                <UIMoloButton
                    class="small transparent"
                    title="Обновить таблицу"
                    :disabled="rowsLoading"
                    @click="loadRows"
                >
                  <UIMoloSticker name="refresh" :size="12" :class="{ 'spin-anim': rowsLoading }" />
                </UIMoloButton>

                <UIMoloButton
                    v-if="!isReadOnlyCollection"
                    class="small confirm"
                    :disabled="!activeColFields.length"
                    @click="openRecord(null)"
                >
                  <UIMoloSticker name="plus" :size="12" />
                  <span>Добавить запись</span>
                </UIMoloButton>
              </div>
            </div>

            <div v-if="!activeColFields.length" class="empty-banner">
              <span>Схема коллекции не сформирована.</span>
              <button v-if="canManage" class="text-link" @click="tab = 'structure'">
                Добавить поля структуры
              </button>
            </div>

            <div v-if="rowsError" class="error-banner">
              <UIMoloSticker name="alert" :size="14" />
              <span>{{ rowsError }}</span>
            </div>

            <div
                v-if="activeColFields.length"
                class="table-container"
                :class="{ busy: rowsLoading }"
            >
              <table class="molo-data-grid">
                <thead>
                <tr>
                  <th v-for="f in shownFields" :key="f.name">
                    <button
                        v-if="f.type !== 'json'"
                        class="sort-header-btn"
                        @click="sortBy(f.name)"
                    >
                      <span>{{ f.label || f.name }}</span>
                      <UIMoloSticker
                          v-if="sortDir(f.name)"
                          :name="sortDir(f.name) === 'asc' ? 'up' : 'down'"
                          :size="10"
                      />
                    </button>
                    <span v-else class="static-header">{{ f.label || f.name }}</span>
                  </th>

                  <th class="time-header">
                    <button class="sort-header-btn" @click="sortBy('createdAt')">
                      <span>Создано</span>
                      <UIMoloSticker
                          v-if="sortDir('createdAt')"
                          :name="sortDir('createdAt') === 'asc' ? 'up' : 'down'"
                          :size="10"
                      />
                    </button>
                  </th>
                </tr>
                </thead>

                <tbody>
                <tr
                    v-for="r in rows"
                    :key="r._id"
                    class="grid-data-row"
                    @click="!isReadOnlyCollection && openRecord(r)"
                >
                  <td
                      v-for="f in shownFields"
                      :key="f.name"
                      :class="[
                        'cell-' + f.type,
                        {
                          'cell-empty':
                            r[f.name] === undefined ||
                            r[f.name] === null ||
                            r[f.name] === ''
                        }
                      ]"
                  >
                      <span v-if="f.type === 'select' && r[f.name]" class="pill-badge">
                        {{ r[f.name] }}
                      </span>
                    <span v-else>{{ fmtCell(f, r[f.name]) }}</span>
                  </td>

                  <td class="cell-date">{{ fmtDate(r.createdAt) }}</td>
                </tr>

                <tr v-if="!rows.length && !rowsLoading" class="grid-empty-row">
                  <td :colspan="shownFields.length + 1">
                    {{ search ? 'По вашему запросу совпадений не обнаружено' : 'В этой таблице пока нет данных' }}
                  </td>
                </tr>
                </tbody>
              </table>
            </div>

            <footer v-if="total > PAGE" class="pagination-footer">
              <UIMoloButton class="small" :disabled="skip === 0" @click="go(-1)">
                <UIMoloSticker name="left" :size="14" />
                Назад
              </UIMoloButton>

              <span class="pager-info">{{ pageFrom }}–{{ pageTo }} из {{ total }}</span>

              <UIMoloButton class="small" :disabled="skip + PAGE >= total" @click="go(1)">
                Далее
                <UIMoloSticker name="right" :size="14" />
              </UIMoloButton>
            </footer>
          </section>

          <!-- 2. СТРУКТУРА ПОЛЕЙ -->
          <section
              v-else-if="tab === 'structure' && draft && !isReadOnlyCollection"
              class="tab-pane structure-pane"
          >
            <div class="structure-content-scroll">
              <UIMoloSection>
                <template #header>
                  <div class="sec-header-line">
                    <div class="sec-title-wrap">
                      <UIMoloSticker name="table" :size="14" />
                      <strong>Поля коллекции</strong>
                    </div>

                    <UIMoloButton class="small confirm" @click="addField">
                      <UIMoloSticker name="plus" :size="12" />
                      <span>Новое поле</span>
                    </UIMoloButton>
                  </div>
                </template>

                <template #main>
                  <div class="fields-list-stack">
                    <div
                        v-for="(f, i) in (draft.fields || [])"
                        :key="i"
                        class="field-item-card"
                    >
                      <div class="field-row-primary">
                        <div class="input-col name-col">
                          <UIMoloInput
                              v-model="f.name"
                              compact
                              placeholder="system_key"
                              :readonly="f.saved"
                              t-label="Идентификатор"
                          />
                        </div>

                        <div class="input-col label-col">
                          <UIMoloInput
                              v-model="f.label"
                              compact
                              placeholder="Подпись"
                              t-label="Название поля"
                          />
                        </div>

                        <div class="input-col type-col">
                          <UIMoloSelect
                              v-model="f.type"
                              compact
                              :disabled="f.saved"
                              t-label="Тип данных"
                              :parent="TYPES"
                              children="t"
                              value-key="v"
                          />
                        </div>

                        <div class="toggles-col">
                          <UIMoloToggle v-model="f.required" compact label="Обязательное" />
                          <UIMoloToggle
                              v-if="['string', 'number', 'select', 'date'].includes(f.type)"
                              v-model="f.unique"
                              compact
                              label="Уникальное"
                          />
                        </div>

                        <div class="actions-col">
                          <div class="btn-group">
                            <UIMoloButton
                                class="small transparent"
                                title="Переместить выше"
                                @click="moveField(i, -1)"
                            >
                              <UIMoloSticker name="up" :size="10" />
                            </UIMoloButton>

                            <UIMoloButton
                                class="small transparent"
                                title="Переместить ниже"
                                @click="moveField(i, 1)"
                            >
                              <UIMoloSticker name="down" :size="10" />
                            </UIMoloButton>
                          </div>

                          <UIMoloButton
                              class="small close"
                              title="Удалить поле"
                              @click="removeField(i)"
                          >
                            <UIMoloSticker name="trash" :size="10" />
                          </UIMoloButton>
                        </div>
                      </div>

                      <div class="field-row-secondary">
                        <div class="extra-field-item">
                          <UIMoloInput
                              v-model="f.default"
                              compact
                              :placeholder="f.type === 'date' ? 'now' : 'Значение по умолчанию'"
                              t-label="По умолчанию"
                          />
                        </div>

                        <div v-if="f.type === 'select'" class="extra-field-item grow">
                          <UIMoloInput
                              v-model="f.options"
                              compact
                              placeholder="новый, в работе, завершено"
                              t-label="Варианты (через запятую)"
                          />
                        </div>

                        <template v-if="f.type === 'number'">
                          <div class="extra-field-item num">
                            <UIMoloInput v-model="f.min" compact type="number" placeholder="min" t-label="Мин" />
                          </div>
                          <div class="extra-field-item num">
                            <UIMoloInput v-model="f.max" compact type="number" placeholder="max" t-label="Макс" />
                          </div>
                        </template>

                        <div
                            v-if="f.type === 'string' || f.type === 'text'"
                            class="extra-field-item num"
                        >
                          <UIMoloInput
                              v-model="f.maxLength"
                              compact
                              type="number"
                              placeholder="255"
                              t-label="Длина (симв.)"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </UIMoloSection>

              <UIMoloSection>
                <template #header>
                  <div class="sec-title-wrap">
                    <UIMoloSticker name="settings" :size="14" />
                    <strong>Параметры коллекции</strong>
                  </div>
                </template>

                <template #main>
                  <div class="grid-form-two-col">
                    <UIMoloInput v-model="draft.title" compact t-label="Название коллекции" placeholder="Заказы" />
                    <UIMoloInput v-model="draft.maxDocs" compact type="number" t-label="Лимит строк" placeholder="50000" />
                    <UIMoloInput v-model="draft.ttlDays" compact type="number" t-label="Хранение (дней)" placeholder="Бессрочно" />

                    <div class="toggle-wrapper-aligned">
                      <UIMoloToggle
                          v-model="draft.strict"
                          compact
                          label="Строгая схема"
                      />
                    </div>

                    <UIMoloInput v-model="draft.readRoles" compact t-label="Роли чтения" placeholder="все участники" />
                    <UIMoloInput v-model="draft.writeRoles" compact t-label="Роли записи" placeholder="все участники" />
                  </div>
                </template>
              </UIMoloSection>

              <UIMoloSection>
                <template #header>
                  <div class="sec-header-line">
                    <div class="sec-title-wrap">
                      <UIMoloSticker name="folder" :size="14" />
                      <strong>База данных «{{ activeDb?.title || activeDb?.name }}»</strong>
                    </div>

                    <UIMoloButton class="small action" :disabled="!dbDirty" @click="saveDbInfo">
                      Сохранить свойства БД
                    </UIMoloButton>
                  </div>
                </template>

                <template #main>
                  <div class="grid-form-two-col">
                    <UIMoloInput v-model="dbDraft.title" compact t-label="Отображаемое имя базы" />
                    <UIMoloInput v-model="dbDraft.description" compact t-label="Описание" />
                  </div>
                </template>
              </UIMoloSection>

              <UIMoloSection class="danger-section">
                <template #header>
                  <div class="sec-title-wrap text-danger">
                    <UIMoloSticker name="trash" :size="14" />
                    <strong>Опасная зона</strong>
                  </div>
                </template>

                <template #main>
                  <div class="danger-actions-row">
                    <UIMoloButton class="small close" @click="dropCollection">
                      <UIMoloSticker name="trash" :size="11" />
                      <span>{{ confirmDrop === 'col' ? 'Подтвердите удаление коллекции' : 'Удалить коллекцию' }}</span>
                    </UIMoloButton>

                    <UIMoloButton class="small close" @click="dropDatabase">
                      <UIMoloSticker name="trash" :size="11" />
                      <span>{{ confirmDrop === 'db' ? 'Подтвердите удаление всей БД' : 'Удалить базу данных' }}</span>
                    </UIMoloButton>

                    <UIMoloButton v-if="confirmDrop" class="small" @click="confirmDrop = ''">
                      Отмена
                    </UIMoloButton>
                  </div>
                </template>
              </UIMoloSection>
            </div>

            <footer class="floating-savebar" :class="{ visible: dirty }">
              <div class="savebar-text">
                <UIMoloSticker name="alert" :size="14" />
                <span>В структуру внесены изменения</span>
              </div>

              <div class="btn-group">
                <UIMoloButton class="small" @click="resetDraft">Сбросить</UIMoloButton>
                <UIMoloButton class="small confirm" :loading="saving" @click="saveStructure">
                  Применить изменения
                </UIMoloButton>
              </div>
            </footer>
          </section>

          <!-- 3. ПОДКЛЮЧЕНИЕ / СНИППЕТЫ -->
          <section v-else-if="tab === 'code'" class="tab-pane code-pane">
            <div class="code-env-bar">
              <div class="btn-group">
                <UIMoloButton class="small" :class="{ confirm: lang === 'js' }" @click="lang = 'js'">
                  Vue / JS
                </UIMoloButton>
                <UIMoloButton class="small" :class="{ confirm: lang === 'server' }" @click="lang = 'server'">
                  Сервер
                </UIMoloButton>
                <UIMoloButton class="small" :class="{ confirm: lang === 'py' }" @click="lang = 'py'">
                  Python
                </UIMoloButton>
                <UIMoloButton class="small" :class="{ confirm: lang === 'http' }" @click="lang = 'http'">
                  HTTP (cURL)
                </UIMoloButton>
              </div>
            </div>

            <div class="code-viewport-block">
              <UIMoloButton class="small copy-btn" title="Скопировать сниппет" @click="copy(snippet)">
                <UIMoloSticker name="copy" :size="12" />
                <span>Копировать</span>
              </UIMoloButton>

              <pre class="code-pre"><code>{{ snippet }}</code></pre>
            </div>
          </section>
        </template>

        <!-- РАЗДЕЛ HTTP ЭНДПОИНТОВ -->
        <template v-else-if="view === 'endpoints'">
          <header class="viewport-header">
            <div class="header-breadcrumb">
              <span class="col-curr">HTTP Эндпоинты</span>
            </div>

            <UIMoloButton class="small confirm" @click="openEndpoint(null)">
              <UIMoloSticker name="plus" :size="12" />
              <span>Создать эндпоинт</span>
            </UIMoloButton>
          </header>

          <section class="tab-pane endpoints-pane">
            <div v-if="!eps.length" class="empty-banner">
              <span>Эндпоинты не созданы. Подключите скрипт модуля для выполнения внешних запросов.</span>
            </div>

            <div class="endpoints-list-grid">
              <div
                  v-for="e in eps"
                  :key="e._id"
                  class="endpoint-card"
                  :class="{ disabled: !e.enabled }"
              >
                <div class="endpoint-top-line">
                  <section style="display: flex; align-items: center; gap: 10px" >
                    <div class="route-tag">
                      <UIMoloSticker name="link" :size="12" />
                      <code>/api/x/…/{{ e.slug }}</code>
                    </div>

                    <div class="methods-badges">
                    <span
                        v-for="m in e.methods"
                        :key="m"
                        class="method-chip"
                        :class="m.toLowerCase()"
                    >
                      {{ m }}
                    </span>
                    </div>

                    <span class="access-chip">
                    {{ ACCESS.find((a) => a.v === e.access)?.t }}
                  </span>
                  </section>
                  <div class="btn-group">
                    <UIMoloButton
                        class="small"
                        title="Скопировать готовую ссылку для вызова"
                        @click="copy(
                        e.access === 'key' && e.secret
                          ? `${admin.endpointUrl(e.slug)}?key=${e.secret}`
                          : admin.endpointUrl(e.slug)
                      )"
                    >
                      <UIMoloSticker name="copy" :size="11" />
                    </UIMoloButton>

                    <UIMoloButton class="small" title="Параметры" @click="openEndpoint(e)">
                      <UIMoloSticker name="pen" :size="11" />
                    </UIMoloButton>

                    <UIMoloButton class="small close" title="Удалить" @click="removeEndpoint(e)">
                      <UIMoloSticker v-if="epDel !== e._id" name="trash" :size="11" />
                      <span v-else>Да?</span>
                    </UIMoloButton>
                  </div>
                </div>

                <p v-if="e.description" class="endpoint-desc">{{ e.description }}</p>

                <!-- MOLOFLOW CONNECT -->
                <div class="connect-publish-row">
                  <div class="connect-publish-info">
                    <span class="connect-publish-label">
                      <UIMoloSticker name="cloud" :size="12" />
                      MoloFlow Connect
                    </span>

                    <a
                        :href="e.connectUrl"
                        v-if="e.connectPublished && e.connectUrl"
                        class="connect-public-url"
                    >
                      {{ e.connectUrl }}
                    </a>

                    <small v-else>Snapshot-копия GET-ответа в Cloudflare KV</small>

                    <small v-if="e.connectLastError" class="connect-publish-error">
                      {{ e.connectLastError }}
                    </small>
                  </div>

                  <div class="btn-group">
                    <UIMoloButton
                        v-if="e.connectPublished"
                        class="small"
                        title="Скопировать ссылку"
                        @click="copyConnectUrl(e)"
                    >
                      <UIMoloSticker name="copy" :size="11" />
                    </UIMoloButton>

                    <UIMoloButton
                        v-if="e.connectPublished"
                        class="small"
                        title="Обновить snapshot"
                        @click="publishEndpoint(e)"
                    >
                      <UIMoloSticker name="refresh" :size="11" />
                    </UIMoloButton>

                    <UIMoloButton
                        v-if="e.connectPublished"
                        class="small close"
                        title="Снять публикацию"
                        @click="unpublishEndpoint(e)"
                    >
                      <UIMoloSticker name="x" :size="11" />
                    </UIMoloButton>

                    <UIMoloButton
                        v-else
                        class="small confirm"
                        :disabled="!e.enabled || !e.methods?.includes('GET')"
                        title="Опубликовать результат GET-обработчика"
                        @click="publishEndpoint(e)"
                    >
                      <UIMoloSticker name="upload" :size="11" />
                      <span>Опубликовать</span>
                    </UIMoloButton>
                  </div>
                </div>

                <!-- ЗАЩИТА MOLO-KEY -->
                <div v-if="e.connectPublished" class="connect-key-panel">
                  <div class="connect-key-status">
                    <UIMoloSticker
                        :name="e.connectKey ? 'check-circle' : 'alert-circle'"
                        :size="15"
                    />

                    <div class="connect-key-status-text">
                      <strong>
                        {{ e.hasConnectKey ? 'Molo-Key активен' : 'Molo-Key не настроен' }}
                      </strong>

                      <small>
                        {{
                          e.hasConnectKey
                              ? 'Доступ к данным разрешён только с ключом'
                              : 'Эндпоинт не имеет настроенного ключа доступа'
                        }}
                      </small>
                    </div>
                  </div>

                  <div class="btn-group">
                    <UIMoloButton
                        class="small"
                        title="Скопировать cURL-шаблон с заголовком X-Molo-Key"
                        @click="copyConnectCurlForEndpoint(e)"
                    >
                      <UIMoloSticker name="code" :size="11" />
                      <span>cURL</span>
                    </UIMoloButton>

                    <UIMoloButton
                        class="small"
                        :class="{ confirm: !e.connectKeyConfigured }"
                        :loading="connectKeyBusy === e._id"
                        :disabled="!!connectKeyBusy"
                        @click="issueConnectKey(e)"
                    >
                      <UIMoloSticker name="key" :size="11" />
                      <span>
                        {{ e.connectKeyConfigured ? 'Перевыпустить Molo-Key' : 'Выпустить Molo-Key' }}
                      </span>
                    </UIMoloButton>
                  </div>
                </div>

                <hr>

                <div class="endpoint-meta-line">
                  <div class="meta-item">
                    <UIMoloToggle
                        :model-value="e.enabled"
                        compact
                        label="Активен"
                        @change="toggleEndpoint(e)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </template>
      </main>
    </template>

    <!-- МОДАЛКА: РЕДАКТИРОВАНИЕ ЗАПИСИ -->
    <UIMoloModal
        v-model="rec.open"
        :title="rec.id ? 'Редактирование записи' : 'Новая запись'"
        width="660px"
        confirm-text="Сохранить"
        cancel-text="Отмена"
        :loading="rec.saving"
        close-on-overlay
        @confirm="saveRecord"
    >
      <template #body>
        <div class="modal-form-stack">
          <template v-for="f in activeColFields" :key="f.name">
            <UIMoloToggle
                v-if="f.type === 'boolean'"
                v-model="rec.values[f.name]"
                :label="f.label || f.name"
            />

            <UIMoloInput
                v-else-if="f.type === 'date'"
                v-model="rec.values[f.name]"
                type="datetime-local"
                compact
                :t-label="f.label || f.name"
                :l-required="f.required"
            />

            <UIMoloInput
                v-else-if="f.type === 'number'"
                v-model="rec.values[f.name]"
                type="number"
                compact
                :t-label="f.label || f.name"
                :l-required="f.required"
            />

            <UIMoloSelect
                v-else-if="f.type === 'select'"
                v-model="rec.values[f.name]"
                compact
                :t-label="f.label || f.name"
                :l-required="f.required"
                :parent="f.options || []"
                clearable
            />

            <div
                v-else-if="f.type === 'text' || f.type === 'json'"
                class="form-monaco-field"
            >
              <label class="field-label">
                {{ f.label || f.name }}
                <span v-if="f.required" class="required">*</span>
                <small class="type-hint">({{ TYPE_TITLE[f.type] }})</small>
              </label>

              <div class="monaco-wrapper-box">
                <UIMoloMonaco
                    :initial-code="rec.values[f.name] || ''"
                    :language="f.type === 'json' ? 'json' : 'markdown'"
                    @update:code="(val) => (rec.values[f.name] = val)"
                />
              </div>
            </div>

            <UIMoloInput
                v-else
                v-model="rec.values[f.name]"
                compact
                :t-label="f.label || f.name"
                :l-required="f.required"
                :max-length="f.maxLength || 1000"
            />
          </template>

          <div v-if="rec.error" class="error-banner">
            <UIMoloSticker name="alert" :size="14" />
            <span>{{ rec.error }}</span>
          </div>
        </div>
      </template>

      <template #footer>
        <UIMoloButton v-if="rec.id" class="close small" @click="deleteRecord">
          <UIMoloSticker name="trash" :size="12" />
          <span>Удалить запись</span>
        </UIMoloButton>
      </template>
    </UIMoloModal>

    <!-- МОДАЛКА: СОЗДАНИЕ БД -->
    <UIMoloModal
        v-model="nd.open"
        title="Создание базы данных"
        width="460px"
        confirm-text="Создать базу"
        cancel-text="Отмена"
        :loading="nd.saving"
        close-on-overlay
        @confirm="createDb"
    >
      <template #body>
        <div class="modal-form-stack">
          <UIMoloInput
              v-model="nd.name"
              compact
              t-label="Идентификатор базы (латиница)"
              placeholder="analytics"
              l-required
          />
          <UIMoloInput
              v-model="nd.title"
              compact
              t-label="Название"
              placeholder="Аналитика предприятия"
          />
          <UIMoloInput
              v-model="nd.description"
              compact
              t-label="Описание"
              placeholder="Логи и внутренние отчеты"
          />
          <div v-if="nd.error" class="error-banner">
            <UIMoloSticker name="alert" :size="14" />
            <span>{{ nd.error }}</span>
          </div>
        </div>
      </template>
    </UIMoloModal>

    <!-- МОДАЛКА: СОЗДАНИЕ КОЛЛЕКЦИИ -->
    <UIMoloModal
        v-model="nc.open"
        title="Создание коллекции"
        width="460px"
        confirm-text="Создать коллекцию"
        cancel-text="Отмена"
        :loading="nc.saving"
        close-on-overlay
        @confirm="createCol"
    >
      <template #body>
        <div class="modal-form-stack">
          <UIMoloInput
              v-model="nc.name"
              compact
              t-label="Имя таблицы (латиница)"
              placeholder="orders"
              l-required
          />
          <UIMoloInput
              v-model="nc.title"
              compact
              t-label="Отображаемое название"
              placeholder="Заказы клиентов"
          />
          <div v-if="nc.error" class="error-banner">
            <UIMoloSticker name="alert" :size="14" />
            <span>{{ nc.error }}</span>
          </div>
        </div>
      </template>
    </UIMoloModal>

    <!-- МОДАЛКА: НАСТРОЙКА ЭНДПОИНТА -->
    <UIMoloModal
        v-model="ep.open"
        :title="ep._id ? 'Настройка HTTP эндпоинта' : 'Новый HTTP эндпоинт'"
        width="560px"
        confirm-text="Сохранить"
        cancel-text="Отмена"
        :loading="ep.saving"
        close-on-overlay
        @confirm="saveEndpoint"
    >
      <template #body>
        <div class="modal-form-stack">
          <UIMoloSection>
            <template #header>
              <div class="sec-title-wrap">
                <UIMoloSticker name="link" :size="14" />
                <strong>Параметры маршрута</strong>
              </div>
            </template>
            <template #main>
              <UIMoloInput
                  v-model="ep.slug"
                  compact
                  t-label="Маршрут (/api/x/{предприятие}/…)"
                  placeholder="orders/webhook"
                  l-required
              />

              <UIMoloInput
                  v-model="ep.description"
                  compact
                  t-label="Описание"
                  placeholder="Прием внешних заказов"
              />

              <div class="methods-selector-block">
                <span class="field-label">Поддерживаемые HTTP методы</span>
                <div class="methods-row">
                  <UIMoloButton
                      v-for="m in METHODS"
                      :key="m"
                      class="small"
                      :class="{ confirm: ep.methods.includes(m) }"
                      @click="toggleMethod(m)"
                  >
                    {{ m }}
                  </UIMoloButton>
                </div>
              </div>
            </template>
          </UIMoloSection>

          <UIMoloSection>
            <template #header>
              <div class="sec-title-wrap">
                <UIMoloSticker name="code" :size="14" />
                <strong>Исполняемый код</strong>
              </div>
            </template>
            <template #main>
              <UIMoloSelect
                  v-model="ep.moduleId"
                  compact
                  disabled="Выберите модуль"
                  :parent="mods"
                  value-key="_id"
                  children="name"
                  t-label="Модуль обработчика"
                  @change="loadModuleFiles('')"
              />

              <UIMoloSelect
                  v-if="ep.moduleId"
                  v-model="ep.file"
                  compact
                  t-label="Исполняемый файл"
              >
                <option value="">Основной файл модуля</option>
                <option
                    v-for="f in ep.files"
                    :key="fileTitle(f)"
                    :value="fileTitle(f)"
                >
                  {{ fileTitle(f) }}
                </option>
              </UIMoloSelect>

              <UIMoloSelect
                  v-model="ep.access"
                  compact
                  :parent="ACCESS"
                  children="t"
                  value-key="v"
                  t-label="Уровень доступа"
              />

              <UIMoloToggle
                  v-if="ep.access === 'key' && ep._id"
                  v-model="ep.regenerateKey"
                  compact
                  label="Сгенерировать новый ключ API /api/x"
              />
            </template>
          </UIMoloSection>

          <UIMoloSection>
            <template #header>
              <div class="sec-title-wrap">
                <UIMoloSticker name="shield" :size="14" glow />
                <strong>Защита MoloFlow Connect</strong>
              </div>
            </template>
            <template #main>
              <UIMoloToggle
                  v-model="ep.regenerateConnectKey"
                  compact
                  label="Выпустить новый Molo-Key при сохранении"
              />
              <small class="muted-subtext">
                Передаётся в заголовке X-Molo-Key. Полный ключ будет показан один раз после сохранения.
              </small>
            </template>
          </UIMoloSection>

          <UIMoloToggle v-model="ep.enabled" compact label="Включить эндпоинт" />

          <div v-if="ep.error" class="error-banner">
            <UIMoloSticker name="alert" :size="14" />
            <span>{{ ep.error }}</span>
          </div>
        </div>
      </template>
    </UIMoloModal>

    <!-- МОДАЛКА: ОДНОКРАТНЫЙ ПОКАЗ MOLO-KEY -->
    <UIMoloModal
        v-model="connectKeyDialog.open"
        title="Секретный Molo-Key"
        width="600px"
        cancel-text="Закрыть"
        hide-cancel
        close-on-overlay
        help-text="Внимание: это единственный показ секретного ключа. Скопируйте и сохраните его в надёжном месте прямо сейчас."
    >
      <template #body>
        <div class="modal-form-stack">
          <!-- РЕКВИЗИТЫ -->
          <UIMoloSection>
            <template #header>
              <div class="sec-title-wrap">
                <UIMoloSticker name="key" :size="15" glow />
                <strong>Параметры подключения</strong>
              </div>
            </template>
            <template #main>
              <div class="copyable-input-row">
                <UIMoloInput
                    :model-value="connectKeyDialog.key"
                    readonly
                    compact
                    t-label="Секретный Molo-Key"
                />
                <UIMoloButton class="small confirm copy-inline-btn" @click="copyConnectKey">
                  <UIMoloSticker name="copy" :size="12" />
                  <span>Копировать</span>
                </UIMoloButton>
              </div>

              <div v-if="connectKeyDialog.url" class="copyable-input-row">
                <UIMoloInput
                    :model-value="connectKeyDialog.url"
                    readonly
                    compact
                    t-label="URL эндпоинта Connect"
                />
                <UIMoloButton class="small copy-inline-btn" @click="copy(connectKeyDialog.url)">
                  <UIMoloSticker name="copy" :size="12" />
                  <span>Ссылка</span>
                </UIMoloButton>
              </div>
            </template>
          </UIMoloSection>

          <!-- ПРИМЕРЫ ВЫЗОВА -->
          <UIMoloSection>
            <template #header>
              <div class="sec-header-line">
                <div class="sec-title-wrap">
                  <UIMoloSticker name="code" :size="14" />
                  <strong>Пример интеграции</strong>
                </div>

                <div class="btn-group">
                  <UIMoloButton
                      class="small"
                      :class="{ confirm: connectKeyTab === 'curl' }"
                      @click="connectKeyTab = 'curl'"
                  >
                    cURL
                  </UIMoloButton>
                  <UIMoloButton
                      class="small"
                      :class="{ confirm: connectKeyTab === 'js' }"
                      @click="connectKeyTab = 'js'"
                  >
                    JavaScript
                  </UIMoloButton>
                </div>
              </div>
            </template>

            <template #main>
              <div class="monaco-wrapper-box key-snippet-box">
                <UIMoloMonaco
                    :initial-code="connectKeyTab === 'curl'
                    ? connectCurl(connectKeyDialog.url, connectKeyDialog.key)
                    : connectFetch(connectKeyDialog.url, connectKeyDialog.key)"
                    :language="connectKeyTab === 'curl' ? 'shell' : 'javascript'"
                />
              </div>

              <div class="snippet-actions">
                <UIMoloButton
                    class="small fit"
                    @click="copy(connectKeyTab === 'curl'
                    ? connectCurl(connectKeyDialog.url, connectKeyDialog.key)
                    : connectFetch(connectKeyDialog.url, connectKeyDialog.key))"
                >
                  <UIMoloSticker name="copy" :size="12" />
                  <span>Скопировать {{ connectKeyTab === 'curl' ? 'cURL' : 'Fetch' }}</span>
                </UIMoloButton>
              </div>
            </template>
          </UIMoloSection>
        </div>
      </template>
    </UIMoloModal>
  </div>
</template>

<style scoped>
.mdb-layout {
  --line: rgba(255, 255, 255, 0.08);
  --line-strong: rgba(255, 255, 255, 0.14);
  --bg-sidebar: rgba(18, 20, 26, 0.65);
  --bg-row-hover: rgba(255, 255, 255, 0.04);
  --text-muted: rgba(255, 255, 255, 0.5);
  --accent: var(--window-accent, #38bdf8);

  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  height: 100%;
  width: 100%;
  min-height: 0;
  color: var(--window-content-text, #f1f5f9);
  font-size: 13px;
  overflow: hidden;
}

/* Состояния загрузки / ошибок */
.mdb-state-center {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-muted);
}
.mdb-state-center.err {
  color: #ff5d73;
}

/* БОКОВАЯ ПАНЕЛЬ */
.mdb-sidebar {
  display: flex;
  flex-direction: column;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--line);
  min-height: 0;
}

.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}

.sidebar-head .brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.brand-title {
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.3px;
}

.sidebar-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tree-db-node {
  display: flex;
  flex-direction: column;
}

.db-header-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background: transparent;
  border: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}
.db-header-row:hover {
  background: var(--bg-row-hover);
}

.chev-icon {
  color: var(--text-muted);
}

.db-title {
  flex: 1;
  font-weight: 600;
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge-pill {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-muted);
}

.cols-tree-branch {
  margin: 2px 0 6px 14px;
  padding: 0 0 0 8px;
  list-style: none;
  border-left: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.col-tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 5px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}
.col-tree-row:hover {
  background: var(--bg-row-hover);
  color: #fff;
}
.col-tree-row.active {
  background: rgba(56, 189, 248, 0.12);
  color: var(--accent);
  font-weight: 600;
}
.col-tree-row.add-col-row {
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
}

.sidebar-foot {
  padding: 8px;
  border-top: 1px solid var(--line);
}
.endpoint-nav-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 6px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
}
.endpoint-nav-btn:hover {
  background: var(--bg-row-hover);
}
.endpoint-nav-btn.active {
  background: rgba(56, 189, 248, 0.12);
  color: var(--accent);
}

/* ОСНОВНАЯ ЗОНА */
.mdb-viewport {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.viewport-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.015);
  flex-shrink: 0;
}

.header-breadcrumb .crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
}
.db-badge {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.sep {
  color: var(--text-muted);
}
.col-curr {
  font-weight: 700;
  font-size: 15px;
}

/* Вкладки */
.tab-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* Тулбар данных */
.data-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.search-wrap {
  width: 260px;
}
.records-counter {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
}
.count-val {
  font-weight: 600;
  color: #fff;
}
.actions-right {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

/* Таблица */
.table-container {
  flex: 1;
  overflow: auto;
  position: relative;
}
.table-container.busy {
  opacity: 0.5;
}

.molo-data-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}

.molo-data-grid th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #11141a;
  border-bottom: 1px solid var(--line-strong);
  padding: 0;
}

.sort-header-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}
.sort-header-btn:hover {
  color: #fff;
}
.static-header {
  display: block;
  padding: 8px 12px;
  color: var(--text-muted);
  font-weight: 600;
}

.molo-data-grid td {
  padding: 7px 12px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}

.grid-data-row {
  cursor: pointer;
  transition: background 0.1s ease;
}
.grid-data-row:hover {
  background: var(--bg-row-hover);
}

.cell-empty {
  color: var(--text-muted);
}
.cell-date {
  font-size: 11px;
  color: var(--text-muted);
  width: 140px;
}
.pill-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 11px;
}

.grid-empty-row td {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
}

.pagination-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px;
  border-top: 1px solid var(--line);
  flex-shrink: 0;
}
.pager-info {
  font-size: 12px;
  color: var(--text-muted);
}

/* Структура */
.structure-pane {
  position: relative;
  overflow: hidden;
}
.structure-content-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px 80px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sec-header-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.sec-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
}

.fields-list-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-item-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--line);
}

.field-row-primary {
  display: grid;
  grid-template-columns: 140px 170px 130px auto auto;
  align-items: flex-end;
  gap: 10px;
}

.toggles-col {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 32px;
}

.actions-col {
  display: flex;
  gap: 4px;
  margin-left: auto;
  height: 32px;
  align-items: center;
}

.field-row-secondary {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 4px;
  border-top: 1px dashed rgba(255, 255, 255, 0.05);
}

.extra-field-item {
  width: 200px;
}
.extra-field-item.grow {
  flex: 1;
  min-width: 200px;
}
.extra-field-item.num {
  width: 90px;
}

.grid-form-two-col {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.toggle-wrapper-aligned {
  display: flex;
  align-items: flex-end;
  height: 100%;
  padding-bottom: 4px;
}

.danger-section {
  border-color: rgba(239, 68, 68, 0.3) !important;
}
.text-danger {
  color: #ef4444;
}
.danger-actions-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

/* Плавающая панель */
.floating-savebar {
  position: absolute;
  bottom: 12px;
  left: 20px;
  right: 20px;
  padding: 10px 16px;
  border-radius: 8px;
  background: #111b27;
  border: 1px solid var(--accent);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transform: translateY(120%);
  opacity: 0;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
  z-index: 10;
}
.floating-savebar.visible {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
}
.savebar-text {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fbbf24;
  font-weight: 500;
}

/* Вкладка API */
.code-pane {
  padding: 14px 16px;
  gap: 12px;
  overflow-y: auto;
}
.code-env-bar {
  display: flex;
}
.code-viewport-block {
  position: relative;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.4);
  overflow: hidden;
}
.copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
}
.code-pre {
  margin: 0;
  padding: 14px;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  overflow-x: auto;
}

/* Эндпоинты */
.endpoints-pane {
  padding: 14px 16px;
  overflow-y: auto;
}
.endpoints-list-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.endpoint-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--line);
}
.endpoint-card.disabled {
  opacity: 0.55;
}
.endpoint-top-line {
  justify-content: space-between;

  display: flex;
  gap: 8px;
}
.route-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--accent);
}
.methods-badges {
  display: flex;
  gap: 4px;
}
.method-chip {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
}
.method-chip.get { color: #3fd68a; }
.method-chip.post { color: #38bdf8; }
.method-chip.delete { color: #ff5d73; }
.method-chip.put, .method-chip.patch { color: #fbbf24; }
.access-chip {
  font-size: 11px;
  color: var(--text-muted);
}
.endpoint-quick-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
}
.endpoint-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}
.endpoint-meta-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  color: var(--text-muted);
}
.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Пустые состояния */
.viewport-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.empty-glass-card {
  max-width: 440px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 28px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--line);
}
.empty-glass-card h3 {
  margin: 0;
  font-size: 16px;
}
.empty-glass-card p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
}
.empty-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.empty-banner {
  padding: 14px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed var(--line);
  color: var(--text-muted);
  text-align: center;
}
.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ff6b6b;
  font-size: 12px;
}
.text-link {
  background: transparent;
  border: 0;
  color: var(--accent);
  cursor: pointer;
  padding: 0 4px;
}

/* Модальные формы */
.modal-form-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.field-label {
  font-size: 11px;
  color: #8c8c9e;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.required {
  color: #ef4444;
}
.type-hint {
  color: var(--text-muted);
}
.monaco-wrapper-box {
  height: 180px;
  border: 1px solid var(--line);
  border-radius: 6px;
  overflow: hidden;
}
.key-snippet-box {
  height: 140px;
}
.methods-selector-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.methods-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* Специфика модалки Molo-Key */
.copyable-input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  width: 100%;
}
.copyable-input-row :deep(.form-group) {
  flex: 1;
}
.copy-inline-btn {
  margin-bottom: 1px;
  flex-shrink: 0;
}
.snippet-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}
.muted-subtext {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
}

/* Connect Row */
.connect-publish-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 11px 12px;
  margin: 12px 0;
  border: 1px solid rgba(56, 189, 248, 0.16);
  border-radius: 12px;
  background: rgba(56, 189, 248, 0.035);
}
.connect-publish-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}
.connect-publish-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
}
.connect-public-url {
  overflow: hidden;
  max-width: 100%;
  color: var(--accent);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}
.connect-publish-info small {
  color: var(--text-muted);
  font-size: 11px;
}
.connect-publish-info .connect-publish-error {
  color: #fb7185;
}
.connect-publish-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
}

.connect-key-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid var(--line);
  border-radius: 8px;
}
.connect-key-status {
  display: flex;
  align-items: center;
  gap: 10px;
}
.connect-key-status-text {
  display: flex;
  flex-direction: column;
}
.connect-key-status-text strong {
  font-size: 12px;
}
.connect-key-status-text small {
  font-size: 11px;
  color: var(--text-muted);
}
.connect-key-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Анимация вращения */
.spin-anim {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 820px) {
  .mdb-layout {
    grid-template-columns: 1fr;
    grid-template-rows: 200px 1fr;
  }
  .mdb-sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .field-row-primary {
    grid-template-columns: 1fr;
  }
  .grid-form-two-col {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .connect-publish-row {
    align-items: flex-start;
    flex-direction: column;
  }
  .connect-publish-actions {
    align-self: flex-end;
  }
}
</style>