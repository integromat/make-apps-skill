function generateTaskCustomFieldParam(field) {
	// Is used to generate the custom field parameters dynamically of Create Task/Update Task
	if (!field) return; 
	
	let obj = {};
	obj.name = field.gid;
	obj.label = field.name;
	
	switch (field.type) {
		case "text":
			obj.type = "text";
			break;
		case "number":
			obj.type = "number";
			break;
		case "enum":
			obj.type = "select";
			obj.options = (field.enum_options || []).map(option => ({label: option.name, value: option.gid})).filter(option => option.enabled !== false);
			obj.dynamic = true;
			break;
		default:
			return null;
	}
	
	return obj;
}