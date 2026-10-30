function ifObjEmpty(obj) {
    if(obj !== null && obj !== undefined) {
        if(Object.keys(obj).length === 0) {
			return undefined
		} else {
			return obj
		}
    }
    return undefined
}