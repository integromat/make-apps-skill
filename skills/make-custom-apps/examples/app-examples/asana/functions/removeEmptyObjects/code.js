function removeEmptyObjects(src) {
	if (src && typeof src === 'object') {
		Object.keys(src).forEach(key => {
			if (src[key] && typeof src[key] === 'object') {
				iml.removeEmptyObjects(src[key]);
				if (Object.keys(src[key]).length === 0 && src[key].constructor === Object) {
				  delete src[key];
				}
			}
		});
	}
	return src;
}