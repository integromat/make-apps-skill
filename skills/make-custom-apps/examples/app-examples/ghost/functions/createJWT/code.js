function createJWT(api_key) {
	const [id, secret] = iml.split(api_key, ":");

	const header = {
		"alg": "HS256",
		"kid": id,
		"typ": "JWT"
	};
	const headerBase64String = iml.base64url(JSON.stringify(header), 'binary');

	const ts = Math.floor((new Date()).getTime() / 1000);

	const data = {
		"aud": "/v3/admin/",
		"exp": ts + 5 * 60,
		"iat": ts
	};
	const dataBase64String = iml.base64url(JSON.stringify(data), 'binary');
	
	const decoded_secret = iml.base64url(secret, 'hex');

	const token = headerBase64String + "." + dataBase64String;
	const signature = iml.base64url(iml.sha256(token, 'hex', decoded_secret, 'base64'), 'hex');
	const jwt = `${token}.${signature}`;
	// debug(jwt);
	return jwt;
}