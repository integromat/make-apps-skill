function mergeFields(body) {

	let arr = [];

	body/*.filter(field => field.public)*/.forEach(item => {
		let obj = {};
		obj.name = item.tag;
		obj.label = item.name;
		obj.required = item.required;
		obj.metadata = {
			order: item.display_order
		};
		obj.advanced = item.public ? undefined : true
		/* if (item.options && item.options.size) {
			obj.validate = {
				max: item.options.size
			};
		} */
		if (item.help_text && item.help_text !== "") {
			obj.help = item.help_text;
		}
		if (item.default_value && item.default_value !== "") {
			obj.help = item.default_value;
		}
		switch (item.type) {
			case "address":
				obj.type = "collection";
				obj.spec = iml.addressParameter();
				break;
			case "text":
			case "zip":
			case "phone":
			case "zip":
				obj.type = "text";
				break;
			case "url":
			case "imageurl":
				obj.type = "url";
				break;
			case "number":
				obj.type = "number";
				break;
			case "radio":
			case "dropdown":
				obj.type = "select";
				obj.options = item.options.choices.map(i => {
					let obj = {};
					obj.label = i;
					obj.value = i;
					return obj;
				});
				break;
			case "date":
				obj.type = "date";
				obj.metadata['format'] = item.options.date_format;
				break;
			case "birthday":
				obj.type = "text";
				obj.help = "Its format is " + item.options.date_format;
				break;
			default:
				return;
		}

		arr.push(obj);
	});

	arr.sort(function (a, b) {
		if (a.metadata.order < b.metadata.order) return -1;
		if (a.metadata.order > b.metadata.order) return 1;
		return 0;
	});


	return {
		name: "merge_fields",
		label: "List Fields",
		type: "collection",
		spec: arr
	};

}