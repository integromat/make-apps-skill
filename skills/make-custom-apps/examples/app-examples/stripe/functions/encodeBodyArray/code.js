function encodeBodyArray(arr, key) {
	if (!key || !arr || !Array.isArray(arr)) return {};
	let array = [...arr];
	return array.reduce((acc, cur, idx) => {
		if (typeof cur === 'object' && cur !== null) {
			Object.entries(cur).forEach(([k, v]) => {
				acc[`${key}[${idx}][${k}]`] = v;
			});
		} else {
			acc[`${key}[${idx}]`] = cur;
		}
		return acc;
	}, {});
}