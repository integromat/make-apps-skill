function encodeSearchFilter(filters) {
	if (!Array.isArray(filters) || !Array.isArray(filters[0])) return {};

	return filters[0].reduce((acc, filter) => {
		let [type, operator] = filter.o.split("::");
		let value = type === "date" ? iml.formatDate(filter.b, 'X') : filter.b;
		
		if (operator === "equal") {
			acc[filter.a] = value;
			return acc;
		}

		acc[`${filter.a}[${operator}]`] = value;
		return acc;
	}, {});
}