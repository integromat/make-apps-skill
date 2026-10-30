function generateWorkspCustomFieldParam(field) {
	// Is used to generate the custom field parameters dynamically of Create Task/Update Task
	// used by generateWorkspCustFieldParamsAlt IML
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
			obj.options = (field.enum_options || []).map(option => ({ label: option.name, value: option.gid })).filter(option => option.enabled !== false);
			obj.dynamic = true;
			break;
		case "multi_enum":
			obj.type = "select";
			obj.multiple = true,
			obj.options = (field.enum_options || []).map(option => ({ label: option.name, value: option.gid })).filter(option => option.enabled !== false);
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