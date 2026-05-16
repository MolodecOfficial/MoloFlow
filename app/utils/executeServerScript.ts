export const executeServerScript = async (code: string, format: string, context: any) => {

    const wrapped = `
export default async function handler(context) {

  ${code}

  if (typeof main === 'function') return await main(context)
  if (typeof handler === 'function') return await handler(context)

  return { ok: true }
}
`

    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor

    const fn = new AsyncFunction('context', wrapped)

    return await fn(context)
}