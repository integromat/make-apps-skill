function generateWorkspCustomFieldParams(fields) {
	// Is used to generate the custom field parameters dynamically of Create Task/Update Task
	if (!fields) return [];
	
	let outputArray = fields.map(field => {
		return iml.generateWorkspCustomFieldParam(field);
	}).filter(field => field !== null);
	
	outputArray = outputArray.filter(field => field)
	
	return outputArray;
}