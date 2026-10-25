<!-- components/apps/molodb/MoloDBStudio.vue -->
<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useLogger } from '~~/app/composables/useLogger'
import UIMoloMonaco from '~/components/UI/MoloMonaco.vue'

const { addLog } = useLogger('MoloDB')

const admin = typeof useMoloDbAdmin === 'function' ? useMoloDbAdmin() : null

const booting = ref(true)
const fatal = ref('')
const dbs = ref([])
const eps = ref([])
const mods = ref([])
const canManage = ref(false)
const view = ref('collection') // collection | endpoints
const tab = ref('data') // data | structure | code
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
  { v: 'members', t: 'Участники предприятия', d: 'вход в MoloFlow' },
  { v: 'key', t: 'По секретному ключу', d: 'вебхуки и интеграции' },
  { v: 'public', t: 'Открытый', d: 'публичный доступ' }
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
    openDbs['company'] = true
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
      fields: Array.isArray(col.fields) ? col.fields : [],
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
  if (sel.db) {
    addLog('info', `Выбрана активная БД: [${sel.db} / ${sel.col || 'нет коллекций'}]`)
  }
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

const activeColFields = computed(() => (activeCol.value && Array.isArray(activeCol.value.fields) ? activeCol.value.fields : []))
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
  sortKey.value = sortKey.value === key ? '-' + key : sortKey.value === '-' + key ? key : '-' + key
  skip.value = 0
  loadRows()
}

const sortDir = (key) => (sortKey.value === key ? 'asc' : sortKey.value === '-' + key ? 'desc' : '')

const pad = (n) => String(n).padStart(2, '0')
const toLocalInput = (v) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime())
      ? ''
      : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fmtDate = (v) => (v ? new Date(v).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—')

function fmtCell(f, v) {
  if (v === undefined || v === null || v === '') return '—'
  if (f.type === 'boolean') return v ? '✓' : '✕'
  if (f.type === 'date') return fmtDate(v)
  if (f.type === 'json') return JSON.stringify(v)
  if (f.type === 'number') return Number(v).toLocaleString('ru-RU')
  return String(v)
}

const rec = reactive({ open: false, id: '', values: {}, error: '', saving: false, confirmDelete: false })

function openRecord(row) {
  const values = {}
  const fields = activeColFields.value
  for (const f of fields) {
    const v = row ? row[f.name] : undefined
    if (f.type === 'boolean') values[f.name] = v === undefined || v === null ? !!f.default && f.default !== 'false' : !!v
    else if (f.type === 'date') values[f.name] = v ? toLocalInput(v) : ''
    else if (f.type === 'json') values[f.name] = v === undefined || v === null ? '' : JSON.stringify(v, null, 2)
    else values[f.name] = v === undefined || v === null ? (row || f.default === undefined || f.default === 'now' ? '' : String(f.default)) : v
  }
  Object.assign(rec, { open: true, id: row?._id || '', values, error: '', saving: false, confirmDelete: false })
}

function recordPayload() {
  const doc = {}
  const editing = !!rec.id
  const fields = activeColFields.value
  for (const f of fields) {
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
      } catch (e) {
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
  if (!rec.confirmDelete) {
    rec.confirmDelete = true
    return
  }
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
const dflt = (f) => (f.default === undefined || f.default === null ? '' : typeof f.default === 'object' ? JSON.stringify(f.default) : String(f.default))

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
    } catch (e) {
      throw new Error(`Поле «${f.name}»: значение по умолчанию — не JSON`)
    }
  }
  return v
}

function fromDraft(d, name) {
  const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v))
  return {
    name,
    title: d.title,
    strict: d.strict,
    ttlDays: num(d.ttlDays),
    maxDocs: num(d.maxDocs),
    access: { read: split(d.readRoles), write: split(d.writeRoles) },
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

const dirty = computed(() => !!draft.value && !!activeCol.value && JSON.stringify(draft.value) !== JSON.stringify(toDraft(activeCol.value)))
const dbDirty = computed(() => !!activeDb.value && (dbDraft.title !== (activeDb.value.title || '') || dbDraft.description !== (activeDb.value.description || '')))

function addField() {
  if (!draft.value) return
  draft.value.fields.push({
    name: '', label: '', type: 'string', required: false, unique: false,
    default: '', options: '', min: '', max: '', maxLength: '', saved: false
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

async function pushDb(collections, title = activeDb.value?.title, description = activeDb.value?.description, confirmDelete = false) {
  if (!activeDb.value) return
  addLog('info', `Синхронизация структуры БД [${activeDb.value.name}]...`)
  await admin.updateDb(activeDb.value.name, { title, description, collections }, { confirmDelete })
  addLog('success', `Структура БД [${activeDb.value.name}] успешно обновлена`)
  await loadAll()
}

async function saveStructure() {
  saving.value = true
  await guard(async () => {
    const col = fromDraft(draft.value, sel.col)
    await pushDb(activeDb.value.collections.map((c) => (c.name === sel.col ? col : c)))
    resetDraft()
    notify('Структура сохранена', 'success')
  })
  saving.value = false
}

async function saveDbInfo() {
  await guard(async () => {
    await pushDb(activeDb.value.collections, dbDraft.title.trim(), dbDraft.description.trim())
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
    addLog('warning', `Коллекция удалена`)
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

const nd = reactive({ open: false, name: '', title: '', description: '', error: '', saving: false })
const nc = reactive({ open: false, name: '', title: '', error: '', saving: false })
const NAME_RE = /^[a-z][a-z0-9_]{0,23}$/

function openNewDb() {
  Object.assign(nd, { open: true, name: '', title: '', description: '', error: '', saving: false })
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
    await admin.createDb({ name: nd.name, title: nd.title.trim(), description: nd.description.trim(), collections: [] })
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
  Object.assign(nc, { open: true, name: '', title: '', error: '', saving: false })
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
    await pushDb([...(activeDb.value?.collections || []), { name: nc.name, title: nc.title.trim(), fields: [], strict: true }])
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

const ep = reactive({
  open: false, _id: '', slug: '', description: '', methods: ['POST'], moduleId: '', file: '',
  access: 'members', enabled: true, regenerateKey: false, files: [], error: '', saving: false
})
const modName = (id) => (mods.value || []).find((m) => m._id === id)?.name || 'модуль удалён'
const fileTitle = (f) => f.path || f.name
const revealed = reactive({})

async function openEndpoint(e) {
  if (!mods.value.length) await guard(async () => (mods.value = await admin.modules()))
  Object.assign(ep, {
    open: true,
    _id: e?._id || '',
    slug: e?.slug || '',
    description: e?.description || '',
    methods: e ? [...e.methods] : ['POST'],
    moduleId: e?.moduleId || '',
    file: e?.file || '',
    access: e?.access || 'members',
    enabled: e ? e.enabled : true,
    regenerateKey: false,
    files: [],
    error: '',
    saving: false
  })
  if (ep.moduleId) await loadModuleFiles(e?.file || '')
}

async function loadModuleFiles(keep = '') {
  ep.files = ep.moduleId ? (await guard(() => admin.moduleFiles(ep.moduleId))) || [] : []
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
    await admin.endpoints.save({
      _id: ep._id || undefined,
      slug: ep.slug,
      description: ep.description,
      methods: ep.methods,
      moduleId: ep.moduleId,
      file: ep.file,
      access: ep.access,
      enabled: ep.enabled,
      regenerateKey: ep.regenerateKey
    })
    ep.open = false
    addLog('success', `Эндпоинт "${ep.slug}" сохранён`)
    await loadEndpoints()
    notify('Эндпоинт сохранён', 'success')
  } catch (e) {
    addLog('error', `Ошибка сохранения эндпоинта: ${msg(e)}`)
    ep.error = msg(e)
  } finally {
    ep.saving = false
  }
}

async function toggleEndpoint(e) {
  await guard(async () => {
    await admin.endpoints.save({ ...e, regenerateKey: false, enabled: !e.enabled })
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

const lang = ref('js')
const sample = (f) =>
    ({
      string: 'текст', text: 'длинный текст', number: 1, boolean: true,
      date: new Date().toISOString(), select: f.options?.[0] || '', json: {}
    })[f.type]

const exampleDoc = computed(() => {
  const fields = activeColFields.value
  const pick = [...fields.filter((f) => f.required), ...fields.filter((f) => !f.required)].slice(0, 4)
  return Object.fromEntries(pick.map((f) => [f.name, sample(f)]))
})
const filterField = computed(() => activeColFields.value.find((f) => ['string', 'select', 'number'].includes(f.type)))
const j = (v) => JSON.stringify(v)
const pyJson = (v) => JSON.stringify(v, null, 2).replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None')

const snippet = computed(() => {
  if (!activeCol.value) return ''
  const d = sel.db, c = sel.col
  const doc = exampleDoc.value
  const ff = filterField.value
  const flt = ff ? { [ff.name]: sample(ff) } : {}
  const acc = /^[a-z_][a-z0-9_]*$/i.test(c) ? `.${c}` : `.collection('${c}')`
  if (lang.value === 'js')
    return `// Vue / JS модуль
const items = useMoloDb('${d}')${acc}

const created = await items.insert(${j(doc)})
const list    = await items.find(${j(flt)}, { sort: '-createdAt', limit: 20 })
const page    = await items.page({}, { search: 'текст', limit: 25, skip: 0 })
await items.update(created._id, ${j(doc)})
await items.update(${j(flt)}, {}, { upsert: true })
await items.delete(created._id)`
  if (lang.value === 'server')
    return `// Серверный файл модуля
export async function handler(context) {
  const items = db('${d}')${acc}

  const created = await items.insert(${j(doc)})
  const list    = await items.find(${j(flt)}, { sort: '-createdAt', limit: 20 })
  await items.update(created._id, ${j(doc)})

  return { status: 201, body: { created, count: list.length } }
}`
  if (lang.value === 'py')
    return `# Python-клиент
from moloflow_db import db

items = db("${d}").${/^[a-z_][a-z0-9_]*$/i.test(c) ? c : `collection("${c}")`}

created = items.insert(${pyJson(doc)})
rows = items.find(${pyJson(flt)}, sort="-createdAt", limit=20)
items.update(created["_id"], ${pyJson(doc)})`
  return `POST /api/enterprises/${admin?.enterpriseId() || '<id>'}/moloDb/${d}/${c}
Content-Type: application/json

${JSON.stringify({ op: 'insert', doc }, null, 2)}`
})

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch (e) {
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
  if (rec.open) rec.open = false
  else if (nd.open) nd.open = false
  else if (nc.open) nc.open = false
  else if (ep.open) ep.open = false
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

          <div class="head-actions">
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
              <UIMoloSticker name="arrow" :size="11" class="chev-icon" :class="{ open: openDbs[db.name] }" />
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
            <h3>{{ activeDb ? 'В выбранной базе ещё нет таблиц' : 'База данных не инициализирована' }}</h3>
            <p>
              MoloDB хранит типизированные документы со схемой полей, валидацией и доступом по ролям.
            </p>
            <div class="empty-actions" v-if="canManage">
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

            <div class="header-tabs">
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
                <UIMoloInput
                    v-model="search"
                    compact
                    placeholder="Быстрый поиск по строкам..."
                />
              </div>

              <div v-if="isReadOnlyCollection" class="records-counter" title="Редактирование выполняется в редакторе модулей">
                <span>Только просмотр</span>
              </div>
              <div class="records-counter">
                <span class="count-val">{{ total }}</span>
                <span class="count-lbl">{{ total === 1 ? 'запись' : 'записей' }}</span>
              </div>

              <div class="actions-right">
                <UIMoloButton
                    class="small"
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
              <button v-if="canManage" class="text-link" @click="tab = 'structure'">Добавить поля структуры</button>
            </div>

            <div v-if="rowsError" class="error-banner">
              <UIMoloSticker name="alert" :size="14" />
              <span>{{ rowsError }}</span>
            </div>

            <div v-if="activeColFields.length" class="table-container" :class="{ busy: rowsLoading }">
              <table class="molo-data-grid">
                <thead>
                <tr>
                  <th v-for="f in shownFields" :key="f.name">
                    <button v-if="f.type !== 'json'" class="sort-header-btn" @click="sortBy(f.name)">
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
                <tr v-for="r in rows" :key="r._id" class="grid-data-row" @click="!isReadOnlyCollection && openRecord(r)">
                  <td
                      v-for="f in shownFields"
                      :key="f.name"
                      :class="['cell-' + f.type, { 'cell-empty': r[f.name] === undefined || r[f.name] === null || r[f.name] === '' }]"
                  >
                    <span v-if="f.type === 'select' && r[f.name]" class="pill-badge">{{ r[f.name] }}</span>
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
              <UIMoloButton class="small" :disabled="skip === 0" @click="go(-1)">← Назад</UIMoloButton>
              <span class="pager-info">{{ pageFrom }}–{{ pageTo }} из {{ total }}</span>
              <UIMoloButton class="small" :disabled="skip + PAGE >= total" @click="go(1)">Далее →</UIMoloButton>
            </footer>
          </section>

          <!-- 2. СТРУКТУРА ПОЛЕЙ -->
          <section v-else-if="tab === 'structure' && draft && !isReadOnlyCollection" class="tab-pane structure-pane">
            <div class="structure-content-scroll">
              <!-- Секция полей -->
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
                    <div v-for="(f, i) in (draft.fields || [])" :key="i" class="field-item-card">
                      <!-- Основная строка конфигурации -->
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
                          >
                            <option v-for="t in TYPES" :key="t.v" :value="t.v">{{ t.t }}</option>
                          </UIMoloSelect>
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
                          <UIMoloButton class="small" title="Переместить выше" @click="moveField(i, -1)">
                            <UIMoloSticker name="up" :size="10" />
                          </UIMoloButton>
                          <UIMoloButton class="small" title="Переместить ниже" @click="moveField(i, 1)">
                            <UIMoloSticker name="down" :size="10" />
                          </UIMoloButton>
                          <UIMoloButton class="small close" title="Удалить поле" @click="removeField(i)">
                            <UIMoloSticker name="trash" :size="10" />
                          </UIMoloButton>
                        </div>
                      </div>

                      <!-- Дополнительные параметры поля -->
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

                        <div v-if="f.type === 'string' || f.type === 'text'" class="extra-field-item num">
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

              <!-- Настройки коллекции -->
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
                      <UIMoloToggle v-model="draft.strict" compact label="Строгая схема" true-label="Да" false-label="Любые поля" />
                    </div>
                    <UIMoloInput v-model="draft.readRoles" compact t-label="Роли чтения" placeholder="все участники" />
                    <UIMoloInput v-model="draft.writeRoles" compact t-label="Роли записи" placeholder="все участники" />
                  </div>
                </template>
              </UIMoloSection>

              <!-- Параметры текущей БД -->
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

              <!-- Опасная зона -->
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

                    <UIMoloButton v-if="confirmDrop" class="small" @click="confirmDrop = ''">Отмена</UIMoloButton>
                  </div>
                </template>
              </UIMoloSection>
            </div>

            <!-- Плавающая плашка сохранения структуры -->
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
              <div class="seg-buttons">
                <UIMoloButton class="small" :class="{ confirm: lang === 'js' }" @click="lang = 'js'">Vue / JS</UIMoloButton>
                <UIMoloButton class="small" :class="{ confirm: lang === 'server' }" @click="lang = 'server'">Сервер</UIMoloButton>
                <UIMoloButton class="small" :class="{ confirm: lang === 'py' }" @click="lang = 'py'">Python</UIMoloButton>
                <UIMoloButton class="small" :class="{ confirm: lang === 'http' }" @click="lang = 'http'">HTTP (cURL)</UIMoloButton>
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
              <div v-for="e in eps" :key="e._id" class="endpoint-card" :class="{ disabled: !e.enabled }">
                <div class="endpoint-top-line">
                  <div class="route-tag">
                    <UIMoloSticker name="link" :size="12" />
                    <code>/api/x/…/{{ e.slug }}</code>
                  </div>

                  <div class="methods-badges">
                    <span v-for="m in e.methods" :key="m" class="method-chip" :class="m.toLowerCase()">{{ m }}</span>
                  </div>

                  <span class="access-chip">{{ ACCESS.find((a) => a.v === e.access)?.t }}</span>

                  <div class="endpoint-quick-actions">
                    <UIMoloButton class="small" title="Скопировать URL" @click="copy(admin.endpointUrl(e.slug))">
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

                <div class="endpoint-meta-line">
                  <div class="meta-item">
                    <UIMoloSticker name="it" :size="12" />
                    <span>{{ modName(e.moduleId) }}<template v-if="e.file"> → {{ e.file }}</template></span>
                  </div>
                  <div class="meta-item">
                    <UIMoloToggle :model-value="e.enabled" compact label="Активен" @change="toggleEndpoint(e)" />
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
        width="640px"
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
            >
              <option value="">— Не выбрано —</option>
              <option v-for="o in (f.options || [])" :key="o" :value="o">{{ o }}</option>
            </UIMoloSelect>

            <div v-else-if="f.type === 'text' || f.type === 'json'" class="form-monaco-field">
              <label class="field-label">
                {{ f.label || f.name }}
                <span v-if="f.required" class="required">*</span>
                <small class="type-hint">{{ TYPE_TITLE[f.type] }}</small>
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
            <span>{{ rec.error }}</span>
          </div>
        </div>
      </template>
    </UIMoloModal>

    <!-- МОДАЛКА: СОЗДАНИЕ БД -->
    <UIMoloModal
        v-model="nd.open"
        title="Создание базы данных"
        width="440px"
        confirm-text="Создать базу"
        cancel-text="Отмена"
        :loading="nd.saving"
        close-on-overlay
        @confirm="createDb"
    >
      <template #body>
        <div class="modal-form-stack">
          <UIMoloInput v-model="nd.name" compact t-label="Идентификатор базы (латиница)" placeholder="analytics" l-required />
          <UIMoloInput v-model="nd.title" compact t-label="Название" placeholder="Аналитика предприятия" />
          <UIMoloInput v-model="nd.description" compact t-label="Описание" placeholder="Логи и внутренние отчеты" />
          <div v-if="nd.error" class="error-banner">{{ nd.error }}</div>
        </div>
      </template>
    </UIMoloModal>

    <!-- МОДАЛКА: СОЗДАНИЕ КОЛЛЕКЦИИ -->
    <UIMoloModal
        v-model="nc.open"
        title="Создание коллекции"
        width="440px"
        confirm-text="Создать коллекцию"
        cancel-text="Отмена"
        :loading="nc.saving"
        close-on-overlay
        @confirm="createCol"
    >
      <template #body>
        <div class="modal-form-stack">
          <UIMoloInput v-model="nc.name" compact t-label="Имя таблицы (латиница)" placeholder="orders" l-required />
          <UIMoloInput v-model="nc.title" compact t-label="Отображаемое название" placeholder="Заказы клиентов" />
          <div v-if="nc.error" class="error-banner">{{ nc.error }}</div>
        </div>
      </template>
    </UIMoloModal>

    <!-- МОДАЛКА: НАСТРОЙКА ЭНДПОИНТА -->
    <UIMoloModal
        v-model="ep.open"
        :title="ep._id ? 'Настройка HTTP эндпоинта' : 'Новый HTTP эндпоинт'"
        width="540px"
        confirm-text="Сохранить"
        cancel-text="Отмена"
        :loading="ep.saving"
        close-on-overlay
        @confirm="saveEndpoint"
    >
      <template #body>
        <div class="modal-form-stack">
          <UIMoloInput v-model="ep.slug" compact t-label="Адрес (/api/x/{предприятие}/…)" placeholder="orders/webhook" l-required />
          <UIMoloInput v-model="ep.description" compact t-label="Описание" placeholder="Прием внешних заказов" />

          <div class="methods-selector-block">
            <span class="field-label">Методы запроса</span>
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

          <UIMoloSelect v-model="ep.moduleId" compact t-label="Модуль обработчика" @change="loadModuleFiles('')">
            <option value="">— Выберите модуль —</option>
            <option v-for="m in (mods || [])" :key="m._id" :value="m._id">{{ m.name }}</option>
          </UIMoloSelect>

          <UIMoloSelect v-if="ep.moduleId" v-model="ep.file" compact t-label="Исполняемый файл">
            <option value="">Основной файл модуля</option>
            <option v-for="f in ep.files" :key="fileTitle(f)" :value="fileTitle(f)">{{ fileTitle(f) }}</option>
          </UIMoloSelect>

          <div class="access-selector-block">
            <span class="field-label">Доступ к эндпоинту</span>
            <div class="access-radios">
              <label v-for="a in ACCESS" :key="a.v" class="radio-label">
                <input v-model="ep.access" type="radio" :value="a.v" />
                <span class="radio-title">{{ a.t }}</span>
                <small class="radio-hint">{{ a.d }}</small>
              </label>
            </div>
          </div>

          <UIMoloToggle
              v-if="ep.access === 'key' && ep._id"
              v-model="ep.regenerateKey"
              compact
              label="Сгенерировать новый ключ"
          />

          <UIMoloToggle v-model="ep.enabled" compact label="Включить эндпоинт" />

          <div v-if="ep.error" class="error-banner">{{ ep.error }}</div>
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
  padding: 10px 12px;
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

.head-actions {
  display: flex;
  gap: 4px;
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
  transition: transform 0.15s ease;
}
.chev-icon.open {
  transform: rotate(90deg);
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

.header-tabs {
  display: flex;
  gap: 4px;
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

/* Сетка таблицы */
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
.seg-buttons {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.03);
  padding: 3px;
  border-radius: 6px;
  border: 1px solid var(--line);
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
  display: flex;
  align-items: center;
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
  padding-top: 6px;
  border-top: 1px solid var(--line);
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

/* Модальные окна */
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
}
.required {
  color: #ef4444;
}
.type-hint {
  color: var(--text-muted);
}
.monaco-wrapper-box {
  height: 200px;
  border: 1px solid var(--line);
  border-radius: 6px;
  overflow: hidden;
  margin-top: 4px;
}
.methods-selector-block,
.access-selector-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.methods-row {
  display: flex;
  gap: 6px;
}
.access-radios {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.radio-title {
  font-size: 12.5px;
}
.radio-hint {
  color: var(--text-muted);
  font-size: 11px;
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
</style>