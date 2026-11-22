import React,{useEffect,useState} from 'react';
import{createRoot}from'react-dom/client';
import{createClient, type Session}from'@supabase/supabase-js';
import './style.css';
const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string|undefined;
const client=url&&key?createClient(url,key):null;
type Ingredient={name:string;quantity:string|null;quantity_max?:string|null;quantity_text?:string|null;unit:string|null;note:string|null};
type Recipe={id:string;title:string;description:string|null;category:string|null;tags:string[];instructions:string[];source_text?:string|null;ingredients:Ingredient[];version:number};
const parseQuantity=(raw:string):{quantity:string|null;quantity_max:string|null;quantity_text:string|null}=>{
 const text=raw.trim().replace(/[−–—]/g,'-');
 if(!text)return {quantity:null,quantity_max:null,quantity_text:null};
 const number='(?:\\d+(?:[.,]\\d+)?|\\d+\\s*/\\s*\\d+|\\d+\\s*(?:и\\s+|\\s+)\\d+\\s*/\\s*\\d+)';
 const match=text.match(new RegExp('^('+number+')(?:\\s*-\\s*('+number+'))?$','i'));
 const value=(v:string)=>{const m=v.trim().match(/^(?:(\d+)\s*(?:и\s+|\s+))?(\d+)\s*\/\s*(\d+)$/i);if(m){const denominator=Number(m[3]);if(!denominator)throw Error('Нулевой знаменатель: '+raw);return Number(m[1]??0)+Number(m[2])/denominator}return Number(v.replace(',','.'))};
 if(match){const low=value(match[1]),high=match[2]?value(match[2]):null;if(!Number.isFinite(low)||low<0||high!==null&&(!Number.isFinite(high)||high<low))throw Error('Неверный диапазон количества: '+raw);return {quantity:String(low),quantity_max:high===null?null:String(high),quantity_text:null}}
 return {quantity:null,quantity_max:null,quantity_text:raw.trim()};
};
const quantityInput=(i:Ingredient)=>i.quantity_text??(i.quantity===null?'':i.quantity_max===null||i.quantity_max===undefined?i.quantity:i.quantity+'–'+i.quantity_max);
const formatScaled=(i:Ingredient,factor:number)=>{const parsed=parseQuantity(quantityInput(i));if(parsed.quantity_text)return parsed.quantity_text;if(parsed.quantity===null)return '—';const fmt=(n:number)=>Number(n.toFixed(3)).toLocaleString('ru-RU');return fmt(Number(parsed.quantity)*factor)+(parsed.quantity_max? '–'+fmt(Number(parsed.quantity_max)*factor):'')};

type ProposedIngredient=Ingredient & {source:string};
function extractIngredients(source:string):ProposedIngredient[]{
 const lines=source.split(/\r?\n/);const output:ProposedIngredient[]=[];
 const unitPattern='кг|килограмм(?:а|ов)?|гр?\\.?|грамм(?:а|ов)?|мл|л|литр(?:а|ов)?|стакан(?:а|ов)?|ст\\.?\\s*л\\.?|ч\\.?\\s*л\\.?|чайных?\\s+лож(?:ка|ки|ек)|столовых?\\s+лож(?:ка|ки|ек)|шт\\.?|штук(?:и)?|пакетик(?:а|ов)?|банк(?:а|и|ок)';
 const amount='\\d+(?:[.,]\\d+)?(?:\\s*(?:и\\s+|\\s+)\\d+\\s*/\\s*\\d+|\\s*/\\s*\\d+)?(?:\\s*[-–—]\\s*\\d+(?:[.,]\\d+)?)?';
 const reAmount=new RegExp('('+amount+')\\s*('+unitPattern+')(?=\\s|$|[,;.)])','i');
 const reBefore=new RegExp('^\\s*('+amount+')\\s*('+unitPattern+')\\s+(.+)(session:Session,path:string,method='GET',body?:unknown):Promise<T>{
  if(!url||!key)throw Error('Не настроено подключение к Supabase');
  const res=await fetch(url+'/functions/v1/family-recipes-web'+path,{method,headers:{Authorization:'Bearer '+session.access_token,apikey:key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await res.json();if(!res.ok)throw Error(data.error??'Ошибка сервера');return data as T;
}
function App(){
 const[proposals,setProposals]=useState<ProposedIngredient[]|null>(null),[factor,setFactor]=useState(1),[swiped,setSwiped]=useState<string|null>(null),[deleting,setDeleting]=useState<Recipe|null>(null),[session,setSession]=useState<Session|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[items,setItems]=useState<Recipe[]>([]),[selected,setSelected]=useState<Recipe|null>(null),[search,setSearch]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{client?.auth.getSession().then(({data})=>setSession(data.session));const sub=client?.auth.onAuthStateChange((_event,s)=>setSession(s));return()=>sub?.data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(session)refresh(session);else{setItems([]);setSelected(null)}},[session?.access_token]);
 async function refresh(s:Session){try{setItems((await api<{recipes:Recipe[]}>(s,'/recipes')).recipes)}catch(e){setMessage(String(e))}}
 async function login(e:React.FormEvent){e.preventDefault();if(!client)return;setBusy(true);setMessage('');try{const{error}=await client.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;setPassword('')}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 async function open(id:string){if(!session)return;try{setProposals(null);setSelected((await api<{recipe:Recipe}>(session,'/recipes/'+encodeURIComponent(id))).recipe);setMessage('')}catch(e){setMessage(String(e))}}
 async function remove(){if(!session||!deleting)return;setBusy(true);try{await api(session,'/recipes/'+deleting.id,'DELETE',{version:deleting.version});setDeleting(null);setSwiped(null);setSelected(null);await refresh(session);setMessage('Рецепт удалён')}catch(e){setMessage(String(e))}finally{setBusy(false)}}
 async function save(){if(!session||!selected)return;setBusy(true);setMessage('');try{const ingredients=selected.ingredients.map(i=>({...i,...parseQuantity(quantityInput(i))}));const{recipe}=await api<{recipe:Recipe}>(session,'/recipes/'+selected.id,'PUT',{...selected,ingredients});setSelected(recipe);await refresh(session);setMessage('Изменения сохранены')}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 const edit=(patch:Partial<Recipe>)=>setSelected(v=>v?{...v,...patch}:v);
 const ingredient=(i:number,patch:Partial<Ingredient>)=>edit({ingredients:selected!.ingredients.map((v,j)=>i===j?{...v,...patch}:v)});
 if(!client)return <main><h1>Семейные рецепты</h1><p>Укажи VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY.</p></main>;
 if(!session)return <main className="login"><h1>Семейные рецепты</h1><p>Вход только для членов семьи</p><form onSubmit={login}><label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Пароль<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>Войти</button></form><p role="status">{message}</p></main>;
 return <main className="app">
 <header>{selected?<button className="secondary" onClick={()=>{setSelected(null);setProposals(null);setMessage('')}}>‹ Назад</button>:<h1>Семейные рецепты</h1>}<button className="secondary" onClick={()=>client.auth.signOut()}>Выйти</button></header>
 {!selected?<><input aria-label="Поиск рецептов" placeholder="Поиск рецептов" value={search} onChange={e=>setSearch(e.target.value)}/><p className="count">{items.filter(r=>(r.title+' '+(r.category??'')+' '+r.tags.join(' ')).toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))).length} рецептов</p><nav className="recipes">{items.filter(r=>(r.title+' '+(r.category??'')+' '+r.tags.join(' ')).toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))).map(r=><div className="swipe-row" key={r.id} onTouchStart={e=>{(e.currentTarget as HTMLElement).dataset.startX=String(e.touches[0].clientX)}} onTouchEnd={e=>{const start=Number((e.currentTarget as HTMLElement).dataset.startX);const dx=e.changedTouches[0].clientX-start;if(dx< -55)setSwiped(r.id);else if(dx>55)setSwiped(null)}}><button className="recipe-row" onClick={()=>{if(swiped===r.id)setSwiped(null);else open(r.id)}}>{r.title}<span>›</span></button>{swiped===r.id&&<button className="delete" onClick={()=>setDeleting(r)}>Удалить</button>}</div>)}</nav></>:<section className="editor">
 <h2>{selected.title}</h2>
 <label>Название<input value={selected.title} onChange={e=>edit({title:e.target.value})}/></label>
 <label>Описание<textarea rows={3} value={selected.description??''} onChange={e=>edit({description:e.target.value})}/></label>
 <label>Категория<input value={selected.category??''} onChange={e=>edit({category:e.target.value})}/></label>
 <label>Теги<input value={selected.tags.join(', ')} onChange={e=>edit({tags:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})}/></label>
 <h2>Ингредиенты</h2><div className="scale"><span>Масштаб рецепта</span>{[0.5,1,2,3].map(f=><button key={f} type="button" className={factor===f?'':'secondary'} onClick={()=>setFactor(f)}>×{String(f).replace('.',',')}</button>)}</div><p className="hint">Масштаб меняет только предварительный расчёт, оригинальные количества сохраняются.</p><div className="scaled-list">{selected.ingredients.filter(i=>i.name.trim()).map((i,k)=><div key={k}><span>{i.name}</span><strong>{formatScaled(i,factor)} {i.unit??''}</strong></div>)}</div>
 <div className="extract"><button className="secondary" onClick={()=>{const parsed=extractIngredients(selected.source_text||selected.instructions.join('\n'));setProposals(parsed);setMessage(parsed.length?'':'Не удалось уверенно распознать ингредиенты. Можно исправить их вручную.')}}>Разобрать ингредиенты из оригинала</button>{proposals&&<div className="proposal"><h3>Предложено: {proposals.length}</h3><p className="hint">Проверь список. Это предварительный разбор без ИИ. Ничего не сохраняется автоматически.</p>{proposals.map((p,i)=><div className="proposal-row" key={i}><label><input type="checkbox" defaultChecked={true} data-proposal={i}/><span>{p.name}: {quantityInput(p)} {p.unit??''}</span></label><small>{p.source}</small></div>)}<div className="actions"><button onClick={()=>{const checked=Array.from(document.querySelectorAll<HTMLInputElement>('[data-proposal]')).filter(e=>e.checked).map(e=>proposals[Number(e.dataset.proposal)]);edit({ingredients:[...selected.ingredients,...checked.map(({source,...ingredient})=>ingredient)]});setProposals(null);setMessage('Предложения добавлены в форму. Удали старые ошибочные строки и проверь результат перед сохранением.')}}>Добавить выбранные в форму</button><button className="secondary" onClick={()=>setProposals(null)}>Отмена</button></div></div>}</div><p className="hint">Каждый ингредиент отдельной строкой. Сверяй с оригиналом ниже: импорт мог объединить несколько ингредиентов.</p>
 {selected.ingredients.map((ing,i)=><div className="ingredient" key={i}><input aria-label="Ингредиент" placeholder="Название" value={ing.name} onChange={e=>ingredient(i,{name:e.target.value})}/><input aria-label="Количество" placeholder="2–2,5" value={quantityInput(ing)} onChange={e=>ingredient(i,{quantity:null,quantity_max:null,quantity_text:e.target.value})}/><input aria-label="Единица" placeholder="Ед." value={ing.unit??''} onChange={e=>ingredient(i,{unit:e.target.value||null})}/><input aria-label="Примечание" placeholder="Примечание" value={ing.note??''} onChange={e=>ingredient(i,{note:e.target.value||null})}/><button className="secondary" aria-label="Удалить ингредиент" onClick={()=>edit({ingredients:selected.ingredients.filter((_,j)=>i!==j)})}>×</button></div>)}
 <button className="secondary" onClick={()=>edit({ingredients:[...selected.ingredients,{name:'',quantity:null,quantity_max:null,quantity_text:null,unit:null,note:null}]})}>+ Ингредиент</button>
 <h2>Приготовление</h2><textarea rows={12} value={selected.instructions.join('\n')} onChange={e=>edit({instructions:e.target.value.split('\n')})}/>
 {selected.source_text&&<details className="original"><summary>Исходный текст рецепта (только чтение)</summary><pre>{selected.source_text}</pre></details>}
 <div className="actions"><button disabled={busy} onClick={save}>Сохранить</button><button className="secondary" onClick={()=>open(selected.id)}>Отменить изменения</button></div>
 </section>}
 {deleting&&<div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><h2>Удалить рецепт?</h2><p>{deleting.title}</p><p>Рецепт исчезнет из списка, но останется в базе для восстановления.</p><div className="actions"><button className="delete" disabled={busy} onClick={remove}>Удалить</button><button className="secondary" onClick={()=>setDeleting(null)}>Отмена</button></div></div></div>}
 <p role="status">{message}</p>
 </main>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
,'i');
 const reQual=/\b(по вкусу|щепотк[ауие]?|сколько потребуется)\b/i;
 let section=false;
 for(const raw of lines){
  let line=raw.trim().replace(/^[•*–—-]\s*/,'').replace(/^\d+[.)]\s*/,'');
  if(/^(ингредиенты|состав)\s*[:：]?\s*$/i.test(line)){section=true;continue}
  if(/^(приготовление|способ приготовления|инструкция|как готовить|процесс)\s*[:：]?\s*$/i.test(line)){section=false;continue}
  if(!line||line.length>180)continue;
  // Outside an ingredient section, only accept a short line with a recognizable quantity.
  const before=line.match(reBefore),found=line.match(reAmount),qual=line.match(reQual);
  if(!section&&!found&&!before&&!qual)continue;
  let name='',quantity:string|null=null,unit:string|null=null,quantity_text:string|null=null,note:string|null=null;
  if(before){quantity=before[1];unit=before[2];name=before[3]}
  else if(found){name=line.slice(0,found.index).replace(/[\s:—–-]+$/,'');quantity=found[1];unit=found[2];note=line.slice((found.index??0)+found[0].length).replace(/^[\s,;()—–-]+|[\s,;()—–-]+$/g,'')||null}
  else if(qual){name=line.slice(0,qual.index).replace(/[\s:—–-]+$/,'');quantity_text=qual[1]}
  else continue;
  name=name.replace(/^[\s:—–-]+|[\s:—–-]+$/g,'');
  if(!name||name.length>100||/[.!?]\s+\S/.test(name))continue;
  if(quantity){const parsed=parseQuantity(quantity);quantity=parsed.quantity;quantity_text=parsed.quantity_text;output.push({name,quantity,quantity_max:parsed.quantity_max,quantity_text,unit,note,source:raw});}
  else output.push({name,quantity:null,quantity_max:null,quantity_text,unit,note,source:raw});
 }
 return output;
}
async function api<T>(session:Session,path:string,method='GET',body?:unknown):Promise<T>{
  if(!url||!key)throw Error('Не настроено подключение к Supabase');
  const res=await fetch(url+'/functions/v1/family-recipes-web'+path,{method,headers:{Authorization:'Bearer '+session.access_token,apikey:key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await res.json();if(!res.ok)throw Error(data.error??'Ошибка сервера');return data as T;
}
function App(){
 const[factor,setFactor]=useState(1),[swiped,setSwiped]=useState<string|null>(null),[deleting,setDeleting]=useState<Recipe|null>(null),[session,setSession]=useState<Session|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[items,setItems]=useState<Recipe[]>([]),[selected,setSelected]=useState<Recipe|null>(null),[search,setSearch]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{client?.auth.getSession().then(({data})=>setSession(data.session));const sub=client?.auth.onAuthStateChange((_event,s)=>setSession(s));return()=>sub?.data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(session)refresh(session);else{setItems([]);setSelected(null)}},[session?.access_token]);
 async function refresh(s:Session){try{setItems((await api<{recipes:Recipe[]}>(s,'/recipes')).recipes)}catch(e){setMessage(String(e))}}
 async function login(e:React.FormEvent){e.preventDefault();if(!client)return;setBusy(true);setMessage('');try{const{error}=await client.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;setPassword('')}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 async function open(id:string){if(!session)return;try{setSelected((await api<{recipe:Recipe}>(session,'/recipes/'+encodeURIComponent(id))).recipe);setMessage('')}catch(e){setMessage(String(e))}}
 async function remove(){if(!session||!deleting)return;setBusy(true);try{await api(session,'/recipes/'+deleting.id,'DELETE',{version:deleting.version});setDeleting(null);setSwiped(null);setSelected(null);await refresh(session);setMessage('Рецепт удалён')}catch(e){setMessage(String(e))}finally{setBusy(false)}}
 async function save(){if(!session||!selected)return;setBusy(true);setMessage('');try{const ingredients=selected.ingredients.map(i=>({...i,...parseQuantity(quantityInput(i))}));const{recipe}=await api<{recipe:Recipe}>(session,'/recipes/'+selected.id,'PUT',{...selected,ingredients});setSelected(recipe);await refresh(session);setMessage('Изменения сохранены')}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 const edit=(patch:Partial<Recipe>)=>setSelected(v=>v?{...v,...patch}:v);
 const ingredient=(i:number,patch:Partial<Ingredient>)=>edit({ingredients:selected!.ingredients.map((v,j)=>i===j?{...v,...patch}:v)});
 if(!client)return <main><h1>Семейные рецепты</h1><p>Укажи VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY.</p></main>;
 if(!session)return <main className="login"><h1>Семейные рецепты</h1><p>Вход только для членов семьи</p><form onSubmit={login}><label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Пароль<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>Войти</button></form><p role="status">{message}</p></main>;
 return <main className="app">
 <header>{selected?<button className="secondary" onClick={()=>{setSelected(null);setMessage('')}}>‹ Назад</button>:<h1>Семейные рецепты</h1>}<button className="secondary" onClick={()=>client.auth.signOut()}>Выйти</button></header>
 {!selected?<><input aria-label="Поиск рецептов" placeholder="Поиск рецептов" value={search} onChange={e=>setSearch(e.target.value)}/><p className="count">{items.filter(r=>(r.title+' '+(r.category??'')+' '+r.tags.join(' ')).toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))).length} рецептов</p><nav className="recipes">{items.filter(r=>(r.title+' '+(r.category??'')+' '+r.tags.join(' ')).toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))).map(r=><div className="swipe-row" key={r.id} onTouchStart={e=>{(e.currentTarget as HTMLElement).dataset.startX=String(e.touches[0].clientX)}} onTouchEnd={e=>{const start=Number((e.currentTarget as HTMLElement).dataset.startX);const dx=e.changedTouches[0].clientX-start;if(dx< -55)setSwiped(r.id);else if(dx>55)setSwiped(null)}}><button className="recipe-row" onClick={()=>{if(swiped===r.id)setSwiped(null);else open(r.id)}}>{r.title}<span>›</span></button>{swiped===r.id&&<button className="delete" onClick={()=>setDeleting(r)}>Удалить</button>}</div>)}</nav></>:<section className="editor">
 <h2>{selected.title}</h2>
 <label>Название<input value={selected.title} onChange={e=>edit({title:e.target.value})}/></label>
 <label>Описание<textarea rows={3} value={selected.description??''} onChange={e=>edit({description:e.target.value})}/></label>
 <label>Категория<input value={selected.category??''} onChange={e=>edit({category:e.target.value})}/></label>
 <label>Теги<input value={selected.tags.join(', ')} onChange={e=>edit({tags:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})}/></label>
 <h2>Ингредиенты</h2><div className="scale"><span>Масштаб рецепта</span>{[0.5,1,2,3].map(f=><button key={f} type="button" className={factor===f?'':'secondary'} onClick={()=>setFactor(f)}>×{String(f).replace('.',',')}</button>)}</div><p className="hint">Масштаб меняет только предварительный расчёт, оригинальные количества сохраняются.</p><div className="scaled-list">{selected.ingredients.filter(i=>i.name.trim()).map((i,k)=><div key={k}><span>{i.name}</span><strong>{formatScaled(i,factor)} {i.unit??''}</strong></div>)}</div>
 <p className="hint">Каждый ингредиент отдельной строкой. Сверяй с оригиналом ниже: импорт мог объединить несколько ингредиентов.</p>
 {selected.ingredients.map((ing,i)=><div className="ingredient" key={i}><input aria-label="Ингредиент" placeholder="Название" value={ing.name} onChange={e=>ingredient(i,{name:e.target.value})}/><input aria-label="Количество" placeholder="2–2,5" value={quantityInput(ing)} onChange={e=>ingredient(i,{quantity:null,quantity_max:null,quantity_text:e.target.value})}/><input aria-label="Единица" placeholder="Ед." value={ing.unit??''} onChange={e=>ingredient(i,{unit:e.target.value||null})}/><input aria-label="Примечание" placeholder="Примечание" value={ing.note??''} onChange={e=>ingredient(i,{note:e.target.value||null})}/><button className="secondary" aria-label="Удалить ингредиент" onClick={()=>edit({ingredients:selected.ingredients.filter((_,j)=>i!==j)})}>×</button></div>)}
 <button className="secondary" onClick={()=>edit({ingredients:[...selected.ingredients,{name:'',quantity:null,quantity_max:null,quantity_text:null,unit:null,note:null}]})}>+ Ингредиент</button>
 <h2>Приготовление</h2><textarea rows={12} value={selected.instructions.join('\n')} onChange={e=>edit({instructions:e.target.value.split('\n')})}/>
 {selected.source_text&&<details className="original"><summary>Исходный текст рецепта (только чтение)</summary><pre>{selected.source_text}</pre></details>}
 <div className="actions"><button disabled={busy} onClick={save}>Сохранить</button><button className="secondary" onClick={()=>open(selected.id)}>Отменить изменения</button></div>
 </section>}
 {deleting&&<div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><h2>Удалить рецепт?</h2><p>{deleting.title}</p><p>Рецепт исчезнет из списка, но останется в базе для восстановления.</p><div className="actions"><button className="delete" disabled={busy} onClick={remove}>Удалить</button><button className="secondary" onClick={()=>setDeleting(null)}>Отмена</button></div></div></div>}
 <p role="status">{message}</p>
 </main>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
