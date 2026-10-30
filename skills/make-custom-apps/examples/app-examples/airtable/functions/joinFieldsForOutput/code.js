function joinFieldsForOutput(qs,sort,fields) {
	let qsJoined = qs

	if (Array.isArray(sort)) {
		sort.forEach((item, idx) => {
			qsJoined[`sort[${idx}][field]`] = item.field;
			qsJoined[`sort[${idx}][direction]`] = item.direction;
		});
	}
	if (Array.isArray(fields)) {
		fields.forEach((item, idx) => {
			qsJoined[`fields[${idx}]`] = item;
		});
	}

	return qsJoined;
}