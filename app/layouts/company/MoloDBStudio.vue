<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useLogger } from '~~/app/composables/useLogger'
import UIMoloMonaco from '~/components/UI/MoloMonaco.vue'

const { addLog } = useLogger('MoloDB')

// useMoloDbAdmin прокидывается глобально (moduleComposables.client.ts)
const admin = typeof useMoloDbAdmin === 'function' ? useMoloDbAdmin() : null

// ───────────────────────── общее состояние ─────────────────────────
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

// Уведомления через MoloNotice
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
  { v: 'members', t: 'Участники предприятия', d: 'нужен вход в MoloFlow' },
  { v: 'key', t: 'По секретному ключу', d: 'для вебхуков и внешних сервисов' },
  { v: 'public', t: 'Открытый', d: 'любой, с лимитом запросов' }
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

// ───────────────────────── загрузка ─────────────────────────
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
  sel.db = db.name
  sel.col = col.name
  addLog('info', `Открыта коллекция: [${db.name} -> ${col.name}]`)
}

function showEndpoints() {
  view.value = 'endpoints'
}

// ───────────────────────── данные коллекции ─────────────────────────
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
const shownFields = computed(() => activeColFields.value.slice(0, 6))
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

// ───────────────────────── редактор записи ─────────────────────────
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

// ───────────────────────── структура ─────────────────────────
const draft = ref(null)
const dbDraft = reactive({ title: '', description: '' })
const confirmDrop = ref('') // '' | 'col' | 'db'
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

// ───────────────────────── новая база / коллекция ─────────────────────────
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

// ───────────────────────── эндпоинты ─────────────────────────
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

// ───────────────────────── подключение: готовые сниппеты ─────────────────────────
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
    return `// Vue / JS модуль — импортировать ничего не нужно
const items = useMoloDb('${d}')${acc}

const created = await items.insert(${j(doc)})
const list    = await items.find(${j(flt)}, { sort: '-createdAt', limit: 20 })
const page    = await items.page({}, { search: 'текст', limit: 25, skip: 0 })   // { items, total }
await items.update(created._id, ${j(doc)})
await items.update(${j(flt)}, {}, { upsert: true })
await items.delete(created._id)`
  if (lang.value === 'server')
    return `// серверный файл модуля — объект db уже доступен
export async function handler(context) {
  const items = db('${d}')${acc}

  const created = await items.insert(${j(doc)})
  const list    = await items.find(${j(flt)}, { sort: '-createdAt', limit: 20 })
  await items.update(created._id, ${j(doc)})

  return { status: 201, body: { created, count: list.length } }
}`
  if (lang.value === 'py')
    return `# Python-бот — moloflow_db.py создаётся автоматически рядом с кодом
from moloflow_db import db

items = db("${d}").${/^[a-z_][a-z0-9_]*$/i.test(c) ? c : `collection("${c}")`}

created = items.insert(${pyJson(doc)})
rows = items.find(${pyJson(flt)}, sort="-createdAt", limit=20)
items.update(created["_id"], ${pyJson(doc)})

# внутри async-кода (aiogram) — версии с буквой a:
created = await items.ainsert(${pyJson(doc)})
rows = await items.afind(${pyJson(flt)}, limit=20)`
  return `POST /api/enterprises/${admin?.enterpriseId() || '<id предприятия>'}/moloDb/${d}/${c}
Content-Type: application/json

${JSON.stringify({ op: 'insert', doc }, null, 2)}

// остальные операции: find, findOne, get, count, insertMany, update, delete
${JSON.stringify({ op: 'find', filter: flt, sort: '-createdAt', limit: 20 }, null, 2)}`
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
  <div class="mdb">
    <div v-if="booting" class="mdb-center">
      <UIMoloSticker name="history" :size="20" glow />
      <span>Загрузка баз MoloDB…</span>
    </div>
    <div v-else-if="fatal" class="mdb-center err">{{ fatal }}</div>

    <template v-else>
      <!-- ═════ боковая панель ═════ -->
      <aside class="side">
        <header class="side-head">
          <UIMoloSticker name="nomenclature" :size="20" glow />
          <h2>MoloDB</h2>
          <UIMoloButton v-if="canManage" variant="small" title="Новая база" @click="openNewDb">
            <UIMoloSticker name="plus" :size="12" />
          </UIMoloButton>
        </header>

        <nav class="side-list">
          <div v-for="db in dbs" :key="db.name" class="db">
            <button class="db-row" @click="openDbs[db.name] = !openDbs[db.name]">
              <UIMoloSticker name="arrow" :size="12" class="chev" :class="{ open: openDbs[db.name] }" />
              <span class="db-name">{{ db.title || db.name }}</span>
              <span class="count">{{ (db.collections || []).length }}</span>
            </button>
            <ul v-show="openDbs[db.name]" class="cols">
              <li v-for="c in (db.collections || [])" :key="c.name">
                <button
                    class="col"
                    :class="{ on: view === 'collection' && sel.db === db.name && sel.col === c.name }"
                    @click="pick(db, c)"
                >
                  <UIMoloSticker name="table" :size="13" />
                  <span>{{ colTitle(c) }}</span>
                </button>
              </li>
              <li v-if="canManage">
                <button class="col add" @click="openNewCol(db)">
                  <UIMoloSticker name="plus" :size="12" />
                  <span>Коллекция</span>
                </button>
              </li>
            </ul>
          </div>
          <p v-if="!dbs.length" class="side-empty">Баз пока нет.</p>
        </nav>

        <footer v-if="canManage" class="side-foot">
          <button class="nav" :class="{ on: view === 'endpoints' }" @click="showEndpoints">
            <UIMoloSticker name="it" :size="15" />
            <span>Эндпоинты</span>
            <span class="count">{{ eps.length }}</span>
          </button>
        </footer>
      </aside>

      <!-- ═════ основная область ═════ -->
      <main class="main">
        <!-- нет баз -->
        <section v-if="view === 'collection' && !activeCol" class="empty">
          <UIMoloSticker name="nomenclature" :size="48" glow />
          <h3>{{ activeDb ? 'В этой базе ещё нет коллекций' : 'Создайте свою первую базу данных' }}</h3>
          <p>
            База хранит ваши данные в таблицах-коллекциях со своими полями. К ней можно обращаться из
            Vue-модулей, серверных файлов, Python-ботов и по HTTP.
          </p>
          <UIMoloButton v-if="canManage && !activeDb" variant="confirm" @click="openNewDb">
            <UIMoloSticker name="plus" :size="14" />
            Создать базу
          </UIMoloButton>
          <UIMoloButton v-else-if="canManage && activeDb" variant="confirm" @click="openNewCol(activeDb)">
            <UIMoloSticker name="plus" :size="14" />
            Добавить коллекцию
          </UIMoloButton>
          <p v-else class="muted">Базы создаёт разработчик предприятия.</p>
        </section>

        <!-- коллекция -->
        <template v-else-if="view === 'collection'">
          <header class="head">
            <div>
              <div class="crumb">{{ activeDb?.title || activeDb?.name }}</div>
              <h1>{{ colTitle(activeCol) }}</h1>
            </div>
            <div class="btn-group">
              <UIMoloButton variant="small" :class="{ confirm: tab === 'data' }" @click="tab = 'data'">
                <UIMoloSticker name="table" :size="13" />
                Данные
              </UIMoloButton>
              <UIMoloButton v-if="canManage" variant="small" :class="{ confirm: tab === 'structure' }" @click="tab = 'structure'">
                <UIMoloSticker name="pen" :size="13" />
                Структура
              </UIMoloButton>
              <UIMoloButton variant="small" :class="{ confirm: tab === 'code' }" @click="tab = 'code'">
                <UIMoloSticker name="dev-json" :size="13" />
                Подключение
              </UIMoloButton>
            </div>
          </header>

          <!-- Данные -->
          <section v-if="tab === 'data'" class="pane">
            <div class="bar">
              <div class="search-box">
                <UIMoloInput
                    v-model="search"
                    compact
                    placeholder="Поиск по текстовым полям..."
                />
              </div>
              <span class="muted grow">{{ total }} {{ total === 1 ? 'запись' : 'записей' }}</span>
              <UIMoloButton variant="small" title="Обновить" @click="loadRows">
                <UIMoloSticker name="history" :size="13" />
              </UIMoloButton>
              <UIMoloButton
                  variant="confirm"
                  class="small"
                  :disabled="!activeColFields.length"
                  @click="openRecord(null)"
              >
                <UIMoloSticker name="plus" :size="13" />
                Запись
              </UIMoloButton>
            </div>

            <p v-if="!activeColFields.length" class="note">
              У коллекции пока нет полей.
              <button v-if="canManage" class="link" @click="tab = 'structure'">Добавить поля</button>
            </p>
            <p v-if="rowsError" class="note err">{{ rowsError }}</p>

            <div v-if="activeColFields.length" class="table-wrap" :class="{ busy: rowsLoading }">
              <table>
                <thead>
                <tr>
                  <th v-for="f in shownFields" :key="f.name">
                    <button v-if="f.type !== 'json'" class="th" @click="sortBy(f.name)">
                      <span>{{ f.label || f.name }}</span>
                      <UIMoloSticker
                          v-if="sortDir(f.name)"
                          :name="sortDir(f.name) === 'asc' ? 'up' : 'down'"
                          :size="12"
                      />
                    </button>
                    <span v-else>{{ f.label || f.name }}</span>
                  </th>
                  <th>
                    <button class="th" @click="sortBy('createdAt')">
                      <span>Создано</span>
                      <UIMoloSticker
                          v-if="sortDir('createdAt')"
                          :name="sortDir('createdAt') === 'asc' ? 'up' : 'down'"
                          :size="12"
                      />
                    </button>
                  </th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="r in rows" :key="r._id" @click="openRecord(r)">
                  <td
                      v-for="f in shownFields"
                      :key="f.name"
                      :class="['t-' + f.type, { nil: r[f.name] === undefined || r[f.name] === null || r[f.name] === '' }]"
                  >
                    <span v-if="f.type === 'select' && r[f.name]" class="chip">{{ r[f.name] }}</span>
                    <span v-else>{{ fmtCell(f, r[f.name]) }}</span>
                  </td>
                  <td class="nil">{{ fmtDate(r.createdAt) }}</td>
                </tr>
                <tr v-if="!rows.length && !rowsLoading" class="none">
                  <td :colspan="shownFields.length + 1">{{ search ? 'Ничего не найдено' : 'Записей пока нет' }}</td>
                </tr>
                </tbody>
              </table>
            </div>

            <footer v-if="total > PAGE" class="pager">
              <UIMoloButton variant="small" :disabled="skip === 0" @click="go(-1)">Назад</UIMoloButton>
              <span class="muted">{{ pageFrom }}–{{ pageTo }} из {{ total }}</span>
              <UIMoloButton variant="small" :disabled="skip + PAGE >= total" @click="go(1)">Дальше</UIMoloButton>
            </footer>
          </section>

          <!-- Структура -->
          <section v-else-if="tab === 'structure' && draft" class="pane scroll">
            <div class="card">
              <div class="card-head">
                <h3>Поля коллекции</h3>
                <UIMoloButton variant="small" @click="addField">
                  <UIMoloSticker name="plus" :size="12" />
                  Добавить поле
                </UIMoloButton>
              </div>

              <div v-for="(f, i) in (draft.fields || [])" :key="i" class="field">
                <div class="field-main">
                  <UIMoloInput
                      v-model="f.name"
                      compact
                      placeholder="имя_поля"
                      :readonly="f.saved"
                      :title="f.saved ? 'Имя сохранённого поля менять нельзя' : ''"
                  />
                  <UIMoloInput
                      v-model="f.label"
                      compact
                      placeholder="Подпись (необязательно)"
                  />
                  <div class="type-sel">
                    <UIMoloSelect
                        v-model="f.type"
                        compact
                        :disabled="f.saved"
                        :title="f.saved ? 'Тип сохранённого поля менять нельзя' : ''"
                    >
                      <option v-for="t in TYPES" :key="t.v" :value="t.v">{{ t.t }}</option>
                    </UIMoloSelect>
                  </div>

                  <div class="field-checks">
                    <UIMoloToggle v-model="f.required" compact label="Обязательное" />
                    <UIMoloToggle
                        v-if="['string', 'number', 'select', 'date'].includes(f.type)"
                        v-model="f.unique"
                        compact
                        label="Уникальное"
                    />
                  </div>

                  <div class="field-actions">
                    <UIMoloButton variant="small" title="Выше" @click="moveField(i, -1)">
                      <UIMoloSticker name="up" :size="12" />
                    </UIMoloButton>
                    <UIMoloButton variant="small" title="Ниже" @click="moveField(i, 1)">
                      <UIMoloSticker name="down" :size="12" />
                    </UIMoloButton>
                    <UIMoloButton variant="close" class="small" title="Убрать поле" @click="removeField(i)">
                      <UIMoloSticker name="trash" :size="12" />
                    </UIMoloButton>
                  </div>
                </div>

                <div class="field-extra">
                  <UIMoloInput
                      v-model="f.default"
                      compact
                      :placeholder="f.type === 'date' ? 'По умолчанию (now = сейчас)' : f.type === 'boolean' ? 'true / false' : 'Значение по умолчанию'"
                  />
                  <UIMoloInput
                      v-if="f.type === 'select'"
                      v-model="f.options"
                      compact
                      placeholder="Варианты через запятую: новый, в работе, готово"
                  />
                  <template v-if="f.type === 'number'">
                    <UIMoloInput v-model="f.min" compact type="number" placeholder="мин" />
                    <UIMoloInput v-model="f.max" compact type="number" placeholder="макс" />
                  </template>
                  <UIMoloInput
                      v-if="f.type === 'string' || f.type === 'text'"
                      v-model="f.maxLength"
                      compact
                      type="number"
                      placeholder="макс. длина"
                  />
                </div>
              </div>
            </div>

            <div class="card">
              <h3>Настройки коллекции</h3>
              <div class="grid2">
                <UIMoloInput v-model="draft.title" t-label="Название" placeholder="Например: Сообщения" />
                <UIMoloInput v-model="draft.maxDocs" type="number" t-label="Лимит записей" placeholder="по умолчанию 50 000" />
                <UIMoloInput v-model="draft.ttlDays" type="number" t-label="Хранить, дней" placeholder="бессрочно" />
                <div class="toggle-cell">
                  <UIMoloToggle v-model="draft.strict" label="Только поля схемы" true-label="Да" false-label="Любые" />
                </div>
                <UIMoloInput v-model="draft.readRoles" t-label="Кто читает (роли)" placeholder="все участники" />
                <UIMoloInput v-model="draft.writeRoles" t-label="Кто пишет (роли)" placeholder="все участники" />
              </div>
              <p class="hint">Роли через запятую (например «Программист, Управляющий»). Администратор имеет доступ всегда.</p>
            </div>

            <div class="card">
              <h3>База «{{ activeDb?.title || activeDb?.name }}»</h3>
              <div class="grid2">
                <UIMoloInput v-model="dbDraft.title" t-label="Название" />
                <UIMoloInput v-model="dbDraft.description" t-label="Описание" />
              </div>
              <UIMoloButton variant="action" class="fit" :disabled="!dbDirty" @click="saveDbInfo">
                Сохранить параметры базы
              </UIMoloButton>
            </div>

            <div class="card danger-zone">
              <h3>Опасная зона</h3>
              <div class="row-gap">
                <UIMoloButton variant="close" @click="dropCollection">
                  <UIMoloSticker name="trash" :size="13" />
                  {{ confirmDrop === 'col' ? 'Да, удалить коллекцию и все её данные' : 'Удалить коллекцию' }}
                </UIMoloButton>
                <UIMoloButton variant="close" @click="dropDatabase">
                  <UIMoloSticker name="trash" :size="13" />
                  {{ confirmDrop === 'db' ? 'Да, удалить базу данных целиком' : 'Удалить базу' }}
                </UIMoloButton>
                <UIMoloButton v-if="confirmDrop" variant="small" @click="confirmDrop = ''">Отмена</UIMoloButton>
              </div>
            </div>

            <footer class="savebar" :class="{ show: dirty }">
              <span>Есть несохранённые изменения</span>
              <UIMoloButton variant="small" @click="resetDraft">Сбросить</UIMoloButton>
              <UIMoloButton variant="confirm" :loading="saving" @click="saveStructure">
                Сохранить структуру
              </UIMoloButton>
            </footer>
          </section>

          <!-- Подключение -->
          <section v-else-if="tab === 'code'" class="pane scroll">
            <div class="seg">
              <button :class="{ on: lang === 'js' }" @click="lang = 'js'">Vue / JS</button>
              <button :class="{ on: lang === 'server' }" @click="lang = 'server'">Серверный файл</button>
              <button :class="{ on: lang === 'py' }" @click="lang = 'py'">Python</button>
              <button :class="{ on: lang === 'http' }" @click="lang = 'http'">HTTP</button>
            </div>
            <div class="code">
              <UIMoloButton class="copy small" title="Копировать" @click="copy(snippet)">
                <UIMoloSticker name="copy" :size="13" />
              </UIMoloButton>
              <pre>{{ snippet }}</pre>
            </div>

            <div class="card">
              <h3>Операторы запросов MoloDB</h3>
              <table class="ops">
                <tbody>
                <tr><td><code>{ поле: значение }</code></td><td>Равно</td></tr>
                <tr><td><code>$ne $gt $gte $lt $lte</code></td><td>Не равно, больше, меньше</td></tr>
                <tr><td><code>$in $nin</code></td><td>Одно из списка / не из списка</td></tr>
                <tr><td><code>$exists</code></td><td>Поле заполнено или отсутствует</td></tr>
                <tr><td><code>$contains $startsWith</code></td><td>Текст содержит / начинается с (без учёта регистра)</td></tr>
                <tr><td><code>$and $or $nor</code></td><td>Логические объединения условий</td></tr>
                </tbody>
              </table>
              <p class="hint">Системные поля: <code>_id</code>, <code>createdAt</code>, <code>updatedAt</code>.</p>
            </div>
          </section>
        </template>

        <!-- Эндпоинты -->
        <template v-else-if="view === 'endpoints'">
          <header class="head">
            <div>
              <div class="crumb">HTTP</div>
              <h1>Эндпоинты</h1>
            </div>
            <UIMoloButton variant="confirm" @click="openEndpoint(null)">
              <UIMoloSticker name="plus" :size="14" />
              Новый эндпоинт
            </UIMoloButton>
          </header>
          <section class="pane scroll">
            <p class="lead">
              Эндпоинт — это сетевой адрес, выполняющий серверный код вашего модуля.
              Внутри контекста всегда доступен объект <code>db</code> и данные запроса <code>context</code>.
            </p>

            <div v-if="!eps.length" class="empty small">
              <UIMoloSticker name="it" :size="32" />
              <h3>Эндпоинтов пока нет</h3>
              <p>Создайте js/ts-модуль с функцией <code>handler(context)</code> и привяжите его к адресу.</p>
            </div>

            <article v-for="e in eps" :key="e._id" class="ep" :class="{ off: !e.enabled }">
              <div class="ep-top">
                <code class="ep-url">/api/x/…/{{ e.slug }}</code>
                <span v-for="m in e.methods" :key="m" class="chip m" :class="m.toLowerCase()">{{ m }}</span>
                <span class="chip acc" :class="e.access">{{ ACCESS.find((a) => a.v === e.access)?.t }}</span>
                <span class="grow"/>
                <UIMoloButton variant="small" title="Копировать адрес" @click="copy(admin.endpointUrl(e.slug))">
                  <UIMoloSticker name="copy" :size="12" />
                </UIMoloButton>
                <UIMoloButton variant="small" title="Изменить" @click="openEndpoint(e)">
                  <UIMoloSticker name="pen" :size="12" />
                </UIMoloButton>
                <UIMoloButton variant="close" class="small" @click="removeEndpoint(e)">
                  {{ epDel === e._id ? 'Удалить?' : '' }}
                  <UIMoloSticker v-if="epDel !== e._id" name="trash" :size="12" />
                </UIMoloButton>
              </div>
              <p v-if="e.description" class="ep-desc">{{ e.description }}</p>
              <div class="ep-meta">
                <span>{{ modName(e.moduleId) }}<template v-if="e.file"> → {{ e.file }}</template></span>
                <span v-if="e.stats?.calls">{{ e.stats.calls }} вызовов, последний {{ fmtDate(e.stats.lastCallAt) }} ({{ e.stats.lastStatus }})</span>
                <span v-else>ещё не вызывался</span>
                <UIMoloToggle :model-value="e.enabled" compact label="Активен" @change="toggleEndpoint(e)" />
              </div>
              <div v-if="e.access === 'key' && e.secret" class="ep-key">
                <UIMoloSticker name="lock" :size="13" />
                <code>{{ revealed[e._id] ? e.secret : '••••••••••••••••' }}</code>
                <button class="link" @click="revealed[e._id] = !revealed[e._id]">
                  {{ revealed[e._id] ? 'скрыть' : 'показать' }}
                </button>
                <button class="link" @click="copy(e.secret)">копировать</button>
                <span class="muted">передавайте в заголовке <code>x-api-key</code></span>
              </div>
            </article>
          </section>
        </template>
      </main>
    </template>

    <!-- ═════ модалка записи ═════ -->
    <UIMoloModal
        v-model="rec.open"
        :title="rec.id ? 'Редактирование записи' : 'Новая запись'"
        width="680px"
        confirm-text="Сохранить"
        cancel-text="Отмена"
        :loading="rec.saving"
        @confirm="saveRecord"
    >
      <template #body>
        <div class="modal-form">
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
                :t-label="f.label || f.name"
                :l-required="f.required"
            />
            <UIMoloInput
                v-else-if="f.type === 'number'"
                v-model="rec.values[f.name]"
                type="number"
                :t-label="f.label || f.name"
                :l-required="f.required"
            />
            <div v-else-if="f.type === 'select'" class="molo-form-group">
              <UIMoloSelect
                  v-model="rec.values[f.name]"
                  :t-label="f.label || f.name"
                  :l-required="f.required"
              >
                <option value="">— Не выбрано —</option>
                <option v-for="o in (f.options || [])" :key="o" :value="o">{{ o }}</option>
              </UIMoloSelect>
            </div>
            <div v-else-if="f.type === 'text' || f.type === 'json'" class="molo-form-group">
              <label class="lbl">{{ f.label || f.name }} <i v-if="f.required">*</i> <small>{{ TYPE_TITLE[f.type] }}</small></label>
              <div class="monaco-field-container">
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
                :t-label="f.label || f.name"
                :l-required="f.required"
                :max-length="f.maxLength || 1000"
            />
          </template>
          <p v-if="rec.id" class="muted mono small">{{ rec.id }}</p>
          <p v-if="rec.error" class="note err">{{ rec.error }}</p>
        </div>
      </template>
      <template #footer>
        <UIMoloButton v-if="rec.id" variant="close" class="small" @click="deleteRecord">
          {{ rec.confirmDelete ? 'Удалить навсегда?' : 'Удалить' }}
        </UIMoloButton>
      </template>
    </UIMoloModal>

    <!-- ═════ модалка новой базы ═════ -->
    <UIMoloModal
        v-model="nd.open"
        title="Создание базы данных"
        width="440px"
        confirm-text="Создать"
        cancel-text="Отмена"
        :loading="nd.saving"
        @confirm="createDb"
    >
      <template #body>
        <div class="modal-form">
          <UIMoloInput
              v-model="nd.name"
              t-label="Идентификатор базы (латиница)"
              placeholder="botlog"
              l-required
          />
          <UIMoloInput
              v-model="nd.title"
              t-label="Название"
              placeholder="Журнал бота"
          />
          <UIMoloInput
              v-model="nd.description"
              t-label="Описание"
              placeholder="Логирование входящих команд"
          />
          <p v-if="nd.error" class="note err">{{ nd.error }}</p>
        </div>
      </template>
    </UIMoloModal>

    <!-- ═════ модалка новой коллекции ═════ -->
    <UIMoloModal
        v-model="nc.open"
        title="Создание коллекции"
        width="440px"
        confirm-text="Создать"
        cancel-text="Отмена"
        :loading="nc.saving"
        @confirm="createCol"
    >
      <template #body>
        <div class="modal-form">
          <UIMoloInput
              v-model="nc.name"
              t-label="Имя коллекции (латиница)"
              placeholder="messages"
              l-required
          />
          <UIMoloInput
              v-model="nc.title"
              t-label="Название"
              placeholder="Сообщения"
          />
          <p v-if="nc.error" class="note err">{{ nc.error }}</p>
        </div>
      </template>
    </UIMoloModal>

    <!-- ═════ модалка эндпоинта ═════ -->
    <UIMoloModal
        v-model="ep.open"
        :title="ep._id ? 'Настройка эндпоинта' : 'Новый HTTP эндпоинт'"
        width="560px"
        confirm-text="Сохранить"
        cancel-text="Отмена"
        :loading="ep.saving"
        @confirm="saveEndpoint"
    >
      <template #body>
        <div class="modal-form">
          <UIMoloInput
              v-model="ep.slug"
              t-label="Адрес (/api/x/{предприятие}/…)"
              placeholder="orders/create"
              l-required
          />
          <UIMoloInput
              v-model="ep.description"
              t-label="Описание"
              placeholder="Приём внешних вебхуков"
          />
          <div class="molo-form-group">
            <label class="lbl">Методы</label>
            <div class="seg wrap">
              <button
                  v-for="m in METHODS"
                  :key="m"
                  type="button"
                  :class="{ on: ep.methods.includes(m) }"
                  @click="toggleMethod(m)"
              >
                {{ m }}
              </button>
            </div>
          </div>
          <div class="molo-form-group">
            <UIMoloSelect
                v-model="ep.moduleId"
                t-label="Модуль (JS / TS)"
                @change="loadModuleFiles('')"
            >
              <option value="">— Выберите модуль —</option>
              <option v-for="m in (mods || [])" :key="m._id" :value="m._id">{{ m.name }}</option>
            </UIMoloSelect>
          </div>
          <div v-if="ep.moduleId" class="molo-form-group">
            <UIMoloSelect v-model="ep.file" t-label="Исполняемый файл">
              <option value="">Основной файл модуля</option>
              <option v-for="f in ep.files" :key="fileTitle(f)" :value="fileTitle(f)">{{ fileTitle(f) }}</option>
            </UIMoloSelect>
          </div>
          <div class="molo-form-group">
            <label class="lbl">Уровень доступа</label>
            <label v-for="a in ACCESS" :key="a.v" class="radio">
              <input v-model="ep.access" type="radio" :value="a.v" />
              <span>{{ a.t }} <small>{{ a.d }}</small></span>
            </label>
          </div>
          <UIMoloToggle
              v-if="ep.access === 'key' && ep._id"
              v-model="ep.regenerateKey"
              label="Сгенерировать новый секретный ключ"
          />
          <UIMoloToggle v-model="ep.enabled" label="Включен" />
          <p v-if="ep.error" class="note err">{{ ep.error }}</p>
        </div>
      </template>
    </UIMoloModal>

    <!-- ═════ уведомления (UIMoloNotice) ═════ -->
    <div class="notices-container">
      <UIMoloNotice
          v-if="notice.show"
          :notice_type="notice.type"
          :notice_title="notice.title"
          :notice_text="notice.text"
          :duration="3800"
          @close="notice.show = false"
      />
    </div>
  </div>
</template>

<style scoped>
.mdb {
  --accent: var(--window-accent, #1fb6ff);
  --line: var(--half_opacity_border, rgba(255, 255, 255, 0.12));
  --s1: rgba(255, 255, 255, 0.04);
  --s2: rgba(255, 255, 255, 0.08);
  --muted: rgba(255, 255, 255, 0.55);
  --ok: #3fd68a;
  --err: #ff5d73;
  --amber: #f5b84a;
  position: relative;
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  color: var(--window-content-text, #e6eefb);
  font-size: 13px;
  line-height: 1.45;
}

.mdb * {
  box-sizing: border-box;
}

.mdb-center {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
}

.mdb-center.err {
  color: var(--err);
  padding: 24px;
  text-align: center;
}

code, .mono {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px;
}

code {
  background: var(--s2);
  padding: 1px 5px;
  border-radius: 4px;
}

.muted {
  color: var(--muted);
}

.grow {
  flex: 1;
}

.small {
  font-size: 11px;
}

/* боковая панель */
.side {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--line);
  background: var(--s1);
}

.side-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 8px;
}

.side-head h2 {
  margin: 0;
  flex: 1;
  font-size: 15px;
  font-weight: 600;
}

.side-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 8px;
}

.db-row, .col, .nav {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.db-row:hover, .col:hover, .nav:hover {
  background: var(--s2);
}

.db-name {
  flex: 1;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chev {
  transition: transform 0.15s;
  color: var(--muted);
}

.chev.open {
  transform: rotate(90deg);
}

.count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--s2);
  color: var(--muted);
  font-size: 11px;
  text-align: center;
}

.cols {
  margin: 0 0 6px;
  padding: 0 0 0 20px;
  list-style: none;
}

.col {
  color: rgba(255, 255, 255, 0.8);
}

.col.on, .nav.on {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
}

.col.add {
  color: var(--muted);
}

.side-empty {
  padding: 12px;
  color: var(--muted);
}

.side-foot {
  padding: 8px;
  border-top: 1px solid var(--line);
}

.nav {
  font-weight: 500;
}

.nav .count {
  margin-left: auto;
}

/* основная область */
.main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px 12px;
  border-bottom: 1px solid var(--line);
}

.head h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.crumb {
  color: var(--muted);
  font-size: 12px;
  margin-bottom: 2px;
}

.btn-group {
  display: flex;
}

.pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 12px;
  min-height: 0;
  padding: 14px 18px;
}

.pane.scroll {
  overflow-y: auto;
}

.bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.search-box {
  width: 260px;
}

.link {
  border: 0;
  background: transparent;
  color: var(--accent);
  font: inherit;
  cursor: pointer;
  padding: 0 2px;
}

.note {
  margin: 0;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--s1);
  color: var(--muted);
}

.note.err {
  border-color: var(--err);
  color: var(--err);
}

/* таблица */
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 10px;
}

.table-wrap.busy {
  opacity: 0.6;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0;
  text-align: left;
  font-weight: 600;
  background: color-mix(in srgb, var(--s2) 100%, #0b121c);
  border-bottom: 1px solid var(--line);
}

th > span, .th {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
}

.th {
  cursor: pointer;
}

td {
  max-width: 280px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

tbody tr {
  cursor: pointer;
}

tbody tr:hover td {
  background: var(--s1);
}

tr.none td {
  cursor: default;
  text-align: center;
  color: var(--muted);
  padding: 28px;
}

td.nil {
  color: var(--muted);
}

td.t-number {
  font-variant-numeric: tabular-nums;
}

.chip {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--s2);
  font-size: 12px;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

/* структура */
.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--s1);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card h3 {
  margin: 0;
  font-size: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}

.field-main {
  display: grid;
  grid-template-columns: 140px 180px 130px auto auto;
  align-items: center;
  gap: 8px;
}

.type-sel {
  width: 130px;
}

.field-checks {
  display: flex;
  align-items: center;
  gap: 12px;
}

.field-actions {
  display: inline-flex;
  gap: 4px;
  margin-left: auto;
}

.field-extra {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.grid2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}

.toggle-cell {
  display: flex;
  align-items: flex-end;
  padding-bottom: 4px;
}

.hint {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.danger-zone {
  border-color: color-mix(in srgb, var(--err) 40%, var(--line));
}

.row-gap {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.savebar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding: 10px 14px;
  border: 1px solid var(--accent);
  border-radius: 10px;
  background: #0f1b29;
  transform: translateY(150%);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.2s, opacity 0.2s;
}

.savebar.show {
  transform: none;
  opacity: 1;
  pointer-events: auto;
}

.savebar span {
  flex: 1;
  color: var(--amber);
}

/* сегменты и сниппеты */
.seg {
  display: inline-flex;
  align-self: flex-start;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--s1);
  gap: 2px;
}

.seg.wrap {
  flex-wrap: wrap;
}

.seg button {
  padding: 5px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  cursor: pointer;
}

.seg button.on {
  background: var(--accent);
  color: #04141f;
  font-weight: 600;
}

.code {
  position: relative;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.3);
}

.code pre {
  margin: 0;
  padding: 14px 44px 14px 14px;
  overflow-x: auto;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  tab-size: 2;
}

.copy {
  position: absolute;
  top: 8px;
  right: 8px;
}

.ops td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  white-space: normal;
}

.ops tr {
  cursor: default;
}

.ops tbody tr:hover td {
  background: transparent;
}

/* эндпоинты */
.lead {
  margin: 0;
  max-width: 70ch;
  color: var(--muted);
}

.ep {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--s1);
}

.ep.off {
  opacity: 0.6;
}

.ep-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ep-url {
  font-size: 13px;
  background: transparent;
  padding: 0;
  color: var(--accent);
}

.ep-desc {
  margin: 0;
}

.ep-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
  color: var(--muted);
  font-size: 12px;
}

.ep-key {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
}

.chip.m {
  font-weight: 600;
  font-size: 11px;
}

.chip.m.get { color: var(--ok); }
.chip.m.post { color: var(--accent); }
.chip.m.delete { color: var(--err); }
.chip.m.put, .chip.m.patch { color: var(--amber); }

.chip.acc.public { color: var(--amber); }
.chip.acc.key { color: var(--accent); }

/* пустые состояния */
.empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
}

.empty.small {
  flex: none;
  padding: 28px;
  border: 1px dashed var(--line);
  border-radius: 10px;
}

.empty h3 {
  margin: 0;
  font-size: 16px;
}

.empty p {
  max-width: 52ch;
  margin: 0;
  color: var(--muted);
}

/* модальная форма */
.modal-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.molo-form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lbl {
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.lbl i {
  color: var(--err);
  font-style: normal;
}

.lbl small {
  color: var(--muted);
  font-size: 11px;
}

.radio {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.85);
}

.radio small {
  color: var(--muted);
}

.monaco-field-container {
  height: 240px;
  border: 1px solid var(--line);
  border-radius: 6px;
  overflow: hidden;
}

/* плавающий контейнер уведомлений */
.notices-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.notices-container > * {
  pointer-events: auto;
}

@media (max-width: 760px) {
  .mdb {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .side {
    max-height: 40vh;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .field-main {
    grid-template-columns: 1fr;
  }

  .grid2 {
    grid-template-columns: 1fr;
  }

  .head {
    flex-wrap: wrap;
  }
}
</style>