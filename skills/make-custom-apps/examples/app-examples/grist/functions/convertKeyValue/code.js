function convertKeyValue(records = []) {
    // convert fields array of key value objects to object
    records.forEach(i => ((i.fields = i.fields.reduce((acc, c) => ((acc[c.key] = c.value), acc), {}))))
    return records;
}