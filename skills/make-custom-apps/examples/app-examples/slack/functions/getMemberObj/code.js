function getMemberObj(members) {
	const ids = {}
	;(members || []).forEach(user => {
		ids[user.id] = user.name
	})
	return ids
}