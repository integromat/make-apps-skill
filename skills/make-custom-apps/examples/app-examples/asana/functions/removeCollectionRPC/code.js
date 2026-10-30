function removeCollectionRPC(parameters,collectionName,extractedVar) {
	//used in Update a Task's Parent, Update a Task's Dependencies
	parameters[extractedVar] = parameters[collectionName][extractedVar];
	//parentCollection is required and so is parent so we can do this without any checks.
	
	delete parameters[collectionName];
	return parameters;
}