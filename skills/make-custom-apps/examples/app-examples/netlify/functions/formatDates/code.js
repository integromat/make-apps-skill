function formatDates(item) {
    if (item.updated_at) {
        item.last_modified = iml.parseDate(item.last_modified);
    }

    if (item.last_active) {
        item.last_active = iml.parseDate(item.last_active);
    }

    if (item.created_at) {
        item.created = iml.parseDate(item.created);
    }

    if (item.submitted_to) {
        item.submitted_to = iml.parseDate(item.submitted_to);
    }

    if (item.approved_to) {
        item.approved_to = iml.parseDate(item.approved_to);
    }

    if (item.receivers) {
        item.receivers.forEach(i => {
            i = iml.formatDates(i);
        });
    }

    return item;
}