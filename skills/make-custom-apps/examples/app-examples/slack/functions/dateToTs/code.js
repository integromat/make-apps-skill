function dateToTs(date) {
	if (!date) {
		return date
	}
	return Math.round(date.getTime() / 1000)
}