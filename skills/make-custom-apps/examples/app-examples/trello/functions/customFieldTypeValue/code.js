function customFieldTypeValue(type) {
	let output = [];
	
	var obj = {};
	obj.name = "value";
	obj.label = "Value";
	obj.required = true;
	
	switch(type){
		case "text":
			obj.type = "text";
			obj.metadata = {
				type: type
			};
			break;
		case "number":
			obj.type = "number";
			obj.metadata = {
				type: type
			};
			break;
		case "date":
			obj.type = "date";		
			obj.metadata = {
				type: type
			};
			break;
		case "checkbox":
			obj.type = "boolean";
			obj.editable = true;
			obj.metadata = {
				type: "checked"
			};
			break;
		case "list":
			obj.type = "select";
			obj.editable = true;
			obj.options = "rpc://getCFoptionID";
			obj.metadata = {
				type: type
			};
			break;
	}
	
	output.push(obj);
	
	return output;
}