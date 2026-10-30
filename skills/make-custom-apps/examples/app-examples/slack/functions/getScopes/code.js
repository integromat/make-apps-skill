function getScopes(scopes, env) {
	const ALL_SCOPES = [
		'channels:read',
		'dnd:read',
		'groups:read', 
		'groups:write',
		'im:read', 
		'im:write', 
		'mpim:read', 
		'mpim:write', 
		'reactions:read',
		'reactions:write',
		'reminders:read',
		'reminders:write',
		'users:read',
		'chat:write',
		'pins:read',
		'pins:write',
		'files:read',
		'files:write',
		'channels:history',
		'groups:history',
		'im:history',
		'mpim:history'
	]
	const SCOPES = {
		bot: [
			...ALL_SCOPES,
			'channels:manage',
			'chat:write.public',
			'chat:write.customize'
		],
		user: [
			...ALL_SCOPES,
			'channels:write',
			'dnd:write',
			'identity.basic',
			'stars:write',
			'users:read.email',
			'users.profile:write',
			'search:read',
			'stars:read',
			'admin.users:write',
			'admin.teams:read',
			'admin.conversations:read'
		]
	}
	const s = scopes.map(e => {if (e === 'chat:write:bot') {return 'chat:write'} else {return e}})
	return s.filter(scope => SCOPES[env].includes(scope))
}
