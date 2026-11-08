import { createDatabase } from '../_shared/database.ts';
import { validWebhookSecret } from '../_shared/auth.ts';
import { parseUpdate, sendMessage, TelegramRejected } from '../_shared/telegram.ts';
import { extractRecipe, formatRecipe, type Recipe } from '../_shared/recipe-ai.ts';

const token=Deno.env.get('FAMILY_RECIPES_TELEGRAM_TOKEN')??'';
const secret=Deno.env.get('FAMILY_RECIPES_WEBHOOK_SECRET')??'';
const databaseUrl=Deno.env.get('FAMILY_RECIPES_DATABASE_URL')??'';
const geminiKey=Deno.env.get('FAMILY_RECIPES_GEMINI_API_KEY')??'';
const db=databaseUrl?createDatabase(databaseUrl):null;
const ok=()=>new Response('OK',{status:200});

async function handle(userId:number,text:string):Promise<string> {
  if(!db) throw new Error('Database missing');
  const command=text.trim().toLowerCase();
  if(command==='/start') return 'Добро пожаловать в семейную книгу рецептов! Пришли рецепт текстом, я оформлю его и предложу сохранить. /help - справка.';
  if(command==='/help') return 'Пришли текст рецепта с ингредиентами и приготовлением. Я покажу черновик. Ответь «сохранить» или «отмена». Пока доступны только текстовые рецепты.';
  if(command==='отмена'||command==='/cancel') {
    await db`update family_recipes.recipe_drafts set status='cancelled' where telegram_user_id=${userId} and status='pending'`;
    return 'Черновик отменён.';
  }
  if(command==='сохранить'||command==='/save') {
    const drafts=await db`select id,payload from family_recipes.recipe_drafts where telegram_user_id=${userId} and draft_type='create' and status='pending' and expires_at>now() order by created_at desc limit 1`;
    if(!drafts.length) return 'Нет ожидающего подтверждения рецепта. Пришли рецепт текстом.';
    const draft=drafts[0], p=draft.payload as Recipe & {source_text?:string};
    const result=await db.begin(async sql=>{
      const claimed=await sql`update family_recipes.recipe_drafts set status='confirmed' where id=${draft.id} and status='pending' and expires_at>now() returning id`;
      if(!claimed.length) return null;
      const recipes=await sql`insert into family_recipes.recipes (title,description,instructions,source_text,created_by) values (${p.title},${p.description},${sql.json(p.instructions)},${p.source_text??null},${userId}) returning id`;
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
  if(text.length>8000) return 'Рецепт слишком длинный. Отправь текст до 8000 символов.';
  if(!geminiKey) return 'AI пока не настроен. Попробуй позже.';
  const recipe=await extractRecipe(text,geminiKey);
  await db.begin(async sql=>{
    await sql`update family_recipes.recipe_drafts set status='cancelled' where telegram_user_id=${userId} and status='pending'`;
    await sql`insert into family_recipes.recipe_drafts (telegram_user_id,draft_type,payload) values (${userId},'create',${sql.json({...recipe,source_text:text})})`;
  });
  return 'Проверь рецепт перед сохранением:\n\n'+formatRecipe(recipe)+'\n\nОтветь «сохранить» или «отмена». Черновик действует 24 часа.';
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
  const m=update.message;
  if(!m||m.chat.type!=='private'||!m.from||m.chat.id!==m.from.id||typeof m.text!=='string')return ok();
  try{
    const users=await db`select 1 from family_recipes.bot_users where telegram_user_id=${m.from.id} and is_active=true limit 1`;
    if(!users.length)return ok();
    const claimed=await db`insert into family_recipes.processed_updates (update_id,status,lease_until)
      values (${update.update_id},'processing',now()+interval '30 seconds')
      on conflict (update_id) do update set status='processing',attempts=family_recipes.processed_updates.attempts+1,lease_until=now()+interval '30 seconds'
      where family_recipes.processed_updates.status='retryable' returning update_id`;
    if(!claimed.length)return ok();
    let reply:string;
    try{reply=await handle(m.from.id,m.text);}
    catch(error){
      console.error('Recipe handling failed',{type:error instanceof Error?error.name:'unknown'});
      reply='Не удалось обработать рецепт. Проверь, что указаны название, ингредиенты и способ приготовления, и попробуй снова.';
    }
    try{
      await sendMessage(token,m.chat.id,reply);
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
