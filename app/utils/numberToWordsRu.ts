const UNITS_M = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
const UNITS_F = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
const TEENS = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
const HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']

function plural(count: number, one: string, two: string, five: string): string {
    const n = Math.abs(count) % 100
    const n1 = n % 10
    if (n > 10 && n < 20) return five
    if (n1 > 1 && n1 < 5) return two
    if (n1 === 1) return one
    return five
}

function triadToWords(triad: number, isFemale = false): string {
    const words: string[] = []
    const h = Math.floor(triad / 100)
    const d = Math.floor((triad % 100) / 10)
    const u = triad % 10

    if (h) words.push(HUNDREDS[h]!)

    if (d === 1) {
        words.push(TEENS[u]!)
    } else {
        if (d) words.push(TENS[d]!)
        if (u) words.push(isFemale ? UNITS_F[u]! : UNITS_M[u]!)
    }

    return words.join(' ')
}

export function numberToWordsRu(num: number): string {
    if (num === 0) return 'ноль'

    const triads = []
    let temp = Math.floor(Math.abs(num))

    while (temp > 0) {
        triads.push(temp % 1000)
        temp = Math.floor(temp / 1000)
    }

    const parts: string[] = []

    // Миллиарды
    if (triads[3]) {
        parts.push(triadToWords(triads[3]), plural(triads[3], 'миллиард', 'миллиарда', 'миллиардов'))
    }
    // Миллионы
    if (triads[2]) {
        parts.push(triadToWords(triads[2]), plural(triads[2], 'миллион', 'миллиона', 'миллионов'))
    }
    // Тысячи (женский род: "одна тысяча", "две тысячи")
    if (triads[1]) {
        parts.push(triadToWords(triads[1], true), plural(triads[1], 'тысяча', 'тысячи', 'тысяч'))
    }
    // Единицы
    if (triads[0]) {
        parts.push(triadToWords(triads[0]))
    }

    return parts.join(' ').trim()
}

/** Преобразует число в рубли и копейки: "Сто двадцать три рубля 45 копеек" */
export function rublesToWordsRu(amount: number): string {
    const rubles = Math.floor(amount || 0)
    const kopecks = Math.round(((amount || 0) - rubles) * 100)

    const rubWords = numberToWordsRu(rubles)
    const rubForm = plural(rubles, 'рубль', 'рубля', 'рублей')
    const kopForm = plural(kopecks, 'копейка', 'копейки', 'копеек')

    const capitalizedRub = rubWords.charAt(0).toUpperCase() + rubWords.slice(1)
    const kopStr = String(kopecks).padStart(2, '0')

    return `${capitalizedRub} ${rubForm} ${kopStr} ${kopForm}`
}