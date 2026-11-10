// window-themes.ts

export interface WindowTheme {
    id: string
    name: string
    description: string
    previewColor: string
    isCustom?: boolean
    styles: {
        windowBg: string
        headerBg: string
        headerBorder: string
        headerText: string
        contentBg: string
        borderColor: string
        borderRadius: string
        backdropBlur: string
    }
}

export interface WindowButtonStyle {
    id: string
    name: string
    description: string
    isCustom?: boolean
    styles: {
        controlsBorder: string
        buttonBorder: string
        buttonBg: string
        buttonHoverBg: string
        buttonTextColor: string
        buttonHoverTextColor?: string
        controlsGap: string
        controlsPadding: string
    }
}

export const defaultThemeStyles = {
    windowBg: 'var(--half_opacity_bg)',
    headerBg: 'var(--half_opacity_bg)',
    headerText: 'white',
    contentBg: 'rgba(49, 49, 49, 0.02)',
    borderColor: 'var(--half_opacity_border)',
    borderRadius: '10px',
    backdropBlur: 'blur(10px)',
}

export const defaultButtonStyles = {
    controlsBorder: 'none',
    buttonBorder: '1px solid var(--half_opacity_border)',
    buttonBg: 'transparent',
    buttonHoverBg: 'var(--window-controls-hover, rgba(255, 255, 255, 0.1))',
    buttonTextColor: 'white',
    buttonHoverTextColor: 'white',
    controlsGap: '6px',
    controlsPadding: '2px'
}

export const windowThemes: WindowTheme[] = [
    {
        id: 'default',
        name: 'Стандартное стекло',
        description: 'Классическое полупрозрачное окно',
        previewColor: 'rgba(30, 30, 40, 0.7)',
        styles: defaultThemeStyles
    },
    {
        id: 'dark-solid',
        name: 'Тёмная сплошная',
        description: 'Классическое тёмное окно',
        previewColor: '#131313',
        styles: {
            windowBg: '#131313',
            headerBg: '#131313',
            headerText: '#fff',
            contentBg: '#131313',
            borderColor: '#333',
            borderRadius: '8px',
            backdropBlur: 'none',

        }
    },
]

export const windowButtonStyles: WindowButtonStyle[] = [
    {
        id: 'classic',
        name: 'Классические',
        description: 'Стандартные независимые кнопки с рамкой',
        styles: defaultButtonStyles
    },
    {
        id: 'unified',
        name: 'Совмещенные',
        description: 'Кнопки в общей рамке',
        styles: {
            ...defaultButtonStyles,
            controlsBorder: '1px solid var(--half_opacity_border)',
            buttonBorder: 'none',
        }
    },
    {
        id: 'modern',
        name: 'Современные',
        description: 'Кнопки с заливкой при наведении',
        styles: {
            ...defaultButtonStyles,
            buttonBorder: 'none',
            buttonBg: 'rgba(255, 255, 255, 0.05)',
            buttonHoverBg: 'rgba(30, 239, 111, 0.2)',
            buttonHoverTextColor: '#1eef6f',
            controlsGap: '8px',
            controlsPadding: '4px'
        }
    },
    {
        id: 'minimal',
        name: 'Минимальные',
        description: 'Прозрачные кнопки без рамок',
        styles: {
            ...defaultButtonStyles,
            buttonBorder: 'none',
            buttonBg: 'transparent',
            buttonHoverBg: 'rgba(30, 239, 111, 0.2)',
            buttonTextColor: 'rgba(255, 255, 255, 0.7)',
            buttonHoverTextColor: '#1eef6f',
            controlsGap: '4px',
            controlsPadding: '0'
        }
    },
]

// Ключи для localStorage
export const THEME_STORAGE_KEY = 'molo_window_theme'
export const BUTTON_STYLE_STORAGE_KEY = 'molo_button_style'
export const CUSTOM_THEMES_KEY = 'molo_custom_themes'
export const CUSTOM_BUTTON_STYLES_KEY = 'molo_custom_button_styles'

// Функции для работы с кастомными темами
export function getCustomThemes(): WindowTheme[] {
    try {
        const data = localStorage.getItem(CUSTOM_THEMES_KEY)
        return data ? JSON.parse(data) : []
    } catch {
        return []
    }
}

export function saveCustomTheme(theme: WindowTheme) {
    const themes = getCustomThemes()
    const index = themes.findIndex(t => t.id === theme.id)
    if (index >= 0) {
        themes[index] = theme
    } else {
        themes.push(theme)
    }
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes))
}

export function deleteCustomTheme(id: string) {
    const themes = getCustomThemes()
    const filtered = themes.filter(t => t.id !== id)
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(filtered))
}

export function getCustomButtonStyles(): WindowButtonStyle[] {
    try {
        const data = localStorage.getItem(CUSTOM_BUTTON_STYLES_KEY)
        return data ? JSON.parse(data) : []
    } catch {
        return []
    }
}

export function saveCustomButtonStyle(style: WindowButtonStyle) {
    const styles = getCustomButtonStyles()
    const index = styles.findIndex(s => s.id === style.id)
    if (index >= 0) {
        styles[index] = style
    } else {
        styles.push(style)
    }
    localStorage.setItem(CUSTOM_BUTTON_STYLES_KEY, JSON.stringify(styles))
}

export function deleteCustomButtonStyle(id: string) {
    const styles = getCustomButtonStyles()
    const filtered = styles.filter(s => s.id !== id)
    localStorage.setItem(CUSTOM_BUTTON_STYLES_KEY, JSON.stringify(filtered))
}

export function getAllThemes(): WindowTheme[] {
    return [...windowThemes, ...getCustomThemes()]
}

export function getAllButtonStyles(): WindowButtonStyle[] {
    return [...windowButtonStyles, ...getCustomButtonStyles()]
}