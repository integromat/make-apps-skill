function isWebhookCondition(data, item) {
	throw new Error(JSON.stringify([data, item]))
	/*
	if (data) {
		if (item && item.data && item.data.event && item.data.event.type && data.event == item.data.event.type) {
			return true
		}
		return false
	} 
	return true
	*/
}