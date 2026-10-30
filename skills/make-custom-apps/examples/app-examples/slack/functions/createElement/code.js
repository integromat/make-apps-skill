function createElement(type) {
	switch (type) {
		case 'buttonStyle': {
			return iml.createHtmlElement('style', 'Style', 'select', false, [['Primary', 'primary'], ['Danger', 'danger']])
		}
	}
}