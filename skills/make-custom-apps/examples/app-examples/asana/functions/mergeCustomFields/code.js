function mergeCustomFields(parameters) {
	let customFieldsObject = {}

	if (parameters["task_custom_fields"] && typeof parameters["task_custom_fields"] === 'object' ) {
		Object.keys(parameters["task_custom_fields"]).forEach(key =>{
			customFieldsObject[key] = parameters["task_custom_fields"][key]
		});
	
	}
	
	if (parameters["workspace_custom_fields"] && typeof parameters["workspace_custom_fields"] === 'object' ) {
		Object.keys(parameters["workspace_custom_fields"]).forEach(key =>{
			customFieldsObject[key] = parameters["workspace_custom_fields"][key]
		});
	
	}
	
	if (parameters["project_custom_fields"] && typeof parameters["project_custom_fields"] === 'object' ) {
		Object.keys(parameters["project_custom_fields"]).forEach(key =>{
			customFieldsObject[key] = parameters["project_custom_fields"][key]
		});
	
	}
	delete parameters["project_custom_fields"];
	delete parameters["workspace_custom_fields"];
	delete parameters["task_custom_fields"];  
	parameters["custom_fields"] = customFieldsObject
	
	return parameters
}