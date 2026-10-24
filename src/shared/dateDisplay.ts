/** Display-only formatting: dates retain ISO values for saving, filtering and sorting. */
export function displayDate(value:unknown):string {
  const text=String(value??'');
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  return match?`${match[3]}-${match[2]}-${match[1]}`:text;
}
