export function diffDates(date1, date2) {
    let d1 = new Date(date1.getTime());
    let d2 = new Date(date2.getTime());
    if (d1 > d2)
        [d1, d2] = [d2, d1]; // ensure d1 <= d2
    let years = d2.getFullYear() - d1.getFullYear();
    let months = d2.getMonth() - d1.getMonth();
    let days = d2.getDate() - d1.getDate();
    if (days < 0) {
        months -= 1;
        // move to last day of previous month
        const prevMonth = new Date(d2.getFullYear(), d2.getMonth(), 0);
        days += prevMonth.getDate();
    }
    if (months < 0) {
        years -= 1;
        months += 12;
    }
    const diffMs = d2.getTime() - d1.getTime();
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(totalDays / 7);
    return { years, months, days, weeks, totalDays, hours, minutes, seconds };
}
export function parseDate(dateString) {
    if (!dateString)
        return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}
