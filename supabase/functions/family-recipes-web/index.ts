import {createDatabase} from '../_shared/database.ts';
const db=createDatabase(Deno.env.get('FAMILY_RECIPES_DATABASE_URL')??'');
const supabaseUrl=Deno.env.get('SUPABASE_URL')??'';
const publicKey=Deno.env.get('SUPABASE_ANON_KEY')??'';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'GET, PUT, DELETE, OPTIONS'};
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function getRecipe(id:string){
 const rows=await db`select id,title,description,category,tags,instructions,source_text,version from family_recipes.recipes where id=${id} and deleted_at is null limit 1`;
 if(!rows.length)return null;
 const ingredients=await db`select name,quantity,quantity_max,quantity_text,unit,note from family_recipes.recipe_ingredients where recipe_id=${id} order by sort_order`;
 return {...rows[0],ingredients:ingredients.map(i=>({name:String(i.name),quantity:i.quantity===null?null:String(i.quantity),quantity_max:i.quantity_max===null?null:String(i.quantity_max),quantity_text:i.quantity_text,unit:i.unit,note:i.note}))};
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 try{
  if(!['GET','PUT','DELETE'].includes(req.method))return respond({error:'Method not allowed'},405);
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!token||!supabaseUrl||!publicKey)return respond({error:'Unauthorized'},401);
  const auth=await fetch(supabaseUrl+'/auth/v1/user',{headers:{Authorization:'Bearer '+token,apikey:publicKey}});
  if(!auth.ok)return respond({error:'Unauthorized'},401);
  const user=await auth.json();
  if(!uuid.test(user.id??''))return respond({error:'Unauthorized'},401);
  // Allow a pre-approved email only after Supabase Auth has verified ownership.
  const members=await db`select 1 from family_recipes.web_members where user_id=${user.id}::uuid limit 1`;
  const invited=typeof user.email==='string'&&user.email_confirmed_at
    ?await db`select 1 from family_recipes.web_allowed_emails where email=${user.email.toLowerCase()} limit 1`
    :[];
  if(!members.length&&!invited.length)return respond({error:'Доступ к семейной книге ещё не предоставлен'},403);
  const path=new URL(req.url).pathname.replace(/^.*\/family-recipes-web/,'');
  if(path==='/recipes'&&req.method==='GET'){
   const recipes=await db`select id,title,description,category,tags,instructions,version from family_recipes.recipes where deleted_at is null order by title,id limit 2000`;
   return respond({recipes});
  }
  const match=path.match(/^\/recipes\/([^/]+)$/);
  if(!match||!uuid.test(match[1]))return respond({error:'Not found'},404);
  const id=match[1];
  if(req.method==='GET'){const recipe=await getRecipe(id);return recipe?respond({recipe}):respond({error:'Рецепт не найден'},404)}
  if(req.method==='DELETE') {
   const body=await req.json();
   if(!Number.isInteger(body?.version))return respond({error:'Некорректная версия'},400);
   const removed=await db`update family_recipes.recipes set deleted_at=now(),version=version+1 where id=${id} and deleted_at is null and version=${body.version} returning id`;
   return removed.length?respond({ok:true}):respond({error:'Рецепт уже изменён или удалён'},409);
  }
  const body=await req.json();
  if(!body||body.id!==id||typeof body.title!=='string'||!body.title.trim()||body.title.length>250||!Number.isInteger(body.version)||!Array.isArray(body.ingredients)||body.ingredients.length>150||!Array.isArray(body.instructions)||body.instructions.length>150||!Array.isArray(body.tags)||body.tags.length>50)return respond({error:'Некорректные данные'},400);
  if(body.ingredients.some((i:unknown)=>!i||typeof i!=='object'||typeof (i as {name?:unknown}).name!=='string'||(i as {name:string}).name.length>300)||body.instructions.some((x:unknown)=>typeof x!=='string')||body.tags.some((x:unknown)=>typeof x!=='string'))return respond({error:'Некорректные поля'},400);
  const updated=await db.begin(async sql=>{
   const rows=await sql`update family_recipes.recipes set title=${body.title.trim()},description=${typeof body.description==='string'?body.description:null},category=${typeof body.category==='string'?body.category:null},tags=${body.tags as string[]},instructions=${sql.json(body.instructions)},version=version+1 where id=${id} and deleted_at is null and version=${body.version} returning id`;
   if(!rows.length)return false;
   await sql`delete from family_recipes.recipe_ingredients where recipe_id=${id}`;
   for(let i=0;i<body.ingredients.length;i++){
    const x=body.ingredients[i];if(!x.name.trim())continue;
    const parse=(v:unknown)=>v===null||v===undefined||v===''?null:Number(String(v).trim().replace(',','.'));
    const quantity=parse(x.quantity),maximum=parse(x.quantity_max);
    const label=String(x.name).trim();
    if(quantity!==null&&(!Number.isFinite(quantity)||quantity<0))throw new RangeError('Некорректное количество для «'+label+'»');
    if(maximum!==null&&(!Number.isFinite(maximum)||quantity===null||maximum<quantity))throw new RangeError('Некорректный диапазон для «'+label+'»');
    const qualitative=typeof x.quantity_text==='string'?x.quantity_text.trim():null;
    if(qualitative&&qualitative.length>120)throw new RangeError('Слишком длинное описание количества для «'+label+'»');
    await sql`insert into family_recipes.recipe_ingredients (recipe_id,name,normalized_name,quantity,quantity_max,quantity_text,unit,note,sort_order) values (${id},${label},${label.toLocaleLowerCase('ru')},${quantity},${maximum},${qualitative||null},${typeof x.unit==='string'?x.unit:null},${typeof x.note==='string'?x.note:null},${i})`;
   }
   return true;
  });
  if(!updated)return respond({error:'Рецепт изменился после открытия. Обнови страницу перед сохранением.'},409);
  return respond({recipe:await getRecipe(id)});
 }catch(e){if(e instanceof RangeError)return respond({error:e.message},400);console.error('Recipe web API error',e);return respond({error:'Не удалось обработать запрос'},500)}
});
