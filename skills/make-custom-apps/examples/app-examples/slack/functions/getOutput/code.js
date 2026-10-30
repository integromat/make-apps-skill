function getOutput(body) {
	if (!body) {
		return 
	}
	delete body.ok
	const DATE_COLS = [
		'created',
		'updated',
		'last_read',
		'time',
		'complete_ts',
		'post_at',
		'date_create',
		'date_created',
		'next_dnd_start_ts',
		'next_dnd_end_ts',
		'snooze_endtime'
	]
	
	Object.keys(body).forEach(key => {
		if (DATE_COLS.includes(key) && parseInt(body[key], 10) !== 0) {
			body[key] = iml.parseDate(body[key])
		}
		if (typeof body[key] === "object" && body[key] !== null) {
			body[key] = iml.getOutput(body[key])
		}
	})
	return body
}