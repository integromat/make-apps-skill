function formatFilter(filtersArray) {
	if (!filtersArray) return null
	
	filtersArray.forEach(array => {
		if (!array.resource_subtype)
			delete array.resource_subtype
		if (array.fields && array.fields.length === 0)
			delete array.fields
	})
	
	return filtersArray
}