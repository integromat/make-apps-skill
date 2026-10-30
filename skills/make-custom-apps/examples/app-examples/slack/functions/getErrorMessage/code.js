function getErrorMessage(body, statusCode) {
	if (body && body.error) {
		let err = `Error: ${body.error} (${statusCode}).`
		if (body.response_metadata && body.response_metadata.messages && body.response_metadata.messages.length) {
			err = err + body.response_metadata.messages.join(' ')
		}
		if (body.errors && body.errors.length) {
			err += body.errors.map(e => {
				if (e.error && e.user && !e.ok) {
					return ' ' + e.user + ' ' + e.error + '.'
				}
			}).join('')
		}
		return err
	}
	return `Error: (${statusCode}).`
}