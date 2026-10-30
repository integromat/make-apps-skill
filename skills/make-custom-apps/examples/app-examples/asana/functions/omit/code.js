function omit(collection, ...parameters) {
	const result = {};
	
	for (let key in collection) {
		if (!parameters.includes(key)) {
			result[key] = collection[key];
		}
	}
	
	return result;
}