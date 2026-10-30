function getBlocks(blocks) {
	if (!blocks || !blocks.length) {
		return undefined
	}
	return blocks.map(block => {
		Object.keys(block).forEach(key => {
			if (block[key] && typeof block[key] === 'object' && !Object.keys(block[key]).length) {
				delete block[key]
			}
		})
		switch (block.type) {
			case 'header': {
				if (typeof block.text === 'string' && block.text) {
					block.text = {
						type: 'plain_text',
						text: block.text
					}
				}
				break
			}
			case 'image': {
				if (typeof block.title === 'string' && block.title) {
					block.title = {
						type: 'plain_text',
						text: block.title
					}
				}
				break
			}
			case 'input': {
				if (typeof block.label === 'string' && block.label) {
					block.label = {
						type: 'plain_text',
						text: block.label
					}
				}
				if (typeof block.hint === 'string' && block.hint) {
					block.hint = {
						type: 'plain_text',
						text: block.hint
					}
				}
				if (typeof block.element === 'string' && block.element) {
					try {
						block.element = JSON.parse(block.element)
					} catch (e) {
						throw new Error('Field element is not a valid JSON object.')
					}
				}
				break
			}
			case 'context': {
				if (typeof block.elements === 'string' && block.elements) {
					try {
						block.elements = JSON.parse(block.elements)
					} catch (e) {
						throw new Error('Field element is not a valid JSON object.')
					}
				}
				break
			}
			case 'actions': {
				if (typeof block.elements === 'string' && block.elements) {
					try {
						block.elements = JSON.parse(block.elements)
					} catch (e) {
						throw new Error('Field element is not a valid JSON object.')
					}
				}
				break
			}
		}
		if (block.accessory) {
			try {
				block.accessory = JSON.parse(block.accessory)
			} catch (e) {
				throw new Error('Field accessory is not a valid JSON object.')
			}
		} 
		return block
	})
}