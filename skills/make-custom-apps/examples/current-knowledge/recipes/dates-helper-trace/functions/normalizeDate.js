// Synthetic teaching helper for the dates-helper-trace recipe; not a certified provider implementation.
// It shows what "actually transforms the value" means and keeps the documented exceptions explicit.
function normalizeDate(value) {
  if (value === null || value === undefined || value === '') {
    return value;
  }
  var text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text; // date-only: keep a calendar date, never invent a time or a zone
  }
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(text)) {
    return text; // time-only: there is no date part to normalize
  }
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(text)) {
    return text.replace(' ', 'T'); // an explicit zone is already present
  }
  return text.replace(' ', 'T') + 'Z'; // unknown zone: this fixture ASSUMES UTC; confirm with the provider
}
