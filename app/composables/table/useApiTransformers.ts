// composables/useApiTransformers.ts

export interface ColumnDefinition {
    key: string
    title: string
    width?: number
    format?: (val: any, rawRow: Record<string, any>) => any
}

export interface ApiTransformer {
    id: string
    name: string
    columns: ColumnDefinition[]
}

const statusMap: Record<string, string> = {
    pending: 'Ожидает оплаты',
    waiting_for_capture: 'К подтверждению',
    succeeded: 'Успешно',
    canceled: 'Отменен',
}

function formatDate(iso?: string) {
    if (!iso) return ''
    const d = new Date(iso)
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
}

function formatRub(val: any): string {
    if (val === null || val === undefined || val === '') return '—'
    const num = Number(val)
    return Number.isFinite(num)
        ? `${num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
        : String(val)
}

export const API_TRANSFORMERS: Record<string, ApiTransformer> = {
    yookassa: {
        id: 'yookassa',
        name: 'ЮKassa: Платежи',
        columns: [
            {
                key: 'created_at',
                title: 'Дата и время',
                width: 160,
                format: (val) => formatDate(val),
            },
            {
                key: 'id',
                title: 'Номер транзакции',
                width: 290,
                format: (val) => String(val || ''),
            },
            {
                key: 'status',
                title: 'Статус',
                width: 140,
                format: (val) => statusMap[String(val)] || val,
            },
            {
                key: 'amount.value',
                title: 'Сумма оплаты',
                width: 130,
                format: (val) => formatRub(val),
            },
            {
                key: 'income_amount.value',
                title: 'К зачислению (чистыми)',
                width: 160,
                format: (val) => formatRub(val),
            },
            {
                key: 'description',
                title: 'Назначение / Описание',
                width: 280,
                format: (val) => val || '—',
            },
            {
                key: 'payment_method.type',
                title: 'Способ оплаты',
                width: 150,
                format: (val) => {
                    const types: Record<string, string> = {
                        bank_card: 'Банковская карта',
                        sberbank: 'SberPay',
                        sbp: 'СБП',
                        yoo_money: 'ЮMoney',
                        tinkoff_bank: 'Т-Банк',
                    }
                    return types[String(val)] || val || '—'
                },
            },
        ],
    },
}