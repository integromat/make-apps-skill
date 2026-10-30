function getStatusFields(statusText, statusEmoji, statusExpiration) {
	const profile = {
		status_text: statusText,
		status_emoji: statusEmoji
	}
	if (statusExpiration !== undefined) {
		if (statusExpiration === null) {
			profile.status_expiration = null
		}
		profile.status_expiration = Math.floor(statusExpiration.getTime() / 1000)
	}
	return JSON.stringify(profile)
}