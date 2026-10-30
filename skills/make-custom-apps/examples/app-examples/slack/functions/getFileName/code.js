function getFileName(headers) {
	if (!headers || !headers['content-disposition']) {
		return
	}
	const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
    const matches = filenameRegex.exec(headers['content-disposition'])
    if (matches !== null && matches[1]) { 
        return matches[1].replace(/['"]/g, '')
    }
}