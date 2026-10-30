function getMessage(messages) {
	if (!messages) {
		return null
	}
	let message = messages
	if (Array.isArray(messages)) {
		if (!messages.length) {
			return null
		}
		message = messages[0]
	}
	const msg = Object.assign({}, message)
	msg.date = new Date(parseInt(msg.ts, 10) * 1000)
	if (msg.files) {
		msg.files = msg.files.map(file => {
			return {
				id: file.id,
				title: file.title,
				url_private_download: file.url_private_download,
				size: file.size,
				name: file.name,
				mimetype: file.mimetype
			}
		})
	}
	return msg
}