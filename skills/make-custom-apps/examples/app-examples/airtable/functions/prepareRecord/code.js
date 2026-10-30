function prepareRecord(record) {
	const meta = metadata.expect.find(param => param.name === 'record');
	if (!meta) return record;
	
	meta.spec.forEach(param => {

		if (param.type === 'date' && param.time === false && record[param.name] !== null) {
			// Make sure we send date without time with correct format
			record[param.name] = iml.formatDate(record[param.name], 'YYYY-MM-DD', environment.timezone);
		} else if (param.type === 'collection' && record[param.name] && Object.keys(record[param.name]).length === 0) {
			// Remove empty collections (types: barcode, singleCollaborator)
			delete record[param.name];
		} else if (param.type === 'collection' && record[param.name] && (record[param.name].email === null || record[param.name].text === null)) {
			// Add support for erasing fields (types: barcode, singleCollaborator)
			record[param.name] = null;
		} else if (param.type === 'array' && Array.isArray(record[param.name])) {
			record[param.name] = record[param.name].filter(elem => {
				// Let primitive or null values pass
				if (typeof elem !== "object" || elem === null) return true;
				// Remove empty collections
				if (Object.keys(elem).length === 0) return false;
				// Remove collections contain filename but not url
				if (elem.filename && !elem.url) return false;
				return true;
			});
		}

	});
	return record;
}