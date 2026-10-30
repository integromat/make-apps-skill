function generateTaskCustomFieldParams(fields) {
	// Is used to generate the custom field parameters dynamically of Create Task/Update Task
	if (!fields) return [];
	
	let outputArray = fields.map(field => {
		return iml.generateTaskCustomFieldParam(field);
	}).filter(field => field !== null);
	
	let customFieldsObject = {}
	
	customFieldsObject.name = "task_custom_fields";
	customFieldsObject.label= "Task Custom Fields";
	customFieldsObject.type = "collection";
	customFieldsObject.help = "Task specific custom fields that can be added to the task.";
	customFieldsObject.spec = outputArray;
	
	return customFieldsObject;
}