function generalResponse(obj) {

    if (!obj) return null;

    for (let [key, value] of Object.entries(obj)) {
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{2}:\d{2}$/.test(value) && typeof value === 'string') {
            obj[key] = iml.parseDate(value);
        }
        else if (/^\d{4}-\d{2}-\d{2}$/.test(value) && typeof value === 'string') {
            obj[key] = iml.parseDate(value);
        }
        else if (typeof value === 'object' && !(value instanceof Date)) {
            obj[key] = generalResponse(value);
        }
    }

    return obj;
}