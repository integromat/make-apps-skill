function processRecord(record, schema) {
  const fieldMap = Array.isArray(schema)
    ? iml.toCollection(schema, 'label', 'name')
    : undefined;
  const fields = Object.entries(record.fields).reduce((acc, [key, value]) => {
    acc[fieldMap ? fieldMap[key] : key] = value;
    return acc;
  }, {});
  return Object.assign(fields, {
    id: record.id,
    createdTime: record.createdTime
  });
}
