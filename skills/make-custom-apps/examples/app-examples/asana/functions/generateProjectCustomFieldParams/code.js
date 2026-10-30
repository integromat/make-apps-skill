function generateProjectCustomFieldParams(fields) {
	// Is used to generate the custom field parameters dynamically of Create Task/Update Task
	if (!fields) return [];
	
	let outputArray = fields.map(field => {
		return iml.generateProjectCustomFieldParam(field);
	}).filter(field => field !== null);
	
	let customFieldsObject = {}
	
	customFieldsObject.name = "custom_fields";
	customFieldsObject.label= "Project Custom Fields";
	customFieldsObject.type = "collection";
	customFieldsObject.help = "Project specific custom fields that can be added to the task.";
	customFieldsObject.spec = outputArray;
	
	return customFieldsObject;
}