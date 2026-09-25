import type { Component } from 'vue'
import type { WindowSizeOptions } from '~/types/window'
import { PERMISSIONS, type PermissionKey } from '~/types/permissions'

export interface SystemWindowDefinition {
    component: () => Promise<Component>
    title: string
    size?: WindowSizeOptions
    modal?: boolean
    requiredPermission?: PermissionKey
}

export const SYSTEM_WINDOWS: Record<string, SystemWindowDefinition> = {
    'login': {
        component: () => import('~/layouts/company/enterprise/Login.vue'),
        title: 'Вход',
        size: { width: 480, height: 420 },
        modal: true,
    },
    'register': {
        component: () => import('~/layouts/company/enterprise/Register.vue'),
        title: 'Регистрация',
        size: { width: 980, height: 520 },
        modal: false,
    },
    'control': {
        component: () => import('~/layouts/company/enterprise/Control.vue'),
        title: 'Управление',
        size: { width: 900, height: 650 },
        requiredPermission: PERMISSIONS.CONTROL_PANEL,
    },
    'configurator': {
        component: () => import('~/layouts/company/enterprise/Configurator.vue'),
        title: 'Конфигуратор',
        size: { width: 900, height: 650 },
        requiredPermission: PERMISSIONS.ACCESS_MANAGE,
    },
    'workspace': {
        component: () => import('~/layouts/company/enterprise/Workspace.vue'),
        title: 'Пространство',
        size: { width: 1200, height: 700 },
        requiredPermission: PERMISSIONS.WORKSPACE_VIEW,
    },
    'directory': {
        component: () => import('~/layouts/company/enterprise/Directory.vue'),
        title: 'Справочники',
        size: { width: 1200, height: 800 },
        requiredPermission: PERMISSIONS.DIRECTORY_VIEW,
    },
    'browser': {
        component: () => import('~/layouts/modules/Browser.vue'),
        title: 'Модули',
        size: { width: 1000, height: 650 },
        requiredPermission: PERMISSIONS.MODULES_BROWSE,
    },
    'creature': {
        component: () => import('~/layouts/modules/Creature.vue'),
        title: 'Создание модуля',
        size: { width: 1200, height: 750 },
        requiredPermission: PERMISSIONS.MODULES_DEV,
    },
    'terms-of-use': {
        component: () => import('~/layouts/company/TermsOfUse.vue'),
        title: 'Условия использования',
        size: { width: 700, height: 600 },
    },
    'confirm': {
        component: () => import('~/layouts/settings/Confirm.vue'),
        title: 'Подтверждение',
        size: { width: 420, height: 220 },
        modal: true,
    },
    'customisation': {
        component: () => import('~/layouts/settings/Customisation.vue'),
        title: 'Кастомизация',
        size: { width: 800, height: 600 },
    },
    'documentation': {
        component: () => import('~/layouts/settings/Documentation.vue'),
        title: 'Документация',
        size: { width: 1400, height: 600 },
    },
    'standard': {
        component: () => import('~/layouts/settings/Standard.vue'),
        title: 'Стандарты отображения',
        size: { width: 800, height: 600 },
    },
    'dev:json': {
        component: () => import('~/components/devtools/MoloJSONTool.vue'),
        title: 'JSON',
        size: { width: 700, height: 500 },
    },
    'dev:regex': {
        component: () => import('~/components/devtools/MoloRegexTool.vue'),
        title: 'Regex',
        size: { width: 700, height: 500 },
    },
    'dev:encode': {
        component: () => import('~/components/devtools/MoloEncodeTool.vue'),
        title: 'Encode/Decode',
        size: { width: 650, height: 550 },
    },
    'dev:notes': {
        component: () => import('~/components/devtools/MoloNotesTool.vue'),
        title: 'Заметки',
        size: { width: 600, height: 500 },
    },
    'dev:calculator': {
        component: () => import('~/components/devtools/MoloCalculatorTool.vue'),
        title: 'Калькулятор',
        size: { width: 480, height: 480, minWidth: 420, minHeight: 420 },
    },
    'dev:clock': {
        component: () => import('~/components/devtools/MoloClockTool.vue'),
        title: 'Часы',
        size: { width: 560, height: 500 },
    },
    'dev:calendar': {
        component: () => import('~/components/devtools/MoloCalendarTool.vue'),
        title: 'Календарь',
        size: { width: 680, height: 520 },
    },
}

export function getSystemWindow(key: string): SystemWindowDefinition | null {
    return SYSTEM_WINDOWS[key] || null
}