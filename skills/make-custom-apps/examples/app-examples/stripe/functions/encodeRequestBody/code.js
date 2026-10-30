function encodeRequestBody(parameters, parent = "", body = {}) {
	for (const key in parameters) {
		if (key.startsWith("ignore::") || parameters[key] === null) {
			continue;
		}

		if (key === "metadata" && Array.isArray(parameters[key])) {
			iml.encodeRequestBody(iml.toCollection(parameters[key], 'key', 'value'), parent ? parent + `[${key}]` : key, body);
			continue;
		}

		if (typeof parameters[key] === 'object') {
			for (const k in parameters[key]) {
				iml.encodeRequestBody(parameters[key], parent ? parent + `[${key}]` : key, body);
			}
			continue;
		}

		body[parent ? parent + `[${key}]` : key] = parameters[key];
	}

	return body;
}