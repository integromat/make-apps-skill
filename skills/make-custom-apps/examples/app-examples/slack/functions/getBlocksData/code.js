function getBlocksData(blocks) {
	if (!blocks) {
		return
	}
	try {
		const data = JSON.parse(blocks)
		if (data.blocks && data.blocks.length) {
			return data.blocks
		} else {
			return data
		}
	} catch (e) {
		throw new Error('JSON for blocks is invalid.')
	}
}