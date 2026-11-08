export function classifyLocalCommand(text:string):'list'|'other'{
  const command=text.trim().toLowerCase();
  return /^(?:покажи(?: мне)?|выведи)\s+(?:все|всё)\s+рецепты$/iu.test(command)||command==='список рецептов'||command==='/list'?'list':'other';
}

export type DraftAction='save'|'confirm'|'delete'|'cancel';
export function parseDraftCallback(data:unknown):{action:DraftAction;draftId:string}|null{
  if(typeof data!=='string')return null;
  const match=/^draft:(save|confirm|delete|cancel):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(data);
  return match?{action:match[1] as DraftAction,draftId:match[2].toLowerCase()}:null;
}
