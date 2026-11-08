export function classifyLocalCommand(text:string):'list'|'other'{
  const command=text.trim().toLowerCase();
  return /^(?:покажи(?: мне)?|выведи)\s+(?:все|всё)\s+рецепты$/iu.test(command)||command==='список рецептов'||command==='/list'?'list':'other';
}
