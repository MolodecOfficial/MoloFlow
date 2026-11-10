import { createError, defineEventHandler, getQuery } from 'h3'
import { resolveActor } from '~~/server/utils/moloDb/access'
import { getEnterpriseId } from '~~/server/utils/workspace'
import { assertSpreadsheetId } from '~~/server/utils/googleSheets'
import { callGsheetsBridge } from '~~/server/utils/gsheetsBridge'

export default defineEventHandler(async (event) => {
  const enterpriseId = getEnterpriseId(event)
  await resolveActor(event, enterpriseId, 'data')
  const spreadsheetId = assertSpreadsheetId(String(getQuery(event).spreadsheetId || ''))
  const result: any = await callGsheetsBridge({ action: 'meta', spreadsheetId })
  if (!Array.isArray(result?.sheets) || !result.sheets.length) throw createError({ statusCode: 404, statusMessage: 'В таблице нет вкладок или Apps Script вернул некорректные данные' })
  return result
})
