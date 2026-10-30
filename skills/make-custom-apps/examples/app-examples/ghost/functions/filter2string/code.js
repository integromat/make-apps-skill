function filter2string(filter, parentPath) {

	// wraps a text value in quotes if there's at least one space character
	function wrapInQuotes(text) {
		if (text.split(' ').length > 1) {
			return `'${text}'`
		}

		return text
	} 

    if (!Array.isArray(filter)) return filter;
    return filter.map(or => or.map(and => {
		let [type, column] = and.a.split("::");
		
		column = parentPath ? column.replace(parentPath, '') : column;
		
		if (type === "bool") return `${column}${and.o}${and.b}`;
		if (type === "text") return `${column}${and.o}${wrapInQuotes(and.b.replace(/'/g, "\\'").replace(/"/g, "\\\""))}`;
		if (type === "date") return `${column}${and.o}'${iml.formatDate(and.b, 'YYYY-MM-DD HH:mm:ss')}'`;
	}).join('+')).join(',');
}