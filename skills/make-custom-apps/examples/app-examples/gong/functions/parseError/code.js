function parseError(errors) {
  let errorText = 'Errors:';
  errors.forEach((error) => {
    errorText += '\n' + error;
  });
  return errorText;
}
