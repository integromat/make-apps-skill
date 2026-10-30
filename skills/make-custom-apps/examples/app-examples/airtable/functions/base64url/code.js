function base64url(text) {
	text = iml.replace(text, '+', '-');
	text = iml.replace(text, '/', '_');
	text = iml.replace(text, '=', '');
	text = iml.replace(text, '\n', '');
	return text;
}