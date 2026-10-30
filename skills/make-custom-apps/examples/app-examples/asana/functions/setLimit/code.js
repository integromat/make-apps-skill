function setLimit(parameters) {
	max_limit = 100;
	if (parameters.page < max_limit)
		parameters.limit = parameters.page;
	else {
		parameters.limit = max_limit;
	}
	return parameters;
}