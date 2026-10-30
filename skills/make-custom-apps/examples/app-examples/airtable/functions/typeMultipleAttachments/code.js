function typeMultipleAttachments(field, _for) {
	if (_for === 'interface') {
		field.type = "array";
		field.spec = [
			{ name: "id", type: "text", label: "ID" },
			{ name: "url", type: "url", label: "URL" },
			{ name: "filename", type: "filename", label: "File name" },
			{ name: "size", type: "uinteger", label: "Size" },
			{ name: "type", label: "MIME type", type: "text" },
			{
				name: "thumbnails", label: "Thumbnails", type: "collection", spec: [
					{
						name: "small", label: "Small", type: "collection", spec: [
							{ name: "url", type: "url", label: "URL" },
							{ name: "width", type: "uinteger", label: "Width" },
							{ name: "height", type: "uinteger", label: "Height" }
						]
					},
					{
						name: "large", label: "Large", type: "collection", spec: [
							{ name: "url", type: "url", label: "URL" },
							{ name: "width", type: "uinteger", label: "Width" },
							{ name: "height", type: "uinteger", label: "Height" }
						]
					},
					{
						name: "full", label: "Full", type: "collection", spec: [
							{ name: "url", type: "url", label: "URL" },
							{ name: "width", type: "uinteger", label: "Width" },
							{ name: "height", type: "uinteger", label: "Height" }
						]
					}
				]
			}
		];
		return field;
	}

	// For expect
	field.type = "array";
	field.editable = true;
	field.spec = [{
		name: "url",
		label: "File URL",
		type: "text",
		help: "Airtable will download the file at the given url and keep its own copy of it."
	}, {
		name: "filename",
		label: "File name",
		type: "filename",
		help: "If empty, Airtable will generate the name automatically."
	}];
	return field;
}