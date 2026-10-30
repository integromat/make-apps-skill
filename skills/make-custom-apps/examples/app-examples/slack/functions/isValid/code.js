function isValid(body, headers) {
	if (body && body.ok) {
		return true
	}
	if (!headers) {
		return false
	}
	if (headers['content-disposition'] && headers['content-disposition'].startsWith('attachment')) {
		return true
	}
	if (headers['content-type'] === 'application/force-download') {
		return true
	}
	return false
}