function prepareColumns(columns) {
  if (Array.isArray(columns)) {
    return columns;
  };

    return Object.keys(columns).map(name => {
        return {
            column: name,
            value: columns[name]
        }
    })
}