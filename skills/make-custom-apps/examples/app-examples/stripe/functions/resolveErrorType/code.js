function resolveErrorType(type) {
	switch (type) {
		case 'card_error': return 'DataError';
		case 'rate_limit_error': return 'RateLimitError';
		case 'invalid_request_error': return 'DataError';
		case 'api_error': return 'ConnectionError';
		case 'api_connection_error': return 'ConnectionError';
		case 'authentication_error': return 'InvalidConfigurationError';
	}
	return 'RuntimeError';
}