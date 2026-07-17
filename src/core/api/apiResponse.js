function isObject(value) {
    return !!value && typeof value === 'object';
}
export function unwrapApiResponse(response) {
    let current = response;
    for (let depth = 0; depth < 4; depth += 1) {
        if (!isObject(current))
            break;
        if ('data' in current && current.data !== undefined) {
            current = current.data;
            continue;
        }
        if ('value' in current && current.value !== undefined) {
            current = current.value;
            continue;
        }
        if ('result' in current && current.result !== undefined) {
            current = current.result;
            continue;
        }
        break;
    }
    return current;
}
export function unwrapListResponse(response) {
    const unwrapped = unwrapApiResponse(response);
    if (Array.isArray(unwrapped))
        return unwrapped;
    if (isObject(unwrapped)) {
        const items = unwrapped.items;
        if (Array.isArray(items))
            return items;
        const data = unwrapped.data;
        if (Array.isArray(data))
            return data;
        if (isObject(data) && Array.isArray(data.items))
            return data.items;
    }
    return [];
}
export function unwrapPagedResponse(response) {
    const unwrapped = unwrapApiResponse(response);
    if (Array.isArray(unwrapped)) {
        return { items: unwrapped, totalCount: unwrapped.length };
    }
    if (isObject(unwrapped)) {
        const items = Array.isArray(unwrapped.items) ? unwrapped.items : [];
        return {
            items,
            totalCount: typeof unwrapped.totalCount === 'number'
                ? unwrapped.totalCount
                : typeof unwrapped.total === 'number'
                    ? unwrapped.total
                    : items.length,
            pageNumber: typeof unwrapped.pageNumber === 'number' ? unwrapped.pageNumber : undefined,
            pageSize: typeof unwrapped.pageSize === 'number' ? unwrapped.pageSize : undefined,
            totalPages: typeof unwrapped.totalPages === 'number' ? unwrapped.totalPages : undefined,
        };
    }
    return { items: [], totalCount: 0 };
}
