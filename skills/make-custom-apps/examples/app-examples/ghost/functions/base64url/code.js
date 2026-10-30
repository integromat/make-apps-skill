function base64url(string, encoding) {
	return Buffer
		.from(string, encoding)
		.toString('base64')
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');
}