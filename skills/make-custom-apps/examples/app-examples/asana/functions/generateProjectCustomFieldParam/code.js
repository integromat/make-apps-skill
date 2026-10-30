function generateProjectCustomFieldParam(field,projectName) {
	// Is used to generate the custom field parameters dynamically of Create Task/Update Task
	// used by generateProjCustFieldParamsAlt IML function
	if (!field || field.custom_field.is_global_to_workspace) return;
	
	let obj = {};
	obj.name = field.custom_field.gid;
	obj.label = field.custom_field.name + " ["+projectName+"]";
	
	switch (field.custom_field.type) {
		case "text":
			obj.type = "text";
			break;
		case "number":
			obj.type = "number";
			break;
		case "enum":
			obj.type = "select";
			obj.options = (field.custom_field.enum_options || []).map(option => ({label: option.name, value: option.gid})).filter(option => option.enabled !== false);
			obj.dynamic = true;
			break;
		case "multi_enum":
			obj.type = "select";
			obj.options = (field.custom_field.enum_options || []).map(option => ({label: option.name, value: option.gid})).filter(option => option.enabled !== false);
			obj.multiple = true;
			obj.dynamic = true;
			break;
		case "date":
			obj.type = "collection";
			obj.spec = [
				{
					"type": "date",
					"name": "date_time",
					"label": "Date Time"
				}
			];
			break;
		case "people":
			obj.type = "select";
			obj.options = "rpc://GetUsers";
			obj.multiple = true;
			obj.dynamic = true;
			break;
		default:
			return null;
	}
	
	return obj;
}