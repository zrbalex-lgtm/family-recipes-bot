export type Recipe = { title:string; description:string|null; ingredients:{name:string;quantity:number|null;unit:string|null;note:string|null}[]; instructions:string[] };
export async function extractRecipe(text:string,key:string):Promise<Recipe> {
  const prompt = 'Извлеки кулинарный рецепт из текста. Не придумывай отсутствующие ингредиенты, количества и шаги. Все строки по-русски. Верни только JSON объект: {"title":"...","description":null,"ingredients":[{"name":"...","quantity":null,"unit":null,"note":null}],"instructions":["..."]}. Если это не рецепт, верни {"title":"","description":null,"ingredients":[],"instructions":[]}. Текст пользователя: '+text;
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{
    method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:0.1}}),
    signal:AbortSignal.timeout(18000)
  });
  if(!response.ok) throw new Error('Gemini HTTP '+response.status);
  const data=await response.json();
  const raw=data?.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text??'').join('');
  if(!raw) throw new Error('Empty Gemini response');
  const value=JSON.parse(raw);
  const str=(v:unknown)=>typeof v==='string'?v.trim().slice(0,1000):'';
  const nullable=(v:unknown)=>typeof v==='string'?str(v):null;
  const quantity=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
  if(!value||!Array.isArray(value.ingredients)||!Array.isArray(value.instructions)) throw new Error('Invalid recipe JSON');
  const recipe:Recipe={title:str(value.title).slice(0,200),description:nullable(value.description),
    ingredients:value.ingredients.slice(0,80).map((v:Record<string,unknown>)=>({name:str(v.name).slice(0,200),quantity:quantity(v.quantity),unit:nullable(v.unit)?.slice(0,40)??null,note:nullable(v.note)})).filter((v:{name:string})=>v.name),
    instructions:value.instructions.slice(0,60).map(str).filter(Boolean)};
  if(!recipe.title||!recipe.ingredients.length||!recipe.instructions.length) throw new Error('Not a complete recipe');
  return recipe;
}
export function formatRecipe(recipe:Recipe):string {
  const items=recipe.ingredients.map(i=>'• '+[i.name,i.quantity??'',i.unit??'',i.note?('('+i.note+')'):''].filter(x=>x!==''&&x!==null).join(' ')).join('\n');
  return '🍽 '+recipe.title+'\n\nИнгредиенты:\n'+items+'\n\nПриготовление:\n'+recipe.instructions.map((s,i)=>(i+1)+'. '+s).join('\n');
}
