function getWebhookBody (body) {
    if (!body || !body.authorizations || !body.authorizations.length) {
        return []
    }
	const auths = body.authorizations
	// delete body.authorizations
    return auths.map(auth => {
        return {
            uid: auth.user_id,
            data: body
        }
    })
}