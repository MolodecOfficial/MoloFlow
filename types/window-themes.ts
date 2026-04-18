export interface WindowTheme {
    id: string
    name: string
    description: string
    previewColor: string
    styles: {
        headerBg: string
        headerBorder: string
        headerText: string
        contentBg: string
        contentText: string
        borderColor: string
        borderRadius: string
        backdropBlur: string
        controlsBg: string
        controlsHover: string
        accentColor: string
    }
}

export interface WindowButtonStyle {
    id: string
    name: string
    description: string
    styles: {
        controlsBorder: string // для внешнего контейнера кнопок
        buttonBorder: string    // для самих кнопок
        buttonBg: string
        buttonHoverBg: string
        buttonTextColor: string
        buttonHoverTextColor?: string
        controlsGap: string
        controlsPadding: string
    }
}

export interface WindowTitleStyle {
    id: string
    name: string
    description: string
    isFullTitle: boolean
}

export const windowThemes: WindowTheme[] = [
    {
        id: 'default',
        name: 'Стандартная',
        description: 'Классическое полупрозрачное окно',
        previewColor: 'rgba(30, 30, 40, 0.7)',
        styles: {
            headerBg: 'var(--half_opacity_bg)',
            headerBorder: 'var(--half_opacity_border)',
            headerText: 'white',
            contentBg: 'var(--half_opacity_bg)',
            contentText: 'rgba(255, 255, 255, 0.9)',
            borderColor: 'var(--half_opacity_border)',
            borderRadius: '10px',
            backdropBlur: 'blur(10px)',
            controlsBg: 'rgba(255, 255, 255, 0.05)',
            controlsHover: 'rgba(255, 255, 255, 0.1)',
            accentColor: '#1eef6f'
        }
    },
    {
        id: 'dark-solid',
        name: 'Тёмная сплошная',
        description: 'Классическое тёмное окно',
        previewColor: '#1a1a1a',
        styles: {
            headerBg: '#1a1a1a',
            headerBorder: '#333',
            headerText: '#fff',
            contentBg: '#1a1a1a',
            contentText: '#fff',
            borderColor: '#333',
            borderRadius: '8px',
            backdropBlur: 'none',
            controlsBg: '#2a2a2a',
            controlsHover: '#3a3a3a',
            accentColor: '#4caf50'
        }
    },
]

export const windowButtonStyles: WindowButtonStyle[] = [
    {
        id: 'classic',
        name: 'Классические',
        description: 'Стандартные независимые кнопки с рамкой',
        styles: {
            controlsBorder: 'none',
            buttonBorder: '1px solid var(--half_opacity_border)',
            buttonBg: 'transparent',
            buttonHoverBg: 'var(--window-controls-hover, rgba(255, 255, 255, 0.1))',
            buttonTextColor: 'white',
            buttonHoverTextColor: 'white',
            controlsGap: '6px',
            controlsPadding: '2px'
        }
    },
    {
        id: 'unified',
        name: 'Совмещенные',
        description: 'Кнопки в общей рамке',
        styles: {
            controlsBorder: '1px solid var(--half_opacity_border)',
            buttonBorder: 'none',
            buttonBg: 'transparent',
            buttonHoverBg: 'var(--window-controls-hover, rgba(255, 255, 255, 0.1))',
            buttonTextColor: 'white',
            controlsGap: '6px',
            controlsPadding: '2px'
        }
    },
    {
        id: 'modern',
        name: 'Современные',
        description: 'Кнопки с заливкой при наведении',
        styles: {
            controlsBorder: 'none',
            buttonBorder: 'none',
            buttonBg: 'rgba(255, 255, 255, 0.05)',
            buttonHoverBg: 'rgba(30, 239, 111, 0.2)',
            buttonTextColor: 'white',
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
            controlsBorder: 'none',
            buttonBorder: 'none',
            buttonBg: 'transparent',
            buttonHoverBg: 'rgba(30, 239, 111, 0.2)',
            buttonTextColor: 'rgba(255, 255, 255, 0.7)',
            buttonHoverTextColor: '#1eef6f',
            controlsGap: '4px',
            controlsPadding: '0'
        }
    }
]

export const windowTitleStyles: WindowTitleStyle[] = [
    {
        id: 'full',
        name: 'Полное название',
        description: 'Полное название файла вместе с его путём расположения',
        isFullTitle: true,
    },
    {
        id: 'minimal',
        name: 'Название окна',
        description: 'Только название окна и ничего лишнего',
        isFullTitle: false,
    }

]

// Ключи для localStorage
export const THEME_STORAGE_KEY = 'molo_window_theme'
export const BUTTON_STYLE_STORAGE_KEY = 'molo_button_style'
export const TITLE_STYLE_STORAGE_KEY = 'molo_title_style'