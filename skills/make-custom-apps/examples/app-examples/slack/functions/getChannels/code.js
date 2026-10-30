function getChannels(channels) {
	return (channels || []).map(({channel}) => channel).join(',')
}