export function formatMoney(value, currency = 'USD', locale = 'es-CR') {
    const amount = Number(value ?? 0);
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(amount);
    }
    catch {
        return `${currency} ${amount.toLocaleString(locale, { maximumFractionDigits: 2 })}`;
    }
}
export function formatDate(value, locale = 'es-CR') {
    if (!value)
        return '—';
    const datePart = value.slice(0, 10);
    const [year, month, day] = datePart.split('-').map(Number);
    if (!year || !month || !day)
        return value;
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(new Date(year, month - 1, day));
}
export function toDateInput(value) {
    return value?.slice(0, 10) ?? '';
}
export function calculateMargin(cost, sale) {
    return sale <= 0 ? 0 : Number((((sale - cost) / sale) * 100).toFixed(2));
}
export function minimumSale(cost, margin = 12) {
    if (cost <= 0)
        return 0;
    return Number((cost / (1 - margin / 100)).toFixed(2));
}
export function marginTone(margin) {
    if (margin >= 12)
        return 'success';
    if (margin >= 0)
        return 'warning';
    return 'danger';
}
export function statusTone(status) {
    if (status === 'Approved' || status === 'AcceptedByClient' || status === 'Created')
        return 'success';
    if (status === 'Sent')
        return 'primary';
    if (status === 'Pending' || status === 'PendingApproval' || status === 'Draft')
        return 'warning';
    if (status === 'Rejected' || status === 'RejectedByClient' || status === 'Expired')
        return 'danger';
    return 'neutral';
}
export function detailGroup(type) {
    if (type === 'AgentCharge')
        return 'agent';
    if (type === 'Freight')
        return 'freight';
    if (type === 'DestinationCharge' || type === 'InlandTransport')
        return 'destination';
    return 'other';
}
export function routeLabel(rate) {
    return [rate.polName, rate.poeName, rate.podName].filter(Boolean).join(' → ');
}
export function createCorrelationId() {
    return `pricing-web-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}
