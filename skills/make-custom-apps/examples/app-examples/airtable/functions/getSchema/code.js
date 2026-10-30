function getSchema(body, name, _for, _filterIn, useColumnId, fields) {
  const columns = body.tables.find(
    (table) => table.name === name || table.id === name
  ).fields;
  if (!columns) return;

  if (_filterIn && !Array.isArray(_filterIn)) {
    _filterIn = [_filterIn];
  }
  if (Array.isArray(_filterIn)) {
    _filterIn = _filterIn.map((item) => item.toLowerCase());
  }
  if (!_filterIn || !_filterIn.length) {
    _filterIn = null;
  }

  //This array is made to store types for read-only fields, to filter out them and avoid their appearance in the module's mappable params
  const readOnlyFieldTypes = ['aiText', 'autoNumber', 'button', 'count', 'createdBy', 'createdTime', 'formula',
                              'lastModifiedBy', 'lastModifiedTime', 'externalSyncSource', 'lookup', 'rollup'];

  const result = columns
    .map((col) => {
      if ((_for !== 'interface' && _for !== 'rpc') && readOnlyFieldTypes.includes(col.type)) {return;}
      let field = { name: col.name, label: col.name, type: 'text' };
      if (typeof useColumnId !== 'undefined' && useColumnId) {
        field.name = col.id;
      }
      if (_filterIn && !_filterIn.includes(col.type.toLowerCase())) {
        return;
      }

      if(_for === 'interface' && fields?.length) {
        if(fields.includes(col.name)) {
          field = iml.getSchemaFieldSpecs(col, field, _for);
          return field;
        } else {
          return undefined;
        }
      }

      field = iml.getSchemaFieldSpecs(col, field, _for);
      return field;
    })
    .filter((field) => !!field);

  if (_for === 'interface') {
    result.unshift(
      {
        name: 'id',
        type: 'text',
        label: 'ID'
      },
      {
        name: 'createdTime',
        type: 'date',
        label: 'Created Time'
      }
    );
  } else if (_for === 'rpc') {
    return result.map((item) => ({ label: item.label, value: item.name }));
  }
  return result;
}
