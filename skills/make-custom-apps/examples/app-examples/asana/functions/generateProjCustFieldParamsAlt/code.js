function generateProjCustFieldParamsAlt(projects,workspaceFieldsArray) {
	//used in RPC Generate Workspace and Project Custom Field Parameters for create task/update task
	if (!projects) return [];
	
	let projectFieldsArray = projects.map(project => {
		projectCustomFieldsArray = project.custom_field_settings.map(field => {
			return iml.generateProjectCustomFieldParam(field,project.name);
		}).filter(field => field !== null);
		return projectCustomFieldsArray
	}).filter(project => project !== null);
	
	projectFieldsArray = iml.flatten(projectFieldsArray)
	//filter null values
	projectFieldsArray = projectFieldsArray.filter(field => field)
		
	let workspaceCustomFieldsObject = {}
	workspaceCustomFieldsObject.name = "workspace_custom_fields";
	workspaceCustomFieldsObject.label= "Workspace Custom Fields";
	workspaceCustomFieldsObject.type = "collection";
	workspaceCustomFieldsObject.help = "Workspace specific custom fields that can be added to the task.";
	workspaceCustomFieldsObject.spec = workspaceFieldsArray;
	
	let projectCustomFieldsObject = {}
	projectCustomFieldsObject.name = "project_custom_fields";
	projectCustomFieldsObject.label= "Project Custom Fields";
	projectCustomFieldsObject.type = "collection";
	projectCustomFieldsObject.help = "Project specific custom fields that can be added to the task.";
	projectCustomFieldsObject.spec = projectFieldsArray;
	/*
	outputArray = iml.merge(workspaceFieldsArray,projectFieldsArray)
	let customFieldsObject = {}
	
	customFieldsObject.name = "custom_fields";
	customFieldsObject.label= "Workspace and Project Custom Fields";
	customFieldsObject.type = "collection";
	customFieldsObject.help = "Workspace and Project specific custom fields that can be added to the task.";
	customFieldsObject.spec = outputArray;
	*/
	return [workspaceCustomFieldsObject,projectCustomFieldsObject];
}