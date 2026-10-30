function getSchemaFieldSpecs(col, field, _for) {
	switch (col.type) {
		case "multilineText":
			field.multiline = true;
			break;
		case "multipleAttachments":
			iml.typeMultipleAttachments(field, _for);
			break;
		case "checkbox":
			field.type = "boolean";
			break;
		case "multipleSelects":
			if (_for === 'interface') {
				field.type = "array";
				//field.spec = { type: "text"};
				field.editable = true;
				field.dynamic = true;
				break;
			}
			// For expect
			field.type = "array";
			field.spec = {
				type: "select",
				dynamic: true,
				label: "Value",
				mode : "edit",
				validate: false,
				options: col.options.choices.map(choiceId => ({ label: choiceId.name, value: choiceId.name}))
			};
			break;
		case "singleSelect":
			if (['interface', 'rpc'].includes(_for)) break;

			// For expect
			field.type = "text";
			// ADD THIS ONCE THEY ADD SUPPORT FOR OPTIONS
			field.type = "select";
			field.mode = "edit";
			field.dynamic = true;
			field.validate = false;
			field.options = col.options.choices.map(choiceId => ({ label: choiceId.name, value: choiceId.name}));
			break;
		case "singleCollaborator":
			if (['interface', 'rpc'].includes(_for)) {
				field.type = "collection";
				field.spec = [
					{ name: "id", type: "text", label: "ID" },
					{ name: "email", type: "email", label: "Email" },
					{ name: "name", type: "text", label: "Name" }
				];
				break;
			}
			field.type = "collection";
			field.spec = [
				{ name: "id", type: "text", label: "ID", "help": "Unique user id" },
				{ name: "email", type: "email", label: "Email", "help": "User's email address" },
				{ name: "name", type: "text", label: "Name", "help": "User's display name (may be empty if the user hasn't created an account)" }
			];
			break;
		case "multipleCollaborators":
			if (['interface', 'rpc'].includes(_for)) {
				field.type = "array";
				field.spec = [
					{ name: "id", type: "text", label: "ID" },
					{ name: "email", type: "email", label: "Email" },
					{ name: "name", type: "text", label: "Name" }
				];
				break;
			}

			// For expect
			field.type = "array";
			field.spec = [
				{ name: "id", type: "text", label: "ID", "help": "Unique user id" },
				{ name: "email", type: "email", label: "Email", "help": "User's email address" },
				{ name: "name", type: "text", label: "Name", "help": "User's display name (may be empty if the user hasn't created an account)" }
			];
			break;
		case "createdTime":
		case "lastModifiedTime":
			if (!['interface', 'rpc'].includes(_for)) return;
			field.type = "date";
			break;
		case "date":
		case "dateTime":
			field.type = "date";
			field.time = col.type === "dateTime" ? true : false;
			break;
		case "url":
		case "email":
			field.type = "text";
			break;
		case "number":
		case "percent":
		case "currency":
		case "duration":
			field.type = "number";
			break;
		case "barcode":
			field.type = "collection";
			field.spec = [{ name: "text", type: "text", label: "Text" }];
			break;
		case "button":
			if (['interface', 'rpc'].includes(_for)) {
				field.type = "collection";
				field.spec = [
					{ name: "label", type: "text", label: "Label" },
					{ name: "url", type: "url", label: "URL" }
				];
				break;
			}
			else return;
		case "lastModifiedBy":
			field.type = "collection";
			field.spec = [
				{ name: "id", type: "text", label: "ID" },
				{ name: "email", type: "text", label: "Email" },
				{ name: "name", type: "text", label: "Name" },
			];
			break;
		case "rating":
			field.type = "uinteger";
			field.validate = { min: 1 };
			break;
		case "multipleRecordLinks":
			field.type = "array"
			field.spec = { label: 'Record ID' }
			break;
		/*case "lookup":
			if (!['interface', 'rpc'].includes(_for)) return;
			field.type = "array";
			field.spec = { type: "any"};
			break;
		case "multipleLookupValues":
			field.type = "array";
			field.editable = true;
			field.help = "Array of Airtable record Ids";
			field.spec = { type: "text" };
			break;*/
		// Don't show this fields:	
		case "rollup":
		case "multipleLookupValues":
			if(
				_for == 'interface' &&
				col.options &&
				col.options.result &&
				col.options.result.type == 'multipleAttachments'
			) {
				iml.typeMultipleAttachments(field, _for);
				break;
			}
			else if(['interface', 'rpc'].includes(_for)){
				field.type = "array";
				break;
			}
			else return;
		case "count":
		case "autoNumber":
			field.type = "number";
		case "lookup":
		case "createdBy":
		case "lastModifiedTime":
		case "formula":
			if (['interface', 'rpc'].includes(_for)) break;
			return;
	}
	return field;
}
