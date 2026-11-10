import { defineEventHandler, getQuery, createError } from 'h3'
import { resolveActor } from '~~/server/utils/moloDb/access'
import { getEnterpriseId } from '~~/server/utils/workspace'
import { assertSheetTitle, assertSpreadsheetId } from '~~/server/utils/googleSheets'
import { callGsheetsBridge } from '~~/server/utils/gsheetsBridge'

export default defineEventHandler(async (event) => {
  const enterpriseId = getEnterpriseId(event)
  await resolveActor(event, enterpriseId, 'data')
  const q = getQuery(event)
  const spreadsheetId = assertSpreadsheetId(String(q.spreadsheetId || ''))
  const sheet = assertSheetTitle(String(q.sheet || ''))
  return await callGsheetsBridge({ action: 'values', spreadsheetId, sheet })
})
