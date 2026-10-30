function generateWorkspCustFieldParamsAlt(fields) {
	//used in RPC Generate Workspace and Project Custom Field Parameters for create task/update task
	if (!fields) return [];
	
	let outputArray = fields.map(field => {
		return iml.generateWorkspCustomFieldParam(field);
	}).filter(field => field !== null);
	
	return outputArray;
}