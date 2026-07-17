import { onBeforeUnmount, onMounted } from 'vue';
export function useViewShortcuts(options) {
    let refreshTimer;
    let runningRefresh = false;
    let pendingRefresh = false;
    const debounceMs = options.debounceMs ?? 250;
    const autoRefresh = options.autoRefresh ?? true;
    async function run(handler) {
        if (!handler)
            return;
        await handler();
    }
    async function runRefresh() {
        const handler = options.refresh ?? options.save;
        if (!handler)
            return;
        if (runningRefresh) {
            pendingRefresh = true;
            return;
        }
        runningRefresh = true;
        try {
            await handler();
        }
        finally {
            runningRefresh = false;
            if (pendingRefresh) {
                pendingRefresh = false;
                window.setTimeout(() => {
                    void runRefresh();
                }, debounceMs);
            }
        }
    }
    function handleCreate() {
        void run(options.create);
    }
    function handleSave() {
        void run(options.save ?? options.refresh);
    }
    function handleRefresh() {
        void runRefresh();
    }
    function handleDataChanged() {
        if (!autoRefresh)
            return;
        if (refreshTimer) {
            window.clearTimeout(refreshTimer);
        }
        refreshTimer = window.setTimeout(() => {
            void runRefresh();
        }, debounceMs);
    }
    onMounted(() => {
        window.addEventListener('dhole:create', handleCreate);
        window.addEventListener('dhole:save', handleSave);
        window.addEventListener('dhole:refresh', handleRefresh);
        window.addEventListener('dhole:data:changed', handleDataChanged);
    });
    onBeforeUnmount(() => {
        if (refreshTimer) {
            window.clearTimeout(refreshTimer);
        }
        window.removeEventListener('dhole:create', handleCreate);
        window.removeEventListener('dhole:save', handleSave);
        window.removeEventListener('dhole:refresh', handleRefresh);
        window.removeEventListener('dhole:data:changed', handleDataChanged);
    });
}
