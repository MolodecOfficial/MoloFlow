import { defineEventHandler, getQuery, readBody, createError } from 'h3'
import { resolveActor } from '~~/server/utils/moloDb/access'
import { getEnterpriseId } from '~~/server/utils/workspace'
import { assertSpreadsheetId, assertA1Range } from '~~/server/utils/googleSheets'
import { callGsheetsBridge } from '~~/server/utils/gsheetsBridge'

export default defineEventHandler(async (event) => {
  const enterpriseId = getEnterpriseId(event)
  await resolveActor(event, enterpriseId, 'data')
  const spreadsheetId = assertSpreadsheetId(String(getQuery(event).spreadsheetId || ''))
  const body = await readBody(event)
  if (!Array.isArray(body?.data) || body.data.length > 500) throw createError({ statusCode: 400, statusMessage: 'Ожидался массив диапазонов data (не более 500 за запрос)' })
  const data = body.data.map((item: any) => {
    const range = assertA1Range(item?.range)
    if (!Array.isArray(item?.values) || !item.values.length || !Array.isArray(item.values[0])) throw createError({ statusCode: 400, statusMessage: 'Некорректные значения диапазона' })
    return { range, values: item.values.map((row: any[]) => row.map((v) => v === null || v === undefined ? '' : v)) }
  })
  return await callGsheetsBridge({ action: 'write', spreadsheetId }, { action: 'write', spreadsheetId, data })
})
