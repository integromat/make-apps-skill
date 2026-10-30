function isWebhookEvent(data, params) {
	if (!params || !params.event) {
		return true
	}
	return params.event === data.event.type
}
