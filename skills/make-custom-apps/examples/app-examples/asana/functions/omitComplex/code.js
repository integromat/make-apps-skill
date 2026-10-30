function omitComplex(parameters) {
	if (parameters.destination == "workspace" || parameters.destination == "projects" || parameters.destination == "projAndSect")
		return parameters;
	if (parameters.destination == "parentTaskSelect" || parameters.destination == "parentTaskMap" ) {
		return iml.omit(parameters,'choice','workspace','assigneeId','project','section','tag');
	}
}