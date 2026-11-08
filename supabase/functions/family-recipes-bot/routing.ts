export function classifyLocalCommand(text:string):'list'|'other'{
  const command=text.trim().toLowerCase();
  return /^(?:(?:покажи(?: мне)?|выведи)\s+(?:(?:все|всё)\s+рецепты|рецепты\s+(?:все|всё))|(?:список|перечень)\s+рецептов|какие\s+рецепты\s+(?:есть|у нас есть))(?:\s+страница\s+[1-9]\d{0,3})?$/iu.test(command)||/^\/list(?:\s+[1-9]\d{0,3})?$/iu.test(command)?'list':'other';
}

export type DraftAction='save'|'confirm'|'delete'|'cancel';
export function parseDraftCallback(data:unknown):{action:DraftAction;draftId:string}|null{
  if(typeof data!=='string')return null;
  const match=/^draft:(save|confirm|delete|cancel):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(data);
  return match?{action:match[1] as DraftAction,draftId:match[2].toLowerCase()}:null;
}

export function explicitRecipeTitle(text:string):string|null{
  const match=/^(?:покажи(?: мне)?|открой|посмотреть)\s+рецепт\s+(.+)$/iu.exec(text.trim());
  const title=match?.[1]?.trim();
  return title&&title.length<=200?title:null;
}

export function suggestRecipeTitles(query:string,titles:string[],maxResults=3):string[]{
  const normalize=(value:string)=>value.toLocaleLowerCase('ru').normalize('NFC').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const distance=(a:string,b:string):number=>{
    const previous=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      let diagonal=previous[0];
      previous[0]=i;
      for(let j=1;j<=b.length;j++){
        const old=previous[j];
        previous[j]=Math.min(previous[j]+1,previous[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));
        diagonal=old;
      }
    }
    return previous[b.length];
  };
  const q=normalize(query);
  if(q.length<4)return [];
  return titles.map(title=>{
    const t=normalize(title);
    return {title,score:distance(q,t),length:Math.max(q.length,t.length)};
  }).filter(x=>x.score>0&&x.score<=Math.max(1,Math.floor(x.length*0.3)))
    .sort((a,b)=>a.score-b.score||a.title.localeCompare(b.title,'ru'))
    .slice(0,Math.max(0,maxResults)).map(x=>x.title);
}

export function listPage(text:string):number{
  const match=/(?:страница\s+|^\/list\s+)([1-9]\d{0,3})$/iu.exec(text.trim());
  return match?Number(match[1]):1;
}

export function localRecipeSearch(text:string):string|null{
  const command=text.trim().toLocaleLowerCase('ru');
  const match=/^(?:покажи(?: мне)?|найди|подбери)\s+рецепты?\s+(?:с|со|на|по)\s+(.+)$/iu.exec(command);
  if(!match)return null;
  const raw=match[1].trim();
  if(raw==='сыром'||raw==='сыра')return 'сыр';
  if(raw==='завтрак'||raw==='завтраки')return 'завтрак';
  return raw;
}
