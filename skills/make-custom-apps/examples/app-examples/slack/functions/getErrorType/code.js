function getErrorType(statusCode) {
	if (statusCode === 429) {
		return 'RateLimitError'
	}
	return 'DataError'
}