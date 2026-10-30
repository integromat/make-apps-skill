function generateProjCustFieldParamsAlt2(projects) {
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
		
	return projectFieldsArray
}