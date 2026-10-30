function applySort(qs, sort) {
	if (!sort || !Array.isArray(sort)) return qs;
	
	sort.forEach((item, idx) => {
		qs[`sort[${idx}][field]`] = item.field;
		qs[`sort[${idx}][direction]`] = item.direction;
	});
	
	return qs;
}