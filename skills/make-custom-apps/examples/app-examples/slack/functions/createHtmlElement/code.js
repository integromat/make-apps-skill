function createHtmlElement (name, label, type, required, config) {
	const el = {name, label, type, required}
	if (config.options) {
		el.options = config.options.map(([label, value]) => ({label, value}))
	}
	return el
}