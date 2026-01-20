export function generateComponentName(groupId: string, itemId: string): string {
    // Преобразуем: settings + enterprise = settingsEnterprise
    const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

    const groupParts = groupId.split('_').map(capitalize).join('');
    const itemParts = itemId.split('_').map(capitalize).join('');

    return `${groupParts}${itemParts}`;
}