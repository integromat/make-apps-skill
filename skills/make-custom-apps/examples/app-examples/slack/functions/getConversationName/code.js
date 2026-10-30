function getConversationName(item, users) {
	if (Array.isArray(item)) return item.map(i => iml.getConversationName(i, users));
	
	let label = item.name
	let value = item.id
	
	if (item.is_im) {
		if (users[item.user]) {
			label = users[item.user]
		} else {
			label = item.user
		}
	}
	return {
		label,
		value
	}
}