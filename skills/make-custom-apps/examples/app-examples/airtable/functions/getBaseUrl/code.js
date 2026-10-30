function getBaseUrl(connection, baseUrl) {
    if (connection != null && connection.proxy != null) {
		switch (connection.proxy) {
			case 'sync-inc':
		        return 'https://proxy.syncinc.so/' + baseUrl;
			default:
		}
    }
	return 'https://' + baseUrl;
}