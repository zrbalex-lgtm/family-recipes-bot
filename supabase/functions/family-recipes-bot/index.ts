import { classifyLocalCommand, listPage, localRecipeSearch, normalizeRecipeSearchQuery, parseDraftCallback, explicitRecipeTitle, suggestRecipeTitles } from './routing.ts';
import { createDatabase } from '../_shared/database.ts';
import { validWebhookSecret } from '../_shared/auth.ts';
import { parseUpdate, sendMessage, answerCallback, clearButtons, getTelegramPhoto, sendJsonExport, TelegramRejected } from '../_shared/telegram.ts';
import { extractRecipe, classifyMessage, reviseRecipe, extractPhotoRecipe, formatRecipe, type Recipe } from '../_shared/recipe-ai.ts';

const token=Deno.env.get('FAMILY_RECIPES_TELEGRAM_TOKEN')??'';
const secret=Deno.env.get('FAMILY_RECIPES_WEBHOOK_SECRET')??'';
const databaseUrl=Deno.env.get('FAMILY_RECIPES_DATABASE_URL')??'';
const geminiKey=Deno.env.get('FAMILY_RECIPES_GEMINI_API_KEY')??'';
const db=databaseUrl?createDatabase(databaseUrl):null;
const ok=()=>new Response('OK',{status:200});

type SearchHit={id:string;title:string;tags:string[]};
async function showRecipe(userId:number,id:string):Promise<string> {
  if(!db)throw new Error('Database missing');
  const rows=await db`select id,title,description,instructions,tags from family_recipes.recipes where id=${id} and deleted_at is null limit 1`;
  if(!rows.length)return 'Этот рецепт больше не найден. Попробуй новый поиск.';
  const r=rows[0];
  await db`insert into family_recipes.bot_sessions (telegram_user_id,current_recipe_id) values (${userId},${id}::uuid) on conflict (telegram_user_id) do update set current_recipe_id=excluded.current_recipe_id,updated_at=now()`;
  const ingredients=await db`select name,quantity,unit,note from family_recipes.recipe_ingredients where recipe_id=${id} order by sort_order`;
  // Keep the search result list intact so users can open another numbered result.
  // Viewing a recipe must not replace the last search with a single-item list.
  const steps=Array.isArray(r.instructions)?r.instructions.filter((x:unknown)=>typeof x==='string'):[];
  return '🍽 '+r.title+(r.description?'\n'+r.description:'')+'\n\nИнгредиенты:\n'
    +(ingredients as unknown as {name:string;quantity:string|null;unit:string|null;note:string|null}[]).map(i=>'• '+[i.name,i.quantity,i.unit,i.note?'('+i.note+')':null].filter(x=>x!==null&&x!=='').join(' ')).join('\n')
    +'\n\nПриготовление:\n'+steps.map((s:string,n:number)=>(n+1)+'. '+s).join('\n')
    +(r.tags?.length?'\n\nТеги: '+r.tags.join(', '):'');
}
async function openFromContext(userId:number,text:string):Promise<string|null> {
  if(!db)throw new Error('Database missing');
  const command=text.trim().toLowerCase();
  const isView=/^(?:покажи(?: мне)?(?: рецепт)?|подробнее|открой(?: рецепт)?|посмотреть(?: рецепт)?|рецепт|[1-9]\d{0,3}|первый|второй|третий)(?:\s.*)?$/iu.test(command);
  if(classifyLocalCommand(command)==='list')return null;
  const requestedTitle=explicitRecipeTitle(text);
  if(requestedTitle){
    const escaped=requestedTitle.replace(/[\\%_]/g,'');
    const exact=await db`select id,title from family_recipes.recipes where deleted_at is null and lower(title)=${requestedTitle.toLowerCase()} order by title,id`;
    const matches=exact.length?exact:await db`select id,title from family_recipes.recipes where deleted_at is null and (title ilike ${'%'+escaped+'%'} or to_tsvector('russian',replace(lower(title),'ё','е')) @@ plainto_tsquery('russian',replace(lower(${requestedTitle}),'ё','е'))) order by title,id`;
    if(matches.length===1)return showRecipe(userId,String(matches[0].id));
    if(matches.length>1){
      const hits=matches.map(r=>({id:String(r.id),title:String(r.title)}));
      await db`insert into family_recipes.bot_sessions (telegram_user_id,last_search_results) values (${userId},${db.json(hits)}) on conflict (telegram_user_id) do update set last_search_results=excluded.last_search_results,updated_at=now()`;
      return 'Какой рецепт показать? Напиши номер:\n'+hits.map((h,i)=>(i+1)+'. '+h.title).join('\n');
    }
    const candidates=await db`select title from family_recipes.recipes where deleted_at is null order by title limit 500`;
    const suggestions=suggestRecipeTitles(requestedTitle,candidates.map(r=>String(r.title)));
    if(suggestions.length)return 'Рецепт «'+requestedTitle+'» не найден. Возможно, ты имел в виду: '+suggestions.map(t=>'«'+t+'»').join(', ')+'. Напиши точное название для открытия.';
    return 'Рецепт «'+requestedTitle+'» не найден. Попробуй поиск по другому названию.';
  }
  if(!isView)return null;
  const sessions=await db`select last_search_results from family_recipes.bot_sessions where telegram_user_id=${userId} limit 1`;
  const hits:SearchHit[]=Array.isArray(sessions[0]?.last_search_results)?sessions[0].last_search_results.filter((v:unknown)=>v&&typeof v==='object'&&typeof (v as SearchHit).id==='string'):[];
  if(!hits.length)return 'Сначала найди рецепт, например «Найди сырники».';
  const match=command.match(/(?:^|\s)([1-9]\d{0,3})(?:$|\s)/);
  const number=match?Number(match[1]):command.includes('второй')?2:command.includes('третий')?3:command.includes('первый')?1:null;
  if(number!==null)return hits[number-1]?await showRecipe(userId,hits[number-1].id):'В последнем поиске нет рецепта с таким номером.';
  const named=hits.filter(h=>command.includes(h.title.toLowerCase()));
  if(named.length===1)return showRecipe(userId,named[0].id);
  if(hits.length===1)return showRecipe(userId,hits[0].id);
  return 'Какой рецепт показать? Напиши номер:\n'+hits.map((h,i)=>(i+1)+'. '+h.title).join('\n');
}


async function targetRecipe(userId:number,query:string) {
  if(!db)throw new Error('Database missing');
  const sessions=await db`select last_search_results from family_recipes.bot_sessions where telegram_user_id=${userId} limit 1`;
  const hits=Array.isArray(sessions[0]?.last_search_results)?sessions[0].last_search_results as SearchHit[]:[];
  const q=query.toLowerCase().trim();
  if(q){
    const exact=hits.find(h=>q.includes(h.title.toLowerCase()));
    if(exact)return exact.id;
    const rows=await db`select id,title from family_recipes.recipes where deleted_at is null and title ilike ${'%'+q.replace(/[%_]/g,'')+'%'} order by created_at desc limit 2`;
    if(rows.length===1)return rows[0].id as string;
  }
  const current=await db`select current_recipe_id from family_recipes.bot_sessions where telegram_user_id=${userId} limit 1`;
  const currentId=current[0]?.current_recipe_id;
  if(currentId){
    const exists=await db`select id from family_recipes.recipes where id=${currentId} and deleted_at is null limit 1`;
    if(exists.length)return String(exists[0].id);
  }
  return hits.length===1?hits[0].id:null;
}
async function recipePayload(id:string):Promise<Recipe|null>{
  if(!db)throw new Error('Database missing');
  const rows=await db`select title,description,instructions,tags from family_recipes.recipes where id=${id} and deleted_at is null limit 1`;
  if(!rows.length)return null;
  const r=rows[0];
  const ingredients=await db`select name,quantity,unit,note from family_recipes.recipe_ingredients where recipe_id=${id} order by sort_order`;
  return {title:r.title,description:r.description,ingredients:ingredients.map(i=>({name:i.name,quantity:i.quantity===null?null:Number(i.quantity),unit:i.unit,note:i.note})),instructions:r.instructions,tags:r.tags??[]};
}


async function handlePhoto(userId:number,fileId:string,caption:string):Promise<string>{
  if(!db||!geminiKey)throw new Error('Service unavailable');
  const photo=await getTelegramPhoto(token,fileId);
  const recipe=await extractPhotoRecipe(photo.bytes,photo.mime,caption,geminiKey);
  await db.begin(async sql=>{
    await sql`update family_recipes.recipe_drafts set status='cancelled' where telegram_user_id=${userId} and status='pending'`;
    await sql`insert into family_recipes.recipe_drafts (telegram_user_id,draft_type,payload) values (${userId},'create',${sql.json(recipe)})`;
  });
  return 'Проверь рецепт, распознанный по фотографии:\n\n'+formatRecipe(recipe)+(await duplicateRecipeNotice(recipe.title))+'\n\nОтветь «сохранить» или «отмена». Черновик действует 24 часа.';
}
async function duplicateRecipeNotice(title:string):Promise<string>{
  if(!db)return '';
  const matches=await db`select id,title from family_recipes.recipes where deleted_at is null and lower(title)=${title.trim().toLocaleLowerCase('ru')} order by created_at desc limit 3`;
  if(!matches.length)return '';
  return '\n\n⚠️ В книге уже есть '+matches.length+(matches.length===3?'+':'')+' рецепт(а) с названием «'+title+'». Сохранение создаст отдельный рецепт, существующие не изменятся. Для изменения существующего сначала найди и открой его.';
}
async function exportRecipes():Promise<string>{
  if(!db)throw new Error('Database missing');
  const rows=await db`select id,title,description,instructions,tags,created_at,updated_at from family_recipes.recipes where deleted_at is null order by title limit 2001`;
  if(rows.length>2000)throw new Error('Export limit reached: 2000 recipes');
  const ids=rows.map(r=>r.id);
  const ingredients=ids.length?await db`select recipe_id,name,quantity,unit,note,sort_order from family_recipes.recipe_ingredients where recipe_id in ${db(ids)} order by recipe_id,sort_order`:[];
  const byId=new Map<string,unknown[]>();
  for(const item of ingredients){const list=byId.get(item.recipe_id)??[];list.push({name:item.name,quantity:item.quantity,unit:item.unit,note:item.note});byId.set(item.recipe_id,list);}
  return JSON.stringify({exported_at:new Date().toISOString(),recipes:rows.map(r=>({title:r.title,description:r.description,instructions:r.instructions,tags:r.tags,ingredients:byId.get(r.id)??[],created_at:r.created_at,updated_at:r.updated_at}))},null,2);
}

async function searchRecipeList(userId:number,rawQuery:string):Promise<string>{
  if(!db)throw new Error('Database missing');
    const query=normalizeRecipeSearchQuery(rawQuery.replace(/[\%_]/g,''));
    const rows=query
      ?await db`select id,title,tags from family_recipes.recipes where deleted_at is null and (title ilike ${'%'+query+'%'} or exists (select 1 from unnest(tags) t where t ilike ${'%'+query+'%'}) or exists (select 1 from family_recipes.recipe_ingredients ri where ri.recipe_id=recipes.id and ri.name ilike ${'%'+query+'%'})) order by title,id limit 2000`
      :await db`select id,title,tags from family_recipes.recipes where deleted_at is null order by title,id limit 2000`;
    if(!rows.length)return 'Пока не нашёл подходящих рецептов. Попробуй другое название или попроси показать все рецепты.';
    const hits:SearchHit[]=(rows as unknown as SearchHit[]).map(r=>({id:r.id,title:r.title,tags:r.tags??[]}));
    await db`insert into family_recipes.bot_sessions (telegram_user_id,last_search_results)
      values (${userId},${db.json(hits)})
      on conflict (telegram_user_id) do update set last_search_results=excluded.last_search_results,updated_at=now()`;
    return 'Нашёл в семейной книге:\n'+hits.map((r,i)=>(i+1)+'. '+r.title+(r.tags.length?' ('+r.tags.join(', ')+')':'')).join('\n')+'\n\nНапиши «Покажи рецепт» или номер.';
}

async function handle(userId:number,text:string,buttonDraftId?:string):Promise<string> {
  if(!db) throw new Error('Database missing');
  const command=text.trim().toLowerCase();
  if(command==='/export'||command==='экспорт рецептов')return 'Готовлю JSON-файл с семейными рецептами.';
  if(/^(?:\/categories|\/tags|категории|какие категории есть|покажи категории|покажи теги|какие теги есть|теги)$/iu.test(command)){
    const tags=await db`select tag,count(*)::int as n from family_recipes.recipes cross join lateral unnest(tags) tag where deleted_at is null group by tag order by n desc,tag`;
    const categories=await db`select category,count(*)::int as n from family_recipes.recipes where deleted_at is null and category is not null group by category order by n desc,category`;
    if(/теги|tags/.test(command))return tags.length?'Теги в семейной книге:\n'+tags.map(r=>'• '+r.tag+' ('+r.n+')').join('\n'):'Теги пока не назначены.';
    return categories.length?'Категории:\n'+categories.map(r=>'• '+r.category+' ('+r.n+')').join('\n')+'\n\nДля просмотра тегов напиши «Покажи теги».':'Категории пока не назначены.';
  }
  if(classifyLocalCommand(command)==='list'){
    const rows=await db`select id,title,tags from family_recipes.recipes where deleted_at is null order by title,id limit 2000`;
    if(!rows.length)return 'В семейной книге пока нет рецептов.';
    const hits:SearchHit[]=(rows as unknown as SearchHit[]).map(r=>({id:r.id,title:r.title,tags:r.tags??[]}));
    await db`insert into family_recipes.bot_sessions (telegram_user_id,last_search_results)
      values (${userId},${db.json(hits)})
      on conflict (telegram_user_id) do update set last_search_results=excluded.last_search_results,updated_at=now()`;
    return 'Все рецепты ('+hits.length+'):\n'+hits.map((r,i)=>(i+1)+'. '+r.title).join('\n')+'\n\nНапиши номер рецепта, чтобы открыть.';
  }

  if(command==='/start') return 'Добро пожаловать в семейную книгу рецептов! Пришли рецепт текстом, я оформлю его и предложу сохранить. /help - справка.';
  if(command==='/help') return 'Опиши блюдо, даже кратко: «Бутерброд: хлеб, сыр, ветчина». Или попроси: «Найди сырники», «Покажи все рецепты». Для сохранения черновика ответь «сохранить». Пока поддерживаются текстовые рецепты.';
  if(command==='отмена'||command==='/cancel') {
    await db`update family_recipes.recipe_drafts set status='cancelled' where telegram_user_id=${userId} and status='pending' and (${buttonDraftId??null}::uuid is null or id=${buttonDraftId??null}::uuid)`;
    return 'Черновик отменён.';
  }
  if(command==='/existing'){
    const drafts=await db`select id,payload from family_recipes.recipe_drafts where telegram_user_id=${userId} and draft_type='create' and status='pending' and expires_at>now() and id=${buttonDraftId??null}::uuid limit 1`;
    if(!drafts.length)return 'Черновик уже обработан или истёк.';
    const title=String((drafts[0].payload as Recipe).title);
    const matches=await db`select id,title from family_recipes.recipes where deleted_at is null and lower(title)=${title.trim().toLocaleLowerCase('ru')} order by created_at desc limit 10`;
    await db`update family_recipes.recipe_drafts set status='cancelled' where id=${drafts[0].id} and status='pending'`;
    if(!matches.length)return 'Совпадающих рецептов больше нет. Добавь рецепт заново.';
    const hits:SearchHit[]=matches.map(r=>({id:String(r.id),title:String(r.title),tags:[]}));
    await db`insert into family_recipes.bot_sessions (telegram_user_id,last_search_results) values (${userId},${db.json(hits)}) on conflict (telegram_user_id) do update set last_search_results=excluded.last_search_results,updated_at=now()`;
    return 'Новый черновик отменён. Существующие рецепты «'+title+'»:\n'+hits.map((r,i)=>(i+1)+'. '+r.title).join('\n')+'\n\nНапиши номер, чтобы открыть нужный, затем отдельной командой укажи, что изменить.';
  }
  if(command==='сохранить'||command==='/save') {
    const drafts=await db`select id,payload from family_recipes.recipe_drafts where telegram_user_id=${userId} and draft_type='create' and status='pending' and expires_at>now() and (${buttonDraftId??null}::uuid is null or id=${buttonDraftId??null}::uuid) order by created_at desc limit 1`;
    if(!drafts.length) return 'Нет ожидающего подтверждения рецепта. Пришли рецепт текстом.';
    const draft=drafts[0], p=draft.payload as Recipe & {source_text?:string};
    const result=await db.begin(async sql=>{
      const claimed=await sql`update family_recipes.recipe_drafts set status='confirmed' where id=${draft.id} and status='pending' and expires_at>now() returning id`;
      if(!claimed.length) return null;
      const recipes=await sql`insert into family_recipes.recipes (title,description,instructions,source_text,created_by,tags) values (${p.title},${p.description},${sql.json(p.instructions)},${p.source_text??null},${userId},${sql.array(Array.isArray(p.tags)?p.tags:[])}) returning id`;
      const recipeId=recipes[0].id;
      for(let i=0;i<p.ingredients.length;i++){
        const ing=p.ingredients[i];
        await sql`insert into family_recipes.recipe_ingredients (recipe_id,name,normalized_name,original_text,quantity,unit,note,sort_order)
        values (${recipeId},${ing.name},${ing.name.toLowerCase()},${null},${ing.quantity},${ing.unit},${ing.note},${i})`;
      }
      return recipeId;
    });
    return result?'✅ Рецепт «'+p.title+'» сохранён в семейную книгу!':'Этот черновик уже обработан.';
  }

  if(command==='подтвердить'||command==='/confirm'||command==='удалить'||command==='/delete') {
    const drafts=await db`select id,draft_type,target_recipe_id,target_version,payload from family_recipes.recipe_drafts where telegram_user_id=${userId} and status='pending' and draft_type in ('edit','delete') and expires_at>now() and (${buttonDraftId??null}::uuid is null or id=${buttonDraftId??null}::uuid) order by created_at desc limit 1`;
    if(!drafts.length)return 'Нет ожидающего изменения или удаления.';
    const d=drafts[0];
    if(d.draft_type==='delete'&&command!=='удалить'&&command!=='подтвердить'&&command!=='/confirm')return 'Для удаления напиши «удалить».';
    const result=await db.begin(async sql=>{
      const claimed=await sql`update family_recipes.recipe_drafts set status='confirmed' where id=${d.id} and status='pending' and expires_at>now() returning id`;
      if(!claimed.length)return false;
      if(d.draft_type==='delete'){
        const changed=await sql`update family_recipes.recipes set deleted_at=now(),updated_by=${userId},updated_at=now(),version=version+1 where id=${d.target_recipe_id} and version=${d.target_version} and deleted_at is null returning id`;
        if(!changed.length)throw new Error('Recipe version conflict');
      }else{
        const recipe=d.payload as Recipe;
        const changed=await sql`update family_recipes.recipes set title=${recipe.title},description=${recipe.description},instructions=${sql.json(recipe.instructions)},tags=${sql.array(recipe.tags??[])},updated_by=${userId},updated_at=now(),version=version+1 where id=${d.target_recipe_id} and version=${d.target_version} and deleted_at is null returning id`;
        if(!changed.length)throw new Error('Recipe version conflict');
        await sql`delete from family_recipes.recipe_ingredients where recipe_id=${d.target_recipe_id}`;
        for(let i=0;i<recipe.ingredients.length;i++){
          const ing=recipe.ingredients[i];
          await sql`insert into family_recipes.recipe_ingredients (recipe_id,name,normalized_name,quantity,unit,note,sort_order) values (${d.target_recipe_id},${ing.name},${ing.name.toLowerCase()},${ing.quantity},${ing.unit},${ing.note},${i})`;
        }
      }
      return true;
    });
    return result?(d.draft_type==='delete'?'🗑 Рецепт удалён.':'✅ Изменения рецепта сохранены.'):'Изменение уже обработано.';
  }
  if(text.length>8000) return 'Рецепт слишком длинный. Отправь текст до 8000 символов.';
  // Explicit numbered selections are deterministic; all other free text goes to AI routing.
  if(/^(?:[1-9]\d{0,3}|первый|второй|третий)$/iu.test(text.trim())){
    const selected=await openFromContext(userId,text);
    if(selected!==null)return selected;
  }
  // Common category requests must work even when the AI service is unavailable.
  const categoryRequest=text.trim().toLocaleLowerCase('ru').match(/^(?:покажи|найди|список|дай)(?:\\s+мне)?(?:\\s+все)?\\s+(?:(?:рецепты|блюда)\\s+)?(?:на\\s+)?(салаты|салат|завтрак|завтраки|десерты|десерт|супы|суп|выпечка|выпечку|торты|торт|печенье|рыба|рыбу|мясо|быстрые)(?:\\s+рецепты)?$/iu);
  if(categoryRequest){
    const terms:Record<string,string>={салаты:'салат',салат:'салат',завтрак:'завтрак',завтраки:'завтрак',десерты:'десерт',десерт:'десерт',супы:'суп',суп:'суп',выпечка:'выпечка',выпечку:'выпечка',торты:'торт',торт:'торт',печенье:'печенье',рыба:'рыба',рыбу:'рыба',мясо:'мясо',быстрые:'быстр'};
    return searchRecipeList(userId,terms[categoryRequest[1]]);
  }
  if(/^(?:покажи|найди)\\s+все\\s+рецепты\\s+на\\s+завтрак$/iu.test(text.trim()))return searchRecipeList(userId,'завтрак');
  if(explicitRecipeTitle(text)&&classifyLocalCommand(text.trim().toLowerCase())!=='list'){
    const opened=await openFromContext(userId,text);
    if(opened!==null)return opened;
  }
  if(!geminiKey) return 'AI пока не настроен. Попробуй позже.';
  let intent:{intent:'add'|'search'|'list'|'open'|'edit'|'delete'|'question';query:string};
  try {intent=await classifyMessage(text,geminiKey);}
  catch(error) {console.error('Intent classification failed',{type:error instanceof Error?error.name:'unknown'});return 'Не удалось понять сообщение. Попробуй ещё раз или напиши /help.';}
  if(intent.intent==='list')return handle(userId,'/list');
  if(intent.intent==='open'){
    const requested=intent.query.trim();
    const command=/^(?:[1-9]\d{0,3}|первый|второй|третий)$/iu.test(requested)?requested:'покажи рецепт '+requested;
    if(!requested)return 'Какой рецепт открыть? Напиши название или номер из последнего списка.';
    return await openFromContext(userId,command)??'Рецепт не найден.';
  }
  if(intent.intent==='search')return searchRecipeList(userId,intent.query);

  if(intent.intent==='edit'||intent.intent==='delete'){
    const target=await targetRecipe(userId,intent.query);
    if(!target)return 'Не понял, какой рецепт ты имеешь в виду. Сначала найди и открой нужный рецепт.';
    const current=await recipePayload(target);
    if(!current)return 'Рецепт не найден.';
    const versions=await db`select version from family_recipes.recipes where id=${target} and deleted_at is null`;
    const version=versions[0].version as number;
    const revised=intent.intent==='edit'?await reviseRecipe(current,text,geminiKey):current;
    await db.begin(async sql=>{
      await sql`update family_recipes.recipe_drafts set status='cancelled' where telegram_user_id=${userId} and status='pending'`;
      await sql`insert into family_recipes.recipe_drafts (telegram_user_id,draft_type,target_recipe_id,target_version,payload) values (${userId},${intent.intent},${target},${version},${sql.json(revised)})`;
    });
    return intent.intent==='delete'?'⚠️ Удалить рецепт «'+current.title+'»? Напиши «удалить» для подтверждения или «отмена».':'Предлагаю изменить рецепт:\n\n'+formatRecipe(revised)+'\n\nНапиши «подтвердить» или «отмена».';
  }
  if(intent.intent==='question')return 'Могу добавить рецепт или найти сохранённые. Например: «Бутерброд: хлеб, сыр, ветчина» или «Найди сырники».';
  let recipe:Recipe;
  try {
    recipe=await extractRecipe(text,geminiKey);
  } catch(error) {
    const status=error instanceof Error?/^Gemini HTTP ([0-9]{3})$/.exec(error.message)?.[1]:undefined;
    console.error('Recipe stage failed',{stage:'gemini_extraction',category:status?'http_error':error instanceof SyntaxError?'json_parse':error instanceof TypeError?'network_or_type':'other',httpStatus:status?Number(status):null});
    throw error;
  }
  try {
    await db.begin(async sql=>{
      await sql`update family_recipes.recipe_drafts set status='cancelled' where telegram_user_id=${userId} and status='pending'`;
      await sql`insert into family_recipes.recipe_drafts (telegram_user_id,draft_type,payload) values (${userId},'create',${sql.json({...recipe,source_text:text})})`;
    });
  } catch(error) {
    const code=error&&typeof error==='object'&&'code' in error&&typeof error.code==='string'&&/^[A-Z0-9]{5}$/.test(error.code)?error.code:null;
    console.error('Recipe stage failed',{stage:'database_draft_save',category:code?'postgres':'other',dbCode:code});
    throw error;
  }
  return 'Проверь рецепт перед сохранением:\n\n'+formatRecipe(recipe)+(await duplicateRecipeNotice(recipe.title))+'\n\nОтветь «сохранить» или «отмена». Черновик действует 24 часа.';
}

Deno.serve(async request=>{
  if(request.method!=='POST')return new Response('Method Not Allowed',{status:405});
  if(!validWebhookSecret(request.headers.get('X-Telegram-Bot-Api-Secret-Token'),secret))return new Response('Unauthorized',{status:401});
  if(!token||!db)return new Response('Service unavailable',{status:503});
  if(Number(request.headers.get('content-length')??0)>65536)return new Response('Too large',{status:413});
  let update;
  try{
    const body=await request.text();
    if(new TextEncoder().encode(body).length>65536)return new Response('Too large',{status:413});
    update=parseUpdate(JSON.parse(body));
  }catch{return new Response('Invalid JSON',{status:400});}
  if(!update)return new Response('Invalid update',{status:400});
  const cb=update.callback_query;
  const match=parseDraftCallback(cb?.data);
  const callbackValid=!!(cb&&match&&cb.message?.chat.type==='private'&&cb.from.id===cb.message.chat.id);
  const m=callbackValid?{chat:cb!.message!.chat,from:cb!.from,text:match!.action==='save'?'сохранить':match!.action==='confirm'?'подтвердить':match!.action==='delete'?'удалить':match!.action==='existing'?'/existing':'отмена'}:update.message;
  if(!m||m.chat.type!=='private'||!m.from||m.chat.id!==m.from.id||(typeof m.text!=='string'&&!Array.isArray(m.photo)))return ok();
  try{
    const users=await db`select 1 from family_recipes.bot_users where telegram_user_id=${m.from.id} and is_active=true limit 1`;
    if(!users.length)return ok();
    const claimed=await db`insert into family_recipes.processed_updates (update_id,status,lease_until)
      values (${update.update_id},'processing',now()+interval '30 seconds')
      on conflict (update_id) do update set status='processing',attempts=family_recipes.processed_updates.attempts+1,lease_until=now()+interval '30 seconds'
      where family_recipes.processed_updates.status='retryable' returning update_id`;
    if(!claimed.length){
      if(callbackValid)await answerCallback(token,cb!.id).catch(()=>console.error('Callback acknowledgement failed'));
      return ok();
    }
    let reply:string;
    try{reply=Array.isArray(m.photo)&&m.photo.length?await handlePhoto(m.from.id,m.photo[m.photo.length-1].file_id,m.caption??''):await handle(m.from.id,m.text??'',callbackValid?match!.draftId:undefined);}
    catch(error){
      const message=error instanceof Error?error.message:'';
      const geminiStatus=/^Gemini HTTP (\d{3})$/.exec(message);
      const category=geminiStatus?'gemini_http':message==='Empty Gemini response'?'gemini_empty':message==='Invalid recipe JSON'?'gemini_invalid_json':message==='Not a complete recipe'?'recipe_incomplete':error instanceof SyntaxError?'json_parse':error instanceof TypeError?'network_or_type':error instanceof Error&&error.name==='PostgresError'?'database':'other';
      const dbCode=category==='database'&&error&&typeof error==='object'&&'code' in error&&typeof error.code==='string'&&/^[A-Z0-9]{5}$/.test(error.code)?error.code:null;
      console.error('Recipe handling failed',{category,geminiHttpStatus:geminiStatus?Number(geminiStatus[1]):null,dbCode});
      reply=message==='Incomplete photo recipe'?'Не удалось полностью распознать рецепт на фото. Попробуй отправить более крупный снимок или текст рецепта.':message==='Not a complete recipe'?'Не удалось выделить полный рецепт из текста. Проверь ингредиенты и приготовление.':geminiStatus?'Сервис распознавания временно недоступен (код '+geminiStatus[1]+'). Попробуй позже.':category==='database'?'Ошибка базы данных. Проверь список рецептов перед повторной отправкой.':category==='json_parse'||category==='gemini_empty'||category==='gemini_invalid_json'?'Сервис распознавания вернул некорректный ответ. Попробуй ещё раз.':'Техническая ошибка при обработке запроса. Попробуй позже.';
    }
    try{
      let buttons:{text:string;callback_data:string}[]|undefined;
      if(!callbackValid&&(/Черновик действует 24 часа/.test(reply)||/Напиши «подтвердить» или «отмена»/.test(reply)||/Напиши «удалить» для подтверждения/.test(reply))){
        const drafts=await db`select id,draft_type,payload from family_recipes.recipe_drafts where telegram_user_id=${m.from.id} and status='pending' and expires_at>now() order by created_at desc limit 1`;
        if(drafts.length){
          const d=drafts[0];
          const action=d.draft_type==='create'?'save':d.draft_type==='edit'?'confirm':'delete';
          buttons=[{text:action==='save'?'💾 Сохранить новый':action==='confirm'?'✅ Подтвердить':'🗑 Удалить',callback_data:'draft:'+action+':'+d.id}];
          if(d.draft_type==='create'){
            const title=String((d.payload as Recipe).title??'');
            const duplicate=title?await db`select 1 from family_recipes.recipes where deleted_at is null and lower(title)=${title.trim().toLocaleLowerCase('ru')} limit 1`:[];
            if(duplicate.length)buttons.push({text:'✏️ Изменить существующий',callback_data:'draft:existing:'+d.id});
          }
          buttons.push({text:'Отмена',callback_data:'draft:cancel:'+d.id});
        }
      }
      if(callbackValid){
        await answerCallback(token,cb!.id);
        await clearButtons(token,m.chat.id,cb!.message!.message_id);
      }
      if((m.text??'').trim().toLowerCase()==='/export'||(m.text??'').trim().toLowerCase()==='экспорт рецептов'){
        await sendJsonExport(token,m.chat.id,await exportRecipes());
      }else{
        await sendMessage(token,m.chat.id,reply,buttons);
      }
      await db`update family_recipes.processed_updates set status='done',lease_until=null,completed_at=now() where update_id=${update.update_id}`;
    }catch(error){
      const rejected=error instanceof TelegramRejected;
      await db`update family_recipes.processed_updates set status=${rejected?'retryable':'done'},lease_until=null,completed_at=case when ${rejected} then null else now() end where update_id=${update.update_id} and status='processing'`;
      if(rejected)throw error;
      console.error('Ambiguous Telegram send',{updateId:update.update_id});
    }
    return ok();
  }catch(error){
    console.error('Webhook processing failed',{type:error instanceof Error?error.name:'unknown'});
    return new Response('Temporary error',{status:503});
  }
});
