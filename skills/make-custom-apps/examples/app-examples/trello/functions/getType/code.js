function getType(expect) {
	return expect.filter(item => item.name === 'value')[0].metadata.type;
}