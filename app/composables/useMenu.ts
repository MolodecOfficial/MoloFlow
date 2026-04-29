export const useMenu = () => {
    const config = useRuntimeConfig();

    const getMenu = async (role?: string) => {
        const url = role
            ? `/api/menu?role=${role}&type=menu`
            : '/api/menu?type=menu';

        const { data } = await useFetch(url);
        return data.value;
    };

    const initDefaultMenu = async () => {
        const { data } = await useFetch('/api/menu/init', {
            method: 'POST'
        });
        return data.value;
    };

    const createGroup = async (groupData: any) => {
        const { data } = await useFetch('/api/menu', {
            method: 'POST',
            body: {
                action: 'createGroup',
                ...groupData
            }
        });
        return data.value;
    };

    const addMenuItem = async (groupId: string, itemData: any) => {
        const { data } = await useFetch('/api/menu', {
            method: 'POST',
            body: {
                action: 'addItem',
                groupId,
                ...itemData
            }
        });
        return data.value;
    };

    const deleteGroup = async (groupId: string) => {
        const { data } = await useFetch(`/api/menu/${groupId}`, {
            method: 'DELETE'
        });
        return data.value;
    };

    const deleteMenuItem = async (groupId: string, itemId: string) => {
        const { data } = await useFetch(`/api/menu/${groupId}?itemId=${itemId}`, {
            method: 'DELETE'
        });
        return data.value;
    };

    return {
        getMenu,
        initDefaultMenu,
        createGroup,
        addMenuItem,
        deleteGroup,
        deleteMenuItem
    };
};