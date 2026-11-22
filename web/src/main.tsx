import React,{useEffect,useState} from 'react';
import{createRoot}from'react-dom/client';
import{createClient, type Session}from'@supabase/supabase-js';
import './style.css';
const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string|undefined;
const client=url&&key?createClient(url,key):null;
type Ingredient={name:string;quantity:string|null;unit:string|null;note:string|null};
type Recipe={id:string;title:string;description:string|null;category:string|null;tags:string[];instructions:string[];source_text?:string|null;ingredients:Ingredient[];version:number};
async function api<T>(session:Session,path:string,method='GET',body?:unknown):Promise<T>{
  if(!url||!key)throw Error('Не настроено подключение к Supabase');
  const res=await fetch(url+'/functions/v1/family-recipes-web'+path,{method,headers:{Authorization:'Bearer '+session.access_token,apikey:key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await res.json();if(!res.ok)throw Error(data.error??'Ошибка сервера');return data as T;
}
function App(){
 const[swiped,setSwiped]=useState<string|null>(null),[deleting,setDeleting]=useState<Recipe|null>(null),[session,setSession]=useState<Session|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[items,setItems]=useState<Recipe[]>([]),[selected,setSelected]=useState<Recipe|null>(null),[search,setSearch]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{client?.auth.getSession().then(({data})=>setSession(data.session));const sub=client?.auth.onAuthStateChange((_event,s)=>setSession(s));return()=>sub?.data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(session)refresh(session);else{setItems([]);setSelected(null)}},[session?.access_token]);
 async function refresh(s:Session){try{setItems((await api<{recipes:Recipe[]}>(s,'/recipes')).recipes)}catch(e){setMessage(String(e))}}
 async function login(e:React.FormEvent){e.preventDefault();if(!client)return;setBusy(true);setMessage('');try{const{error}=await client.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;setPassword('')}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 async function open(id:string){if(!session)return;try{setSelected((await api<{recipe:Recipe}>(session,'/recipes/'+encodeURIComponent(id))).recipe);setMessage('')}catch(e){setMessage(String(e))}}
 async function remove(){if(!session||!deleting)return;setBusy(true);try{await api(session,'/recipes/'+deleting.id,'DELETE',{version:deleting.version});setDeleting(null);setSwiped(null);setSelected(null);await refresh(session);setMessage('Рецепт удалён')}catch(e){setMessage(String(e))}finally{setBusy(false)}}
 async function save(){if(!session||!selected)return;setBusy(true);try{const{recipe}=await api<{recipe:Recipe}>(session,'/recipes/'+selected.id,'PUT',selected);setSelected(recipe);await refresh(session);setMessage('Изменения сохранены')}catch(e){setMessage(String(e))}finally{setBusy(false)}}
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
 <h2>Ингредиенты</h2>
 <p className="hint">Каждый ингредиент отдельной строкой. Сверяй с оригиналом ниже: импорт мог объединить несколько ингредиентов.</p>
 {selected.ingredients.map((ing,i)=><div className="ingredient" key={i}><input aria-label="Ингредиент" placeholder="Название" value={ing.name} onChange={e=>ingredient(i,{name:e.target.value})}/><input aria-label="Количество" placeholder="Кол-во" value={ing.quantity??''} onChange={e=>ingredient(i,{quantity:e.target.value||null})}/><input aria-label="Единица" placeholder="Ед." value={ing.unit??''} onChange={e=>ingredient(i,{unit:e.target.value||null})}/><input aria-label="Примечание" placeholder="Примечание" value={ing.note??''} onChange={e=>ingredient(i,{note:e.target.value||null})}/><button className="secondary" aria-label="Удалить ингредиент" onClick={()=>edit({ingredients:selected.ingredients.filter((_,j)=>i!==j)})}>×</button></div>)}
 <button className="secondary" onClick={()=>edit({ingredients:[...selected.ingredients,{name:'',quantity:null,unit:null,note:null}]})}>+ Ингредиент</button>
 <h2>Приготовление</h2><textarea rows={12} value={selected.instructions.join('\n')} onChange={e=>edit({instructions:e.target.value.split('\n')})}/>
 {selected.source_text&&<details className="original"><summary>Исходный текст рецепта (только чтение)</summary><pre>{selected.source_text}</pre></details>}
 <div className="actions"><button disabled={busy} onClick={save}>Сохранить</button><button className="secondary" onClick={()=>open(selected.id)}>Отменить изменения</button></div>
 </section>}
 {deleting&&<div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><h2>Удалить рецепт?</h2><p>{deleting.title}</p><p>Рецепт исчезнет из списка, но останется в базе для восстановления.</p><div className="actions"><button className="delete" disabled={busy} onClick={remove}>Удалить</button><button className="secondary" onClick={()=>setDeleting(null)}>Отмена</button></div></div></div>}
 <p role="status">{message}</p>
 </main>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
