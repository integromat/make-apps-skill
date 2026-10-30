function fetchKeys(keys) {
  if (!keys) {
    return;
  } else if (typeof keys[0] === 'object') {
    return keys.map(key => key.column);
  }
  
  return keys;
}