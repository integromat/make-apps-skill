function getViews(body, name) {
	const views = body.tables.find(table => table.name === name || table.id === name).views;
	if (!views) return;
	
	return views.map(view => ({label: view.name, value: view.id}));
}