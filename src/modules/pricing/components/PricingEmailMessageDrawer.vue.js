import { computed, onMounted, ref } from 'vue';
import { AlertTriangle, ExternalLink, FileText, Mail, Paperclip, RefreshCw, } from 'lucide-vue-next';
import { DhBadge, DhButton } from '@/shared/components/atoms';
import { useToastStore } from '@/core/stores/toastStore';
import { EmailExtractionService } from '@/core/services/emailExtractionService';
const props = defineProps();
const toastStore = useToastStore();
const current = ref(null);
const loading = ref(false);
const reprocessing = ref(false);
const canReprocess = computed(() => current.value?.status === 'NeedsReview' || current.value?.status === 'Failed');
const bodyPreview = computed(() => {
    if (!current.value)
        return '';
    if (current.value.bodyText?.trim())
        return current.value.bodyText.trim();
    if (!current.value.bodyHtml?.trim())
        return '';
    return new DOMParser().parseFromString(current.value.bodyHtml, 'text/html').body.textContent?.trim() ?? '';
});
function messageStatusLabel(status) {
    return {
        Received: 'Recibido',
        Queued: 'En cola',
        Processing: 'Procesando',
        Extracted: 'Extraído',
        NeedsReview: 'Necesita revisión',
        Ignored: 'Ignorado',
        Duplicated: 'Duplicado',
        Failed: 'Fallido',
    }[status] ?? status;
}
function jobStatusLabel(status) {
    return {
        Pending: 'Pendiente',
        Processing: 'Procesando',
        SentToPricing: 'Enviado a Pricing',
        NeedsReview: 'Necesita revisión',
        Failed: 'Fallido',
        Ignored: 'Ignorado',
    }[status] ?? status;
}
function statusVariant(status) {
    if (status === 'Extracted' || status === 'SentToPricing')
        return 'success';
    if (status === 'Failed')
        return 'danger';
    if (status === 'NeedsReview' || status === 'Queued' || status === 'Pending')
        return 'warning';
    if (status === 'Processing')
        return 'primary';
    return 'neutral';
}
function formatDateTime(value) {
    if (!value)
        return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return value;
    return new Intl.DateTimeFormat('es-CR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}
function formatSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
async function load() {
    try {
        loading.value = true;
        current.value = await EmailExtractionService.getMessage(props.message.id);
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo cargar el detalle del correo.');
    }
    finally {
        loading.value = false;
    }
}
async function reprocess() {
    if (!canReprocess.value)
        return;
    try {
        reprocessing.value = true;
        await EmailExtractionService.reprocessMessage(props.message.id);
        toastStore.success('Correo enviado a reproceso', 'Se crearon nuevos trabajos de extracción. La bandeja se actualizará automáticamente.');
        await load();
        await props.onReprocessed?.();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo reprocesar el correo.');
    }
    finally {
        reprocessing.value = false;
    }
}
onMounted(load);
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-6" },
});
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-liquid rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex min-w-0 gap-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] dh-bg-primary-soft text-[var(--dh-primary)]" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-bg-primary-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Mail} */
Mail;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-5 w-5" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-5 w-5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "min-w-0" },
});
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    label: (__VLS_ctx.messageStatusLabel(__VLS_ctx.current?.status ?? __VLS_ctx.message.status)),
    variant: (__VLS_ctx.statusVariant(__VLS_ctx.current?.status ?? __VLS_ctx.message.status)),
}));
const __VLS_7 = __VLS_6({
    label: (__VLS_ctx.messageStatusLabel(__VLS_ctx.current?.status ?? __VLS_ctx.message.status)),
    variant: (__VLS_ctx.statusVariant(__VLS_ctx.current?.status ?? __VLS_ctx.message.status)),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
if (__VLS_ctx.current?.classificationConfidence != null) {
    let __VLS_10;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
        label: (`${__VLS_ctx.current.classificationConfidence.toFixed(1)}% confianza`),
        variant: "neutral",
    }));
    const __VLS_12 = __VLS_11({
        label: (`${__VLS_ctx.current.classificationConfidence.toFixed(1)}% confianza`),
        variant: "neutral",
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "mt-3 break-words text-xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['break-words']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.current?.subject ?? __VLS_ctx.message.subject);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 break-all text-sm font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['break-all']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.current?.fromName || __VLS_ctx.message.fromName || 'Remitente sin nombre');
(__VLS_ctx.current?.fromAddress ?? __VLS_ctx.message.fromAddress);
if (__VLS_ctx.canReprocess) {
    let __VLS_15;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
        ...{ 'onClick': {} },
        label: "Reprocesar",
        icon: (__VLS_ctx.RefreshCw),
        variant: "secondary",
        size: "sm",
        loading: (__VLS_ctx.reprocessing),
    }));
    const __VLS_17 = __VLS_16({
        ...{ 'onClick': {} },
        label: "Reprocesar",
        icon: (__VLS_ctx.RefreshCw),
        variant: "secondary",
        size: "sm",
        loading: (__VLS_ctx.reprocessing),
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    let __VLS_20;
    const __VLS_21 = {
        /** @type {typeof __VLS_20.click} */
        onClick: (__VLS_ctx.reprocess),
    };
    var __VLS_18;
    var __VLS_19;
}
if (__VLS_ctx.loading && !__VLS_ctx.current) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "py-12 text-center font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['py-12']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
}
else if (__VLS_ctx.current) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "grid gap-3 sm:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.formatDateTime(__VLS_ctx.current.receivedAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 break-all font-semibold text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.current.toAddresses || '—');
    if (__VLS_ctx.current.classificationReason || __VLS_ctx.current.errorMessage) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "rounded-[26px] border p-5" },
            ...{ class: (__VLS_ctx.current.errorMessage
                    ? 'border-red-500/20 bg-red-500/10'
                    : 'border-amber-500/20 bg-amber-500/10') },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        let __VLS_22;
        /** @ts-ignore @type { | typeof __VLS_components.AlertTriangle} */
        AlertTriangle;
        // @ts-ignore
        const __VLS_23 = __VLS_asFunctionalComponent1(__VLS_22, new __VLS_22({
            ...{ class: "mt-0.5 h-5 w-5 shrink-0" },
            ...{ class: (__VLS_ctx.current.errorMessage ? 'text-red-500' : 'text-amber-600') },
        }));
        const __VLS_24 = __VLS_23({
            ...{ class: "mt-0.5 h-5 w-5 shrink-0" },
            ...{ class: (__VLS_ctx.current.errorMessage ? 'text-red-500' : 'text-amber-600') },
        }, ...__VLS_functionalComponentArgsRest(__VLS_23));
        /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
            ...{ class: "font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-soft)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
        (__VLS_ctx.current.errorMessage || __VLS_ctx.current.classificationReason);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-3 flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    let __VLS_27;
    /** @ts-ignore @type { | typeof __VLS_components.Paperclip} */
    Paperclip;
    // @ts-ignore
    const __VLS_28 = __VLS_asFunctionalComponent1(__VLS_27, new __VLS_27({
        ...{ class: "h-4 w-4 text-[var(--dh-primary)]" },
    }));
    const __VLS_29 = __VLS_28({
        ...{ class: "h-4 w-4 text-[var(--dh-primary)]" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_28));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    let __VLS_32;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent1(__VLS_32, new __VLS_32({
        label: (String(__VLS_ctx.current.attachments.length)),
        variant: "neutral",
    }));
    const __VLS_34 = __VLS_33({
        label: (String(__VLS_ctx.current.attachments.length)),
        variant: "neutral",
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    if (__VLS_ctx.current.attachments.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-2" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
        for (const [attachment] of __VLS_vFor((__VLS_ctx.current.attachments))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (attachment.id),
                ...{ class: "flex items-center justify-between gap-3 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex min-w-0 items-center gap-3" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            let __VLS_37;
            /** @ts-ignore @type { | typeof __VLS_components.FileText} */
            FileText;
            // @ts-ignore
            const __VLS_38 = __VLS_asFunctionalComponent1(__VLS_37, new __VLS_37({
                ...{ class: "h-5 w-5 shrink-0 text-[var(--dh-primary)]" },
            }));
            const __VLS_39 = __VLS_38({
                ...{ class: "h-5 w-5 shrink-0 text-[var(--dh-primary)]" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_38));
            /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "min-w-0" },
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "truncate font-black text-[var(--dh-text)]" },
            });
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
            (attachment.fileName);
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
            (attachment.sourceFileType);
            (__VLS_ctx.formatSize(attachment.sizeBytes));
            let __VLS_42;
            /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
            DhBadge;
            // @ts-ignore
            const __VLS_43 = __VLS_asFunctionalComponent1(__VLS_42, new __VLS_42({
                label: (attachment.status),
                variant: (__VLS_ctx.statusVariant(attachment.status)),
            }));
            const __VLS_44 = __VLS_43({
                label: (attachment.status),
                variant: (__VLS_ctx.statusVariant(attachment.status)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_43));
            // @ts-ignore
            [messageStatusLabel, current, current, current, current, current, current, current, current, current, current, current, current, current, current, current, current, current, current, current, current, message, message, message, message, message, statusVariant, statusVariant, canReprocess, RefreshCw, reprocessing, reprocess, loading, formatDateTime, formatSize,];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "rounded-[22px] bg-black/[0.025] p-4 text-sm font-semibold text-[var(--dh-text-muted)] dark:bg-white/[0.04]" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-black/[0.025]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.04]']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "mb-3 font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    if (__VLS_ctx.current.jobs.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        for (const [job] of __VLS_vFor((__VLS_ctx.current.jobs))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
                key: (job.id),
                ...{ class: "rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:items-start']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            let __VLS_47;
            /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
            DhBadge;
            // @ts-ignore
            const __VLS_48 = __VLS_asFunctionalComponent1(__VLS_47, new __VLS_47({
                label: (__VLS_ctx.jobStatusLabel(job.status)),
                variant: (__VLS_ctx.statusVariant(job.status)),
            }));
            const __VLS_49 = __VLS_48({
                label: (__VLS_ctx.jobStatusLabel(job.status)),
                variant: (__VLS_ctx.statusVariant(job.status)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_48));
            let __VLS_52;
            /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
            DhBadge;
            // @ts-ignore
            const __VLS_53 = __VLS_asFunctionalComponent1(__VLS_52, new __VLS_52({
                label: (job.sourceType === 'Body' ? 'Cuerpo del correo' : 'Adjunto'),
                variant: "neutral",
            }));
            const __VLS_54 = __VLS_53({
                label: (job.sourceType === 'Body' ? 'Cuerpo del correo' : 'Adjunto'),
                variant: "neutral",
            }, ...__VLS_functionalComponentArgsRest(__VLS_53));
            if (job.confidenceScore != null) {
                let __VLS_57;
                /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
                DhBadge;
                // @ts-ignore
                const __VLS_58 = __VLS_asFunctionalComponent1(__VLS_57, new __VLS_57({
                    label: (`${job.confidenceScore.toFixed(1)}%`),
                    variant: "neutral",
                }));
                const __VLS_59 = __VLS_58({
                    label: (`${job.confidenceScore.toFixed(1)}%`),
                    variant: "neutral",
                }, ...__VLS_functionalComponentArgsRest(__VLS_58));
            }
            if (job.errorMessage) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "mt-3 text-sm font-semibold text-red-600 dark:text-red-400" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
                /** @type {__VLS_StyleScopedClasses['dark:text-red-400']} */ ;
                (job.errorMessage);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "mt-2 text-xs font-semibold text-[var(--dh-text-muted)]" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
            (__VLS_ctx.formatDateTime(job.startedAt));
            (__VLS_ctx.formatDateTime(job.finishedAt));
            if (job.pricingImportBatchId) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "mt-2 break-all text-xs font-bold text-[var(--dh-text-soft)]" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
                (job.pricingImportBatchId);
            }
            if (job.pricingImportBatchId) {
                let __VLS_62;
                /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
                DhButton;
                // @ts-ignore
                const __VLS_63 = __VLS_asFunctionalComponent1(__VLS_62, new __VLS_62({
                    ...{ 'onClick': {} },
                    label: "Ver en Pricing",
                    icon: (__VLS_ctx.ExternalLink),
                    size: "sm",
                }));
                const __VLS_64 = __VLS_63({
                    ...{ 'onClick': {} },
                    label: "Ver en Pricing",
                    icon: (__VLS_ctx.ExternalLink),
                    size: "sm",
                }, ...__VLS_functionalComponentArgsRest(__VLS_63));
                let __VLS_67;
                const __VLS_68 = {
                    /** @type {typeof __VLS_67.click} */
                    onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading && !__VLS_ctx.current))
                            return;
                        if (!(__VLS_ctx.current))
                            return;
                        if (!(__VLS_ctx.current.jobs.length))
                            return;
                        if (!(job.pricingImportBatchId))
                            return;
                        __VLS_ctx.onOpenPricing?.(job.pricingImportBatchId);
                        // @ts-ignore
                        [current, current, statusVariant, formatDateTime, formatDateTime, jobStatusLabel, ExternalLink, onOpenPricing,];
                    },
                };
                var __VLS_65;
                var __VLS_66;
            }
            // @ts-ignore
            [];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "rounded-[22px] bg-black/[0.025] p-4 text-sm font-semibold text-[var(--dh-text-muted)] dark:bg-white/[0.04]" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-black/[0.025]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.04]']} */ ;
    }
    if (__VLS_ctx.bodyPreview) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
            ...{ class: "font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm font-medium leading-6 text-[var(--dh-text-soft)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-h-64']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
        (__VLS_ctx.bodyPreview);
    }
}
// @ts-ignore
[bodyPreview, bodyPreview,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
