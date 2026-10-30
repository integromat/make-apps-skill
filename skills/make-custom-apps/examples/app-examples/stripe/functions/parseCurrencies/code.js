function parseCurrencies(currencies) {
	if (!Array.isArray(currencies)) return undefined;
	return currencies.map(currency => ({label: currency.toUpperCase(), value: currency}));
}